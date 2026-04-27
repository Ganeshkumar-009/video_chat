'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';

export default function VideoRoom() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const localVideoRef = useRef<any>(null);
  const remoteVideoRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_URL);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream: any) => {
      localVideoRef.current.srcObject = stream;

      // WebRTC setup
      const peerConnection = new RTCPeerConnection();
      stream.getTracks().forEach((track: any) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event: any) => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };

      peerConnection.onicecandidate = (event: any) => {
        if (event.candidate) {
          socketRef.current.emit('ice-candidate', event.candidate);
        }
      };

      socketRef.current.emit('join-room', roomId);

      socketRef.current.on('offer', async (offer: any) => {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socketRef.current.emit('answer', answer);
      });

      // More handlers...
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [roomId]);

  return (
    <div className="flex h-screen bg-black">
      <video ref={localVideoRef} autoPlay muted className="w-1/4 h-1/2 absolute bottom-4 right-4" />
      <video ref={remoteVideoRef} autoPlay className="w-full h-full" />
      <button className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white p-4 rounded-full">
        End Call
      </button>
    </div>
  );
}

