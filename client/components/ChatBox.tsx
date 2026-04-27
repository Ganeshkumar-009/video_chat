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

  const sendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const storedUser = localStorage.getItem('currentUser');
    const user = storedUser ? JSON.parse(storedUser).username : 'User';
    
    if (message.trim()) {
      socketRef.current.emit('chat-message', { room: roomId, text: message, user });
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
      <div className="p-5 border-b border-white/[0.05] flex items-center justify-between backdrop-blur-md bg-white/[0.01]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-purple-400 font-bold shadow-inner">
            #
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight uppercase tracking-wide">
              {roomId.replace('-', ' ')}
            </h2>
            <p className="text-[11px] text-gray-500 font-medium tracking-widest uppercase">Room Chat</p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <button className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-purple-400 border border-white/[0.05] transition-all duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.05] transition-all duration-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-14 w-48 bg-[#161618] border border-white/[0.1] rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
              <button className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white flex items-center gap-3 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Report
              </button>
              <button className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.05] hover:text-white flex items-center gap-3 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                Block User
              </button>
              <div className="h-px bg-white/[0.05] my-1 mx-2"></div>
              <button 
                onClick={handleClearChat}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                Clear chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
        {messages.map((msg: any, i: number) => {
          const isOwn = msg.user === JSON.parse(localStorage.getItem('currentUser') || '{}').username;
          return (
            <div key={i} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[70%] group relative`}>
                <div className={`px-4 py-3 rounded-2xl ${
                  isOwn 
                    ? 'bg-gradient-to-tr from-purple-600 to-violet-600 text-white shadow-lg shadow-purple-500/10' 
                    : 'bg-white/[0.03] border border-white/[0.05] text-gray-200'
                }`}>
                  {!isOwn && (
                    <span className="block text-[10px] uppercase tracking-widest font-bold text-purple-400 mb-1 opacity-80">
                      {msg.user}
                    </span>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
                <span className={`text-[9px] text-gray-500 mt-1 block px-1 tracking-tighter ${isOwn ? 'text-right' : 'text-left'}`}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 pointer-events-none translate-y-[-10%]">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <p className="text-sm font-medium uppercase tracking-[0.2em]">No messages yet</p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 bg-gradient-to-t from-[#0a0a0b] to-transparent">
        <form onSubmit={sendMessage} className="relative group">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full py-4 pl-14 pr-16 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 text-white placeholder-gray-500 transition-all duration-300 outline-none backdrop-blur-md"
            placeholder={`Message ${roomId.replace('-', ' ')}...`}
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-xl text-gray-500 group-focus-within:text-purple-400 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </div>
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 active:scale-95 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
