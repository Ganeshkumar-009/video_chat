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

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export default function CallScreen({ recipient, currentUser, roomId, channel, initialCallType, onEndCall }: CallScreenProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const activeMessageId = useRef<string | null>(null);
  const callStartTime = useRef<number>(Date.now());
  const [isJitsiLoaded, setIsJitsiLoaded] = useState(false);

  useEffect(() => {
    // 1. Load Jitsi Script
    const script = document.createElement('script');
    script.src = 'https://8x8.vc/vpaas-magic-cookie-86109968da98471589d9852261f22df8/external_api.js';
    script.async = true;
    script.onload = () => setIsJitsiLoaded(true);
    document.body.appendChild(script);

    // 2. Initial Setup (Database Message)
    let isInitiator = !initialCallType.startsWith('incoming');
    const type = initialCallType.replace('incoming-', '');

    const initCall = async () => {
      if (isInitiator) {
        const payloadStr = JSON.stringify({
          text: `📞 Starting ${type} call...`,
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
          // Notify peer about the message ID
          channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'call-signal', room: roomId, messageId: data[0].id } });
        }
      }

      // Handle termination signals from peer
      const handleBroadcast = ({ payload }: any) => {
        if (payload.room !== roomId) return;
        if (payload.type === 'call-signal') {
          if (payload.signal === 'call-ended') {
            onEndCall();
          }
          if (payload.messageId && !isInitiator) {
            activeMessageId.current = payload.messageId;
          }
        }
      };
      channel.on('broadcast', { event: 'webrtc' }, handleBroadcast);
      (channel as any)._jitsiHandler = handleBroadcast;
    };

    initCall();

    return () => {
      if (apiRef.current) apiRef.current.dispose();
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (isJitsiLoaded && jitsiContainerRef.current && !apiRef.current) {
      const type = initialCallType.replace('incoming-', '');
      
      // Jitsi Room Name must be unique
      const domain = '8x8.vc';
      const options = {
        roomName: `vpaas-magic-cookie-86109968da98471589d9852261f22df8/${roomId}`,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: currentUser.username
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: type === 'audio',
          prejoinPageEnabled: false,
          disableInviteFunctions: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ],
        }
      };

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      apiRef.current.addEventListeners({
        readyToClose: () => handleHangup(),
        videoConferenceTerminated: () => handleHangup()
      });
    }
  }, [isJitsiLoaded]);

  const handleHangup = async () => {
    // Send hangup signal to peer
    channel.send({ type: 'broadcast', event: 'webrtc', payload: { type: 'call-signal', room: roomId, signal: 'call-ended' } });
    
    // Update DB
    if (activeMessageId.current) {
      const durationSecs = Math.floor((Date.now() - callStartTime.current) / 1000);
      const durationStr = durationSecs > 60 ? `${Math.floor(durationSecs/60)}m ${durationSecs%60}s` : `${durationSecs}s`;
      
      const endPayloadStr = JSON.stringify({
        text: `Call ended (${durationStr})`,
        callData: { type: initialCallType.replace('incoming-', ''), status: 'ended', duration: durationStr }
      });

      await supabase.from('messages').update({
        content: encryptMessage(endPayloadStr, roomId)
      }).eq('id', activeMessageId.current);
    }

    onEndCall();
  };

  return (
    <div className="absolute inset-0 bg-black z-[2000] flex flex-col">
      <div ref={jitsiContainerRef} className="flex-1 w-full h-full" />
      
      {!isJitsiLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0b]">
          <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-medium">Launching Secure Video...</p>
        </div>
      )}
    </div>
  );
}
