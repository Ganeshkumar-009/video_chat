'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';

export default function ChatBox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const socketRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'general';

  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000');
    socketRef.current.emit('join-room', roomId);

    socketRef.current.on('chat-message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => socketRef.current?.disconnect();
  }, [roomId]);

  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', { room: roomId, text: message, user: 'currentUser' });
      setMessage('');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg: any, i: number) => (
          <div key={i} className="p-2 bg-blue-100 rounded">
            <strong>{msg.user}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <div className="p-4 border-t flex">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 p-2 border rounded-l"
          placeholder="Type message..."
        />
        <button onClick={sendMessage} className="px-4 bg-green-500 text-white rounded-r">
          Send
        </button>
      </div>
    </div>
  );
}
