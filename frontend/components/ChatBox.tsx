'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';

export default function ChatBox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const socketRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'general';

  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000');
    socketRef.current.emit('join-room', roomId);

    socketRef.current.on('chat-message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      socketRef.current?.disconnect();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [roomId]);

  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', { room: roomId, text: message, user: 'currentUser' });
      setMessage('');
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setIsMenuOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01] backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center font-bold text-lg text-purple-400">
              B
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b0e11]" />
          </div>
          <div>
            <h2 className="font-bold text-gray-100 tracking-tight">bhavya_009</h2>
            <p className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest">Offline</p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          <button className="p-3 bg-white/5 hover:bg-purple-500/10 text-gray-400 hover:text-purple-400 rounded-2xl transition-all border border-transparent hover:border-purple-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          </button>
          
          <div ref={menuRef} className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-3 hover:bg-white/5 text-gray-400 rounded-2xl transition-all border border-transparent ${isMenuOpen ? 'bg-white/5 text-white border-white/10' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-[#161b22] border border-white/10 rounded-2xl shadow-2xl py-2 overflow-hidden z-20 transform origin-top-right transition-all">
                <button onClick={() => setIsMenuOpen(false)} className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
                  Report
                </button>
                <button onClick={() => setIsMenuOpen(false)} className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-3 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  Block
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button 
                  onClick={handleClearChat}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-400/5 flex items-center gap-3 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  Clear chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/5">
        {messages.map((msg: any, i: number) => {
          const isMe = msg.user === 'currentUser';
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-5 py-3 rounded-2xl text-sm ${
                isMe 
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/10 rounded-tr-none' 
                  : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none'
              }`}>
                <p className="line-height-relaxed">{msg.text}</p>
                <p className={`text-[9px] mt-1.5 opacity-50 ${isMe ? 'text-right' : 'text-left'}`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white/[0.01] backdrop-blur-xl border-t border-white/5">
        <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-2 border border-white/5 focus-within:border-purple-500/30 transition-all">
          <button className="p-2.5 text-gray-500 hover:text-gray-300 transition-all ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 bg-transparent border-none outline-none text-gray-200 placeholder:text-gray-600 text-sm py-2"
            placeholder="Type your message..."
          />
          <div className="flex items-center gap-1">
            <button className="p-2.5 text-gray-500 hover:text-gray-300 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <button 
              onClick={sendMessage} 
              disabled={!message.trim()}
              className="p-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-xl shadow-lg transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

