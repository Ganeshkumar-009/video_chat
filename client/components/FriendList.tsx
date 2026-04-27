'use client';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

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
        // Using a simpler query format to avoid any .or() issues
        const { data: sentMsgs } = await supabase.from('messages').select('receiver_id, is_read, created_at').eq('sender_id', curr.id);
        const { data: receivedMsgs } = await supabase.from('messages').select('sender_id, is_read, created_at').eq('receiver_id', curr.id);

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

        // Map IDs back to user objects
        const recents = Array.from(participantIds)
          .map(id => usersList.find(u => String(u.id) === id))
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
        setRecentUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const newMsg = payload.new as any;
        // If YOU are the receiver, increment unread count
        if (String(newMsg.receiver_id) === String(curr?.id)) {
          toast(`New message from ${newMsg.sender_username}`, { icon: '💬' });
          setUnreadCounts(prev => ({
            ...prev,
            [String(newMsg.sender_id)]: (prev[String(newMsg.sender_id)] || 0) + 1
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, []);

  const filteredSearch = search.trim() === '' 
    ? [] 
    : allUsers.filter((u: any) => 
        u.username?.toLowerCase().includes(search.toLowerCase()) && 
        u.id !== currentUser?.id
      );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4">
      <div className="relative group">
        <input
          placeholder="Search for people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl focus:ring-2 focus:ring-purple-500/30 text-[16px] text-white placeholder-gray-500 outline-none"
        />
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>
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
                onClick={() => { 
                  onSelectUser(user); 
                  setSearch(''); 
                  setUnreadCounts(prev => ({...prev, [String(user.id)]: 0})); 
                }} 
                unreadCount={unreadCounts[user.id] || 0}
              />
            ))}
            {filteredSearch.length === 0 && (
              <p className="text-[11px] text-gray-600 px-4 py-4 italic">No matches found</p>
            )}
          </div>
        )}

        {/* Recent Chats or All Users (Nuclear Fix) */}
        {search.trim() === '' && (
          <div>
            {(recentUsers.length > 0 ? recentUsers : allUsers.filter(u => String(u.id) !== String(currentUser?.id))).map((user: any) => (
              <UserItem 
                key={user.id} 
                user={user} 
                isSelected={selectedUserId === user.id} 
                onClick={() => { 
                  onSelectUser(user); 
                  setUnreadCounts(prev => ({...prev, [String(user.id)]: 0})); 
                }} 
                unreadCount={unreadCounts[String(user.id)] || 0}
              />
            ))}
            {allUsers.length <= 1 && recentUsers.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center opacity-20 px-10">
                 <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-purple-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                 <p className="text-[12px] font-bold tracking-widest text-center uppercase">Waiting for users to join...</p>
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
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function UserItem({ user, isSelected, onClick, unreadCount }: { user: any, isSelected: boolean, onClick: () => void, unreadCount: number }) {
  return (
    <div 
      onClick={onClick}
      className={`group px-4 py-3 flex items-center gap-4 cursor-pointer transition-all duration-200 border-b border-white/[0.03] ${
        isSelected 
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
        <div className={`absolute bottom-0 right-1 w-3.5 h-3.5 border-[3px] border-[#0a0a0b] rounded-full ${user.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`}></div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <div className={`text-[16px] font-bold truncate transition-colors ${
            unreadCount > 0 ? 'text-green-500 font-black' : isSelected ? 'text-white' : 'text-gray-100 group-hover:text-white'
          }`}>
            {user.username}
          </div>
          <span className={`text-[11px] font-medium ${unreadCount > 0 ? 'text-green-500' : 'text-gray-500'}`}>
            {unreadCount > 0 ? 'New message' : 'Just now'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className={`text-[13px] truncate ${isSelected ? 'text-purple-300/70' : 'text-gray-500 group-hover:text-gray-400'}`}>
            {user.status === 'online' ? 'Active now' : `Last seen ${getTimeAgo(user.last_seen)}`}
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
