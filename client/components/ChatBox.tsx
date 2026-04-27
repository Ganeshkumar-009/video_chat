'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { supabase } from '@/lib/supabase';

interface ChatBoxProps {
  recipient: any;
  currentUser: any;
}

export default function ChatBox({ recipient, currentUser }: ChatBoxProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const socketRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomId = [currentUser.id, recipient.id].sort().join('--');

  useEffect(() => {
    // 1. Fetch chat history from Supabase
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setMessages(data.map(m => ({
          text: m.content,
          user: m.sender_username,
          timestamp: m.created_at,
          room: m.room_id
        })));
      }
    };
    fetchHistory();

    // 2. Setup Real-time Sockets
    socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000');
    socketRef.current.emit('join-room', roomId, currentUser.id);

    socketRef.current.on('chat-message', (data: any) => {
      if (data.room === roomId) {
        setMessages(prev => [...prev, data]);
      }
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
  }, [roomId, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim()) return;

    const msgData = { 
      room: roomId, 
      text: message, 
      user: currentUser.username,
      timestamp: new Date().toISOString()
    };

    // 1. Save to Supabase (Persistence)
    const { error } = await supabase
      .from('messages')
      .insert([{
        room_id: roomId,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        content: message,
        receiver_id: recipient.id
      }]);

    if (error) {
      console.error('Error saving message:', error);
    }

    // 2. Broadcast via Socket (Real-time)
    socketRef.current.emit('chat-message', msgData);
    setMessage('');
  };

  const handleClearChat = async () => {
    await supabase.from('messages').delete().eq('room_id', roomId);
    setMessages([]);
    setIsMenuOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.05] flex items-center justify-between backdrop-blur-md bg-white/[0.01]">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-violet-600/20 border border-white/[0.1] flex items-center justify-center text-purple-400 font-bold shadow-inner uppercase">
              {recipient.username?.[0] || 'U'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-[#0a0a0b] rounded-full ${recipient.status === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg leading-tight tracking-tight">{recipient.username}</h2>
            <p className="text-[10px] text-purple-500/80 font-bold tracking-widest uppercase flex items-center gap-1.5 pt-0.5">
              <span className="w-1 h-1 rounded-full bg-purple-500 animate-pulse"></span>
              Secret Chat
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-400 hover:text-white border border-white/[0.05] transition-all duration-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-14 w-48 bg-[#161618] border border-white/[0.1] rounded-2xl shadow-2xl py-2 z-50">
              <button 
                onClick={handleClearChat}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-medium"
              >
                Clear entire history
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
        {messages.map((msg: any, i: number) => {
          const isOwn = msg.user === currentUser.username;
          return (
            <div key={i} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-1 duration-300`}>
              <div className="max-w-[75%]">
                <div className={`px-4 py-3 rounded-2xl ${
                  isOwn 
                    ? 'bg-gradient-to-tr from-purple-600 to-violet-600 text-white' 
                    : 'bg-white/[0.03] border border-white/[0.07] text-gray-200'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
                <span className={`text-[9px] text-gray-500 mt-1.5 block px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 pointer-events-none translate-y-[-10%] select-none">
            <p className="text-sm font-bold uppercase tracking-[0.3em]">No history yet</p>
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
            placeholder={`Type a message...`}
          />
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white active:scale-95 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
