'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { decryptMessage } from '@/lib/crypto';

interface FriendListProps {
  onSelectUser: (user: any) => void;
  selectedUserId?: string;
}

export default function FriendList({ onSelectUser, selectedUserId }: FriendListProps) {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [longPressedUserId, setLongPressedUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    let curr: any = null;
    if (storedUser) {
      curr = JSON.parse(storedUser);
      setCurrentUser(curr);
    }

    const fetchData = async () => {
      try {
        // 1. Get current user session
        const storedUser = localStorage.getItem('currentUser');
        if (!storedUser) return;
        const curr = JSON.parse(storedUser);
        setCurrentUser(curr);

        // 2. Fetch ALL users first
        const { data: usersData } = await supabase.from('users').select('*');
        const usersList = usersData || [];
        setAllUsers(usersList);

        // 3. Fetch messages where you are either sender or receiver
        const { data: sentMsgs } = await supabase.from('messages').select('sender_id, receiver_id, is_read, created_at, content').eq('sender_id', curr.id);
        const { data: receivedMsgs } = await supabase.from('messages').select('sender_id, receiver_id, is_read, created_at, content').eq('receiver_id', curr.id);

        const allMsgs = [...(sentMsgs || []), ...(receivedMsgs || [])];
        
        // Sort by most recent
        allMsgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const participantIds = new Set<string>();
        const unreads: Record<string, number> = {};
        
        allMsgs.forEach((m: any) => {
          const sId = String(m.sender_id || '');
          const rId = String(m.receiver_id || '');
          const cId = String(curr.id);

          const otherId = sId === cId ? rId : sId;
          
          if (otherId && otherId !== cId && otherId !== 'undefined') {
            participantIds.add(otherId);
            
            // Count if you are the receiver AND it's not read
            if (rId === cId && (m.is_read === false || m.is_read === null)) {
              unreads[otherId] = (unreads[otherId] || 0) + 1;
            }
          }
        });

        // Decrypt helper for previews
        const decryptPreview = (text: string, roomId: string) => {
          if (!text) return '';
          try {
            let dec = decryptMessage(text, roomId);
            try {
              const json = JSON.parse(dec);
              if (json.text !== undefined) dec = json.text;
            } catch(e) {}
            
            if (dec.includes('chat-media') || dec.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|mov)/i)) {
              return dec.match(/\.(mp4|webm|mov)/i) ? '🎥 Video' : '📷 Photo';
            }
            return dec;
          } catch (e) {
            return 'Message';
          }
        };

        // Map IDs back to user objects with last message info
        const recents = Array.from(participantIds)
          .map(id => {
            const u = usersList.find(u => String(u.id) === id);
            if (!u) return null;
            
            const lastMsg = allMsgs.find((m: any) => 
              (String(m.sender_id) === id && String(m.receiver_id) === String(curr.id)) ||
              (String(m.sender_id) === String(curr.id) && String(m.receiver_id) === id)
            );

            const roomId = [curr.id, id].sort().join('--');

            return {
              ...u,
              lastMessageText: lastMsg ? decryptPreview(lastMsg.content, roomId) : null,
              lastMessageTime: lastMsg ? lastMsg.created_at : null
            };
          })
          .filter(Boolean);

        setRecentUsers(recents as any[]);
        setUnreadCounts(unreads);
      } catch (err) {
        console.error("Fetch Error:", err);
      }
    };
    fetchData();

    // 3. Real-time Status & Unread Listener
    const statusChannel = supabase
      .channel('user-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        const updatedUser = payload.new as any;
        setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setRecentUsers(prev => prev.map(u => u.id === updatedUser.id ? {
          ...updatedUser,
          lastMessageText: u.lastMessageText,
          lastMessageTime: u.lastMessageTime
        } : u));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;
        
        setRecentUsers(prev => {
          let updated = false;
          const newPrev = prev.map(u => {
            if (String(u.id) === String(newMsg.sender_id) || String(u.id) === String(newMsg.receiver_id)) {
              updated = true;
              const roomId = [curr.id, u.id].sort().join('--');
              let decText = decryptMessage(newMsg.content, roomId);
              try {
                const json = JSON.parse(decText);
                if (json.text !== undefined) decText = json.text;
              } catch(e) {}
              
              const preview = (decText.includes('chat-media') || decText.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|mov)/i)) 
                ? (decText.match(/\.(mp4|webm|mov)/i) ? '🎥 Video' : '📷 Photo') 
                : decText;
              return { ...u, lastMessageText: preview, lastMessageTime: newMsg.created_at };
            }
            return u;
          });

          // Sort by lastMessageTime descending
          newPrev.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
          return newPrev;
        });

        // If YOU are the receiver, increment unread count
        if (String(newMsg.receiver_id) === String(curr?.id)) {
          toast(`New message from ${newMsg.sender_username}`, { icon: '💬' });
          setUnreadCounts(prev => ({
            ...prev,
            [String(newMsg.sender_id)]: (prev[String(newMsg.sender_id)] || 0) + 1
          }));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updatedMsg = payload.new as any;
        setRecentUsers(prev => prev.map(u => {
          if (String(u.id) === String(updatedMsg.sender_id) || String(u.id) === String(updatedMsg.receiver_id)) {
            const roomId = [curr.id, u.id].sort().join('--');
            let decText = decryptMessage(updatedMsg.content, roomId);
            try {
              const json = JSON.parse(decText);
              if (json.text !== undefined) decText = json.text;
            } catch(e) {}
            
            const preview = (decText.includes('chat-media') || decText.match(/\.(jpeg|jpg|gif|png|webp|mp4|webm|mov)/i)) 
              ? (decText.match(/\.(mp4|webm|mov)/i) ? '🎥 Video' : '📷 Photo') 
              : decText;
            return { ...u, lastMessageText: preview };
          }
          return u;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, []);

  // Force clear unread count for the currently selected user
  useEffect(() => {
    if (selectedUserId && currentUser?.id) {
      setUnreadCounts(prev => {
        if (prev[String(selectedUserId)] === 0) return prev;
        return { ...prev, [String(selectedUserId)]: 0 };
      });
      const roomId = [currentUser.id, selectedUserId].sort().join('--');
      supabase.from('messages').update({ is_read: true }).eq('room_id', roomId).eq('receiver_id', currentUser.id).then();
    }
  }, [selectedUserId, currentUser?.id]);

  const filteredSearch = search.trim() === '' 
    ? [] 
    : allUsers.filter((u: any) => 
        u.username?.toLowerCase().includes(search.toLowerCase()) && 
        u.id !== currentUser?.id
      );

  const handleDeleteChat = async () => {
    if (!longPressedUserId || !currentUser) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this chat history?");
    if (!confirmDelete) {
      setLongPressedUserId(null);
      return;
    }

    try {
      const roomId = [currentUser.id, longPressedUserId].sort().join('--');
      await supabase.from('messages').delete().eq('room_id', roomId);
      
      setLongPressedUserId(null);
      toast.success("Chat deleted");
      
      setRecentUsers(prev => prev.filter(u => String(u.id) !== longPressedUserId));
      if (selectedUserId === longPressedUserId) {
        onSelectUser(null);
      }
    } catch (err) {
      toast.error("Failed to delete chat");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
        {longPressedUserId ? (
          <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <button onClick={() => setLongPressedUserId(null)} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span className="text-white text-[15px] font-medium">1 Selected</span>
            </div>
            <button onClick={handleDeleteChat} className="text-red-400 hover:text-red-300 flex items-center gap-1.5 p-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ) : (
          <div className="relative group">
            <input
              placeholder="Search for people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl focus:ring-2 focus:ring-purple-500/30 text-[16px] text-white placeholder-gray-500 outline-none"
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search Results Section */}
        {search.trim() !== '' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            {filteredSearch.map((user: any) => (
              <UserItem 
                key={user.id} 
                user={user} 
                isSelected={selectedUserId === user.id} 
                isLongPressed={longPressedUserId === String(user.id)}
                onClick={() => { 
                  if (longPressedUserId) {
                    setLongPressedUserId(String(user.id) === longPressedUserId ? null : String(user.id));
                    return;
                  }
                  onSelectUser(user); 
                  setSearch(''); 
                  setUnreadCounts(prev => ({...prev, [String(user.id)]: 0})); 
                }} 
                onLongPress={() => setLongPressedUserId(String(user.id))}
                unreadCount={unreadCounts[user.id] || 0}
              />
            ))}
            {filteredSearch.length === 0 && (
              <p className="text-[11px] text-gray-600 px-4 py-4 italic">No matches found</p>
            )}
          </div>
        )}

        {/* Recent Chats Only */}
        {search.trim() === '' && (
          <div>
            {recentUsers.map((user: any) => (
              <UserItem 
                key={user.id} 
                user={user} 
                isSelected={selectedUserId === user.id} 
                isLongPressed={longPressedUserId === String(user.id)}
                onClick={() => { 
                  if (longPressedUserId) {
                    setLongPressedUserId(String(user.id) === longPressedUserId ? null : String(user.id));
                    return;
                  }
                  onSelectUser(user); 
                  setUnreadCounts(prev => ({...prev, [String(user.id)]: 0})); 
                }} 
                onLongPress={() => setLongPressedUserId(String(user.id))}
                unreadCount={unreadCounts[String(user.id)] || 0}
              />
            ))}
            {recentUsers.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center opacity-50 px-10 animate-in fade-in duration-500">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-purple-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                 <p className="text-[14px] font-medium tracking-wide text-center text-white">No recent chats</p>
                 <p className="text-[12px] text-gray-400 text-center mt-1.5">Search for friends above to start messaging!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string) {
  if (!dateStr) return 'Offline';
  const date = new Date(dateStr);
  const today = new Date();
  
  if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
    // Format as 16:04
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  
  // If it's not today, return date
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function UserItem({ user, isSelected, isLongPressed, onClick, onLongPress, unreadCount }: { user: any, isSelected: boolean, isLongPressed: boolean, onClick: () => void, onLongPress: () => void, unreadCount: number }) {

  let pressTimer: any;
  const handleTouchStart = () => {
    pressTimer = setTimeout(() => {
      onLongPress();
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };
  const handleTouchEnd = () => clearTimeout(pressTimer);

  return (
    <div 
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      className={`group px-4 py-3 flex items-center gap-4 cursor-pointer transition-all duration-200 border-b border-white/[0.03] ${
        isLongPressed 
          ? 'bg-red-500/10 border-red-500/20' 
          : isSelected 
            ? 'bg-purple-600/10' 
            : 'hover:bg-white/[0.02]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 border flex items-center justify-center text-lg font-bold transition-all duration-300 ${
          isSelected ? 'border-purple-500 shadow-lg shadow-purple-500/20 text-purple-400' : 'border-white/[0.1] text-gray-400 group-hover:border-purple-500/50 group-hover:text-purple-400'
        }`}>
          {user.username?.[0]?.toUpperCase()}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <div className={`text-[16px] font-bold truncate transition-colors ${
            unreadCount > 0 ? 'text-green-500 font-black' : isSelected ? 'text-white' : 'text-gray-100 group-hover:text-white'
          }`}>
            {user.username}
          </div>
          <span className={`text-[11px] font-medium ${unreadCount > 0 ? 'text-green-500' : 'text-gray-500'}`}>
            {unreadCount > 0 ? 'New message' : (user.lastMessageTime ? getTimeAgo(user.lastMessageTime) : 'Just now')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className={`text-[13px] truncate ${unreadCount > 0 ? 'text-green-500 font-semibold' : isSelected ? 'text-purple-300/70' : 'text-gray-500 group-hover:text-gray-400'}`}>
            {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : (user.lastMessageText || 'Tap to chat...')}
          </div>
          {unreadCount > 0 && (
            <div className="bg-green-500 text-black text-[11px] font-black min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 animate-pulse">
              {unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
