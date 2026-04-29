'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { encryptMessage, decryptMessage } from '@/lib/crypto';
import CallScreen from './CallScreen';

interface ChatBoxProps {
  recipient: any;
  currentUser: any;
  onBack?: () => void;
}

export default function ChatBox({ recipient, currentUser, onBack }: ChatBoxProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; file: File; type: 'image' | 'video' } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const [activeCallType, setActiveCallType] = useState<string | null>(recipient.incomingCallType ? `incoming-${recipient.incomingCallType}` : null);
  
  const channelRef = useRef<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomId = [currentUser.id, recipient.id].sort().join('--');

  const parseMessageContent = (encryptedContent: string, roomId: string) => {
    let parsedText = decryptMessage(encryptedContent, roomId);
    let replyData = null;
    let callData = null;
    try {
      const json = JSON.parse(parsedText);
      if (json.text !== undefined) {
        parsedText = json.text;
        replyData = json.replyTo;
        callData = json.callData;
      }
    } catch(e) {}
    return { text: parsedText, replyTo: replyData, callData };
  };

  useEffect(() => {
    if (recipient?.incomingCallType) {
      setActiveCallType(`incoming-${recipient.incomingCallType}`);
    } else {
      setActiveCallType(null);
    }
  }, [recipient]);

  useEffect(() => {
    const fetchHistory = async () => {
      // 1. INSTANT CACHE LOAD
      const cached = localStorage.getItem(`chat_${roomId}`);
      if (cached) {
        try {
          setMessages(JSON.parse(cached));
        } catch(e) {}
      }

      // 2. BACKGROUND FETCH
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        const formatted = data.map(m => {
          const parsed = parseMessageContent(m.content, roomId);
          return {
            id: m.id,
            text: parsed.text,
            replyTo: parsed.replyTo,
            callData: parsed.callData,
            user: m.sender_username,
            timestamp: m.created_at,
            room: m.room_id,
            is_read: m.is_read
          };
        });
        
        setMessages(formatted);
        localStorage.setItem(`chat_${roomId}`, JSON.stringify(formatted)); // Update cache

        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('room_id', roomId)
          .eq('receiver_id', currentUser.id);
      }
    };
    fetchHistory();

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const newMsg = payload.new;
        if (newMsg.sender_username !== currentUser.username) {
          const parsed = parseMessageContent(newMsg.content, roomId);
          setMessages(prev => {
            const next = [...prev, {
              id: newMsg.id,
              text: parsed.text,
              replyTo: parsed.replyTo,
              callData: parsed.callData,
              user: newMsg.sender_username,
              timestamp: newMsg.created_at,
              room: newMsg.room_id
            }];
            localStorage.setItem(`chat_${roomId}`, JSON.stringify(next));
            return next;
          });
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const deletedId = payload.old.id;
        setMessages(prev => prev.filter(m => m.id !== deletedId));
      })
      .subscribe();

    channelRef.current = channel;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [roomId, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim()) return;

    const payloadStr = JSON.stringify({
      text: message,
      replyTo: replyingTo ? { text: replyingTo.text, user: replyingTo.user } : null
    });

    const msgData = { 
      id: Math.random().toString(),
      room: roomId, 
      text: message, 
      replyTo: replyingTo,
      user: currentUser.username,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => {
      const next = [...prev, msgData];
      localStorage.setItem(`chat_${roomId}`, JSON.stringify(next));
      return next;
    });
    setMessage(''); 
    setReplyingTo(null);

    const { error } = await supabase
      .from('messages')
      .insert([{
        room_id: roomId,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        content: encryptMessage(payloadStr, roomId),
        receiver_id: recipient.id,
        is_read: false
      }]);

    if (error) {
      console.error('SUPABASE ERROR:', error.message);
      toast.error('Message failed to save to database');
    } else {
      try {
        const { data: userData } = await supabase.from('users').select('fcm_token').eq('id', recipient.id).single();
        if (userData?.fcm_token) {
          const isImage = message.match(/\.(jpeg|jpg|gif|png|webp)/) != null;
          const isVideo = message.match(/\.(mp4|webm|ogg)/) != null;
          const bodyText = isImage ? '📷 Sent an image' : isVideo ? '🎥 Sent a video' : message;
          
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: userData.fcm_token,
              title: `WeChat: ${currentUser.username}`,
              body: bodyText
            })
          });
        }
      } catch (pushErr) {}
    }
  };

  const handleClearChat = async () => {
    await supabase.from('messages').delete().eq('room_id', roomId);
    setMessages([]);
    setIsMenuOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith('video') ? 'video' : 'image';
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, file, type });
  };

  const sendMedia = async () => {
    if (!mediaPreview) return;
    setIsUploading(true);

    try {
      const fileExt = mediaPreview.file.name.split('.').pop() || (mediaPreview.type === 'video' ? 'mp4' : 'jpg');
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, mediaPreview.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      const payloadStr = JSON.stringify({
        text: publicUrl,
        replyTo: replyingTo ? { text: replyingTo.text, user: replyingTo.user } : null
      });

      const msgData = { 
        id: Math.random().toString(),
        room: roomId, 
        text: publicUrl, 
        replyTo: replyingTo,
        user: currentUser.username,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => {
        const next = [...prev, msgData];
        localStorage.setItem(`chat_${roomId}`, JSON.stringify(next));
        return next;
      });
      setMediaPreview(null);
      setIsUploading(false);
      setReplyingTo(null);

      await supabase.from('messages').insert([{
        room_id: roomId,
        sender_id: currentUser.id,
        sender_username: currentUser.username,
        content: encryptMessage(payloadStr, roomId),
        receiver_id: recipient.id,
        is_read: false
      }]);

      const { data: userData } = await supabase.from('users').select('fcm_token').eq('id', recipient.id).single();
      if (userData?.fcm_token) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: userData.fcm_token,
            title: `WeChat: ${currentUser.username}`,
            body: mediaPreview.type === 'video' ? '🎥 Sent a video' : '📷 Sent a photo'
          })
        });
      }
    } catch (error: any) {
      toast.error('Upload failed: Make sure "chat-media" bucket exists');
      setIsUploading(false);
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
      {selectedMessages.size > 0 ? (
        <div className="p-3 border-b border-white/[0.05] flex items-center justify-between bg-[#1f1633] backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedMessages(new Set())} className="p-2 hover:bg-white/10 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <span className="font-bold text-white text-[16px]">{selectedMessages.size} selected</span>
          </div>
          <div className="flex items-center gap-1">
            {selectedMessages.size === 1 && (
              <button 
                onClick={() => {
                  const id = Array.from(selectedMessages)[0];
                  const msg = messages.find(m => m.id === id);
                  if (msg) setReplyingTo(msg);
                  setSelectedMessages(new Set());
                }}
                className="p-2 text-white hover:bg-white/10 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              </button>
            )}
            <button onClick={async () => {
              const ids = Array.from(selectedMessages);
              await supabase.from('messages').delete().in('id', ids);
              setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
              setSelectedMessages(new Set());
            }} className="p-2 text-white hover:bg-white/10 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-white/[0.05] flex items-center justify-between backdrop-blur-md bg-[#0a0a0b]/80 sticky top-0 z-50">
          <div className="flex items-center gap-2">
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
              </div>
              <div>
                <h2 className="text-white font-bold text-[16px] leading-tight">{recipient.username}</h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1" ref={menuRef}>
            <button onClick={() => setActiveCallType('video')} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
            </button>
            <button onClick={() => setActiveCallType('audio')} className="p-2.5 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
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
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {messages.map((msg: any, i: number) => {
          const isOwn = msg.user === currentUser.username;
          const isImage = typeof msg.text === 'string' && msg.text.match(/\.(jpeg|jpg|gif|png|webp)/) != null;
          const isVideo = typeof msg.text === 'string' && msg.text.match(/\.(mp4|webm|ogg)/) != null;
          const isSelected = selectedMessages.has(msg.id);

          let pressTimer: any;
          const handleTouchStart = (e: any) => {
            pressTimer = setTimeout(() => {
              setSelectedMessages(prev => {
                const n = new Set(prev); n.add(msg.id); return n;
              });
              if (navigator.vibrate) navigator.vibrate(50);
            }, 400);
            e.target.dataset.startX = e.touches[0].clientX;
          };
          const handleTouchMove = (e: any) => {
            clearTimeout(pressTimer);
            const startX = parseFloat(e.target.dataset.startX || '0');
            const diff = e.touches[0].clientX - startX;
            if (diff > 0 && diff < 60) setSwipeOffset(prev => ({...prev, [msg.id]: diff}));
          };
          const handleTouchEnd = () => {
            clearTimeout(pressTimer);
            if ((swipeOffset[msg.id] || 0) > 40) setReplyingTo(msg);
            setSwipeOffset(prev => ({...prev, [msg.id]: 0}));
          };

          return (
            <div 
              key={msg.id || i} 
              className={`flex flex-col w-full transition-colors ${isSelected ? 'bg-purple-500/20' : ''}`}
              onClick={() => {
                if (selectedMessages.size > 0) {
                  setSelectedMessages(prev => {
                    const n = new Set(prev);
                    if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                    return n;
                  });
                }
              }}
            >
              <div 
                className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} px-2 py-0.5`}
                style={{ transform: `translateX(${swipeOffset[msg.id] || 0}px)`, transition: swipeOffset[msg.id] ? 'none' : 'transform 0.2s' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(e) => {
                  pressTimer = setTimeout(() => {
                    setSelectedMessages(prev => { const n = new Set(prev); n.add(msg.id); return n; });
                  }, 400);
                }}
                onMouseUp={() => clearTimeout(pressTimer)}
                onMouseLeave={() => clearTimeout(pressTimer)}
              >
                <div className="max-w-[85%] relative">
                  <div className={`px-2.5 pt-2 pb-1.5 rounded-2xl relative min-w-[80px] shadow-sm ${
                    isOwn 
                      ? 'bg-[#8235F8] text-white rounded-tr-none' 
                      : 'bg-[#1E1E20] border border-white/[0.05] text-gray-100 rounded-tl-none'
                  }`}>
                    {msg.replyTo && (
                      <div className="bg-black/20 rounded-md p-2 mb-1.5 border-l-4 border-purple-300 cursor-pointer">
                        <p className={`text-[11px] font-bold ${isOwn ? 'text-purple-200' : 'text-purple-400'}`}>{msg.replyTo.user}</p>
                        <p className="text-[12px] opacity-90 truncate max-w-[200px]">{msg.replyTo.text?.match(/\.(jpeg|jpg|gif|png|webp)/) ? '📷 Photo' : msg.replyTo.text}</p>
                      </div>
                    )}
                    
                    {isImage ? (
                      <div className="pb-4">
                        <img 
                          src={msg.text} 
                          onClick={(e) => { e.stopPropagation(); setFullscreenImage(msg.text); }}
                          className="max-w-full max-h-[300px] object-cover rounded-lg my-1 cursor-pointer" 
                        />
                      </div>
                    ) : isVideo ? (
                      <div className="pb-4">
                         <video src={msg.text} controls className="max-w-full rounded-lg my-1" />
                      </div>
                    ) : (msg.callData || msg.text?.includes('📞')) ? (
                      <div className="flex flex-col pb-[14px] pr-2 pt-1 min-w-[180px]">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOwn ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'}`}>
                            {msg.text?.includes('Video') || msg.callData?.isVideo || msg.callData?.type === 'video' ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-[15px]">{(msg.text?.includes('Video') || msg.callData?.isVideo || msg.callData?.type === 'video') ? 'Video Call' : 'Audio Call'}</span>
                            <span className={`text-[12px] ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                              {msg.callData?.status === 'ended' 
                                ? `Ended ${msg.callData.duration ? `(${msg.callData.duration})` : ''}` 
                                : 'Tap to join'}
                            </span>
                          </div>
                        </div>
                        {(!isOwn && msg.callData?.status !== 'ended') && (
                          <button 
                            onClick={(e) => {
                               e.stopPropagation();
                               setActiveCallType(`incoming-${(msg.text?.includes('Video') || msg.callData?.isVideo || msg.callData?.type === 'video') ? 'video' : 'audio'}`);
                            }}
                            className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-sm transition-colors"
                          >
                            Join Call
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words pb-[14px] pr-2">{msg.text}</p>
                    )}

                    <div className="absolute bottom-1.5 right-2 text-[10px] text-white/60 font-medium tracking-wide">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-transparent relative">
        {replyingTo && (
          <div className="px-4 pb-2 bg-transparent w-full z-10 animate-in slide-in-from-bottom-2 duration-200">
            <div className="bg-[#1C1C1E] border-l-4 border-purple-500 rounded-xl p-3 shadow-2xl flex items-center justify-between border border-white/[0.05]">
              <div className="min-w-0">
                <p className="text-purple-400 font-bold text-[12px]">{replyingTo.user}</p>
                <p className="text-gray-300 text-[13px] truncate max-w-full">{replyingTo.text?.match(/\.(jpeg|jpg|gif|png|webp)/) ? '📷 Photo' : replyingTo.text}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
        )}

        {isAttachmentMenuOpen && (
          <div 
            ref={attachmentMenuRef}
            className="absolute bottom-full mb-2 left-4 w-64 bg-[#1c1c1e] border border-white/[0.1] rounded-3xl shadow-2xl p-4 grid grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-200 z-[100]"
          >
            {[
              { label: 'Document', color: 'bg-indigo-500', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', accept: ".pdf,.doc,.docx,.txt,.zip" },
              { label: 'Camera', color: 'bg-pink-500', icon: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', accept: "image/*", capture: "environment" },
              { label: 'Gallery', color: 'bg-purple-500', icon: 'm22 13-1.29-1.29a2.41 2.41 0 0 0-3.42 0L12 17l-3.3-3.3a2.41 2.41 0 0 0-3.41 0L2 17', accept: "image/*,video/*" },
              { label: 'Audio', color: 'bg-orange-500', icon: 'M9 18V5l12-2v13', action: "toast" },
              { label: 'Location', color: 'bg-green-500', icon: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', action: "toast" },
              { label: 'Contact', color: 'bg-blue-500', icon: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', action: "toast" },
            ].map((item: any, idx) => (
              <label 
                key={idx} 
                className="flex flex-col items-center gap-2 cursor-pointer group"
                onClick={(e) => {
                  if (item.action === 'toast') {
                    e.preventDefault();
                    toast(`${item.label} sharing coming soon!`);
                    setIsAttachmentMenuOpen(false);
                  }
                }}
              >
                <div className={`w-12 h-12 ${item.color} rounded-full flex items-center justify-center text-white shadow-lg group-active:scale-90 transition-transform`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon}/></svg>
                </div>
                <span className="text-[10px] text-gray-400 font-medium">{item.label}</span>
                {item.action !== 'toast' && (
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
                )}
              </label>
            ))}
          </div>
        )}

        <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 pb-4">
          <div className="flex-1 relative">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full py-3.5 pl-12 pr-12 bg-white/[0.05] border border-white/[0.1] rounded-3xl focus:ring-2 focus:ring-purple-500/30 text-[16px] text-white placeholder-gray-500 outline-none"
              placeholder="Type a message..."
            />
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

      {mediaPreview && (
        <div className="absolute inset-0 bg-black/95 z-[200] flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black/50">
            <button onClick={() => setMediaPreview(null)} className="p-2 text-white rounded-full hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <span className="text-white font-medium">Preview</span>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.url} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
            ) : (
              <video src={mediaPreview.url} controls autoPlay loop className="max-w-full max-h-full rounded-xl shadow-2xl" />
            )}
          </div>
          <div className="p-6 bg-black/50 flex justify-end">
            <button 
              onClick={sendMedia} 
              disabled={isUploading}
              className="px-8 py-3.5 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-500/20 disabled:opacity-50"
            >
              {isUploading ? 'Sending...' : 'Send Media'}
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-2 animate-in fade-in zoom-in-95 duration-200"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            onClick={() => setFullscreenImage(null)} 
            className="absolute top-6 left-6 p-2 text-white bg-black/50 rounded-full hover:bg-white/20 backdrop-blur-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <img src={fullscreenImage} className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {activeCallType && channelRef.current && (
        <CallScreen 
          recipient={recipient}
          currentUser={currentUser}
          roomId={roomId}
          channel={channelRef.current}
          initialCallType={activeCallType}
          onEndCall={() => setActiveCallType(null)}
        />
      )}
    </div>
  );
}
