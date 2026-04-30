'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptMessage } from '@/lib/crypto';

interface CallScreenProps {
  recipient: any;
  currentUser: any;
  roomId: string;
  channel: any;
  initialCallType: string;
  onEndCall: () => void;
}

export default function CallScreen({ recipient, currentUser, roomId, channel, initialCallType, onEndCall }: CallScreenProps) {
  const [callStatus, setCallStatus] = useState('calling');  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(initialCallType === 'audio' || initialCallType === 'incoming-audio');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const callStartTime = useRef<number | null>(null);
  const activeMessageId = useRef<string | null>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);

  useEffect(() => {
    let isInitiator = !initialCallType.startsWith('incoming');
    const type = initialCallType.replace('incoming-', '');

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true
        });
        localStream.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({
           iceServers: [
             { urls: 'stun:stun.l.google.com:19302' },
             { urls: 'stun:stun1.l.google.com:19302' },
             {
               urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443?transport=tcp'],
               username: 'openrelayproject',
               credential: 'openrelayproject'
             }
           ]
        });
        peerConnection.current = pc;

        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play().catch(() => {});
          }
          setCallStatus('connected');
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'ice-candidate', room: roomId, candidate: event.candidate } });
          }
        };

        const handleBroadcast = async ({ payload }: any) => {
          if (payload.room !== roomId) return;

          // Handshake Ping-Pong to ensure connection
          if (payload.type === 'handshake-ping' && !isInitiator && callStatus === 'calling') {
            if (payload.messageId) activeMessageId.current = payload.messageId;
            channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'handshake-pong', room: roomId } });
            return;
          }

          if (payload.type === 'handshake-pong' && isInitiator && callStatus === 'calling') {
             try {
                callStartTime.current = Date.now();
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'offer', room: roomId, offer } });
             } catch(e) { console.error('Pong offer error:', e); }
             return;
          }

          if (payload.type === 'offer' && !isInitiator) {
             try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'answer', room: roomId, answer } });
                
                while (pendingCandidates.current.length > 0) {
                  const candidate = pendingCandidates.current.shift();
                  if (candidate) await pc.addIceCandidate(candidate);
                }
             } catch(e) { console.error('Offer error:', e); }
          }
          
          if (payload.type === 'answer') {
             try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
             } catch(e) { console.error('Answer error:', e); }
          }

          if (payload.type === 'ice-candidate') {
             try {
                const candidate = new RTCIceCandidate(payload.candidate);
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  await pc.addIceCandidate(candidate);
                } else {
                  pendingCandidates.current.push(candidate);
                }
             } catch(e) { console.error('ICE error:', e); }
          }

          if (payload.type === 'call-signal') {
             if (payload.signal === 'call-accepted' && isInitiator) {
                try {
                   callStartTime.current = Date.now();
                   const offer = await pc.createOffer();
                   await pc.setLocalDescription(offer);
                   channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'offer', room: roomId, offer } });
                } catch(e) { console.error('Create offer error:', e); }
             }
             if (payload.signal === 'call-accepted' && !isInitiator) {
                callStartTime.current = Date.now();
             }
             if (payload.signal === 'call-ended') {
                endCallLocally();
             }
             if (payload.messageId && !isInitiator) {
                activeMessageId.current = payload.messageId;
             }
          }
        };

        channel.on('broadcast', { event: 'webrtc' }, handleBroadcast);
        (channel as any)._webrtcHandler = handleBroadcast;

        if (isInitiator) {
          const payloadStr = JSON.stringify({
             text: `📞 ${type === 'video' ? 'Video' : 'Audio'} Call`,
             callData: { type, status: 'ringing', isVideo: type === 'video' }
          });
          
          const { data } = await supabase.from('messages').insert([{
             room_id: roomId,
             sender_id: currentUser.id,
             sender_username: currentUser.username,
             content: encryptMessage(payloadStr, roomId),
             receiver_id: recipient.id,
             is_read: false
          }]).select();

          if (data && data.length > 0) {
             activeMessageId.current = data[0].id;
             // Retry loop to find the other peer
             const retryInterval = setInterval(() => {
                if (callStatus === 'connected' || !peerConnection.current) {
                   clearInterval(retryInterval);
                   return;
                }
                channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'handshake-ping', room: roomId, messageId: data[0].id } });
             }, 2000);
          }
          
          const { data: userData } = await supabase.from('users').select('fcm_token').eq('id', recipient.id).single();
          if (userData?.fcm_token) {
            await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: userData.fcm_token,
                title: `Incoming ${type} call`,
                body: `${currentUser.username} is calling you...`
              })
            });
          }
        } else {
          channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'call-signal', room: roomId, signal: 'call-accepted' } });
        }

      } catch (err) {
        console.error("Media Error:", err);
        endCallLocally();
      }
    };

    setupMedia();

    return () => { endCallLocally(); };
  }, []);

  const endCallLocally = async () => {
    localStream.current?.getTracks().forEach(t => t.stop());
    peerConnection.current?.close();
    
    if ((channel as any)._webrtcHandler) {
      (channel as any)._webrtcHandler = () => {}; 
    }

    if (activeMessageId.current) {
       let durationStr = "0s";
       if (callStartTime.current) {
          const secs = Math.floor((Date.now() - callStartTime.current) / 1000);
          if (secs > 60) durationStr = `${Math.floor(secs/60)}m ${secs%60}s`;
          else durationStr = `${secs}s`;
       }
       
       const endPayloadStr = JSON.stringify({
          text: `Call ended (${durationStr})`,
          callData: { type: initialCallType.replace('incoming-', ''), status: 'ended', duration: durationStr }
       });

       await supabase.from('messages').update({
          content: encryptMessage(endPayloadStr, roomId)
       }).eq('id', activeMessageId.current);
       activeMessageId.current = null;
    }

    onEndCall();
  };

  const handleHangup = () => {
    channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'call-signal', room: roomId, signal: 'call-ended' } });
    endCallLocally();
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0a0a0b] z-[1000] flex flex-col items-center justify-center overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={() => { if (remoteVideoRef.current) remoteVideoRef.current.muted = false; }}>
      <video 
        ref={remoteVideoRef} 
        autoPlay 
        playsInline 
        muted
        className={`w-full h-full object-cover absolute inset-0 ${callStatus !== 'connected' ? 'opacity-0' : 'opacity-100'}`} 
      />

      {callStatus !== 'connected' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1a1c] to-[#0a0a0b] z-10">
          <div className="w-28 h-28 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-5xl shadow-2xl mb-6 ring-8 ring-purple-500/20">
             {recipient.username[0].toUpperCase()}
          </div>
          <h2 className="text-3xl font-bold text-white tracking-wide">{recipient.username}</h2>
          <p className="text-purple-400 mt-2 font-medium animate-pulse">{callStatus === 'calling' ? 'Calling...' : 'Ringing...'}</p>
        </div>
      )}

      <div className={`absolute bottom-32 right-6 w-32 h-44 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-20 transition-all ${isVideoOff ? 'hidden' : 'block'}`}>
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover transform scale-x-[-1]" 
        />
      </div>

      <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6 z-30 pb-4">
         <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${isVideoOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
            {isVideoOff && <div className="absolute w-8 h-0.5 bg-black rotate-45" />}
         </button>
         <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${isMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            {isMuted && <div className="absolute w-8 h-0.5 bg-black rotate-45" />}
         </button>
         <button onClick={handleHangup} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 transform hover:scale-105 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" y1="2" x2="2" y2="22"/></svg>
         </button>
      </div>

      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/80 to-transparent flex items-start p-6 z-30">
        <button onClick={handleHangup} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors backdrop-blur-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="flex-1 text-center pr-10">
           <div className="text-white/80 text-[13px] font-medium flex items-center justify-center gap-1.5 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
              End-to-end encrypted
           </div>
        </div>
      </div>
    </div>
  );
}
