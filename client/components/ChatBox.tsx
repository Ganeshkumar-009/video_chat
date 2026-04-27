'use client';
import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ChatBoxProps {
  recipient: any;
  currentUser: any;
  onBack?: () => void;
}

export default function ChatBox({ recipient, currentUser, onBack }: ChatBoxProps) {
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
          id: m.id,
          text: m.content,
          user: m.sender_username,
          timestamp: m.created_at,
          room: m.room_id,
          is_read: m.is_read
        })));

        // Mark messages as read in the database
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('room_id', roomId)
          .eq('receiver_id', currentUser.id);
      }
    };
    fetchHistory();

    // 2. Setup Real-time Listener (Directly from Database)
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const newMsg = payload.new;
        // Only add if it's from the OTHER user (since we add ours optimistically)
        if (newMsg.sender_username !== currentUser.username) {
          setMessages(prev => [...prev, {
            text: newMsg.content,
            user: newMsg.sender_username,
            timestamp: newMsg.created_at,
            room: newMsg.room_id
          }]);
        }
      })
      .subscribe();

    // 3. Keep Sockets for other features (optional)
    socketRef.current = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000');
    socketRef.current.emit('join-room', roomId, currentUser.id);

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
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

    // 1. Update UI immediately (Optimistic Update)
    setMessages(prev => [...prev, msgData]);

    // 2. Save to Supabase (Persistence)
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
      console.error('SUPABASE ERROR:', error.message);
      toast.error('Message failed to save to database');
    }

    // 3. Broadcast via Socket (Real-time)
    socketRef.current.emit('chat-message', msgData);
    setMessage('');
  };

  const handleClearChat = async () => {
    await supabase.from('messages').delete().eq('room_id', roomId);
    setMessages([]);
    setIsMenuOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      // Upload to Supabase Storage (Bucket must be named 'chat-media')
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Send the URL as a message
      setMessage(publicUrl);
      toast.success('File ready to send!');
    } catch (error: any) {
      toast.error('Upload failed: Make sure "chat-media" bucket exists in Supabase');
      console.error(error);
    }
  };

  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* WhatsApp Style Header */}
      <div className="p-3 border-b border-white/[0.05] flex items-center justify-between backdrop-blur-md bg-[#0a0a0b]/80 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          {/* Back Button */}
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors md:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
                {recipient.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0a0a0b] rounded-full ${recipient.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`}></div>
            </div>
            <div>
              <h2 className="text-white font-bold text-[16px] leading-tight">{recipient.username}</h2>
              <p className="text-[11px] text-gray-500 font-medium">
                {recipient.status === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-1" ref={menuRef}>
          <button className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
          </button>
          <button className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-12 w-48 bg-[#161618] border border-white/[0.1] rounded-2xl shadow-2xl py-2 z-50">
                <button 
                  onClick={handleClearChat}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors font-medium"
                >
                  Clear history
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((msg: any, i: number) => {
          const isOwn = msg.user === currentUser.username;
          const isImage = typeof msg.text === 'string' && msg.text.match(/\.(jpeg|jpg|gif|png|webp)/) != null;
          const isVideo = typeof msg.text === 'string' && msg.text.match(/\.(mp4|webm|ogg)/) != null;

          return (
            <div key={i} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              <div className="max-w-[85%]">
                <div className={`px-4 py-2 rounded-2xl ${
                  isOwn 
                    ? 'bg-purple-600 text-white rounded-tr-none shadow-lg shadow-purple-600/10' 
                    : 'bg-white/[0.05] border border-white/[0.05] text-gray-100 rounded-tl-none'
                }`}>
                  {isImage ? (
                    <img src={msg.text} alt="Shared media" className="max-w-full rounded-lg my-1 shadow-2xl" />
                  ) : isVideo ? (
                    <video src={msg.text} controls className="max-w-full rounded-lg my-1 shadow-2xl" />
                  ) : (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                </div>
                <span className={`text-[10px] text-gray-500 mt-1 block px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="p-4 bg-transparent relative">
        {/* ATTACHMENT MENU (WhatsApp Style) */}
        {isAttachmentMenuOpen && (
          <div 
            ref={attachmentMenuRef}
            className="absolute bottom-20 left-4 w-64 bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-2xl p-4 grid grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-200 z-[100]"
          >
            {[
              { label: 'Document', color: 'bg-indigo-500', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', accept: ".pdf,.doc,.docx,.txt,.zip" },
              { label: 'Camera', color: 'bg-pink-500', icon: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', accept: "image/*", capture: "environment" },
              { label: 'Gallery', color: 'bg-purple-500', icon: 'm22 13-1.29-1.29a2.41 2.41 0 0 0-3.42 0L12 17l-3.3-3.3a2.41 2.41 0 0 0-3.41 0L2 17', accept: "image/*,video/*" },
              { label: 'Audio', color: 'bg-orange-500', icon: 'M9 18V5l12-2v13', accept: "audio/*" },
              { label: 'Location', color: 'bg-green-500', icon: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', accept: "*" },
              { label: 'Contact', color: 'bg-blue-500', icon: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', accept: "*" },
            ].map((item: any, idx) => (
              <label key={idx} className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className={`w-12 h-12 ${item.color} rounded-full flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">{item.label}</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept={item.accept} 
                  capture={item.capture}
                  onChange={(e) => {
                    handleFileUpload(e);
                    setIsAttachmentMenuOpen(false);
                  }} 
                />
              </label>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full py-3.5 pl-12 pr-12 bg-white/[0.05] border border-white/[0.1] rounded-3xl focus:ring-2 focus:ring-purple-500/30 text-white placeholder-gray-500 outline-none"
              placeholder="Type a message..."
            />
            {/* Paperclip Button */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <button 
                type="button"
                onClick={() => setIsAttachmentMenuOpen(!isAttachmentMenuOpen)}
                className={`p-2 rounded-full transition-colors block ${isAttachmentMenuOpen ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
            </div>
          </div>
          <button 
            type="submit"
            className="p-3.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white active:scale-90 transition-all shadow-lg shadow-purple-600/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
