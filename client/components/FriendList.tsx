'use client';
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    const fetchData = async () => {
      // 1. Fetch all users
      const { data: usersData } = await supabase.from('users').select('*');
      const usersList = usersData || [];
      setAllUsers(usersList);

      // 2. Fetch recent chat participants from messages table
      if (storedUser) {
        const curr = JSON.parse(storedUser);
        const { data: msgData } = await supabase
          .from('messages')
          .select('sender_id, receiver_id')
          .or(`sender_id.eq.${curr.id},receiver_id.eq.${curr.id}`);

        if (msgData) {
          const participantIds = new Set();
          msgData.forEach((m: any) => {
            if (m.sender_id !== curr.id) participantIds.add(m.sender_id);
            if (m.receiver_id !== curr.id) participantIds.add(m.receiver_id);
          });

          const recents = usersList.filter(u => participantIds.has(u.id));
          setRecentUsers(recents);
        }
      }
    };
    fetchData();
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
          onKeyDown={(e) => { if(e.key === 'Enter') setSearch(search); }}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 text-sm text-white placeholder-gray-500 transition-all duration-300 outline-none"
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
                onClick={() => { onSelectUser(user); setSearch(''); }} 
              />
            ))}
            {filteredSearch.length === 0 && (
              <p className="text-[11px] text-gray-600 px-4 py-4 italic">No matches found</p>
            )}
          </div>
        )}

        {/* Recent Chats Section */}
        {search.trim() === '' && (
          <div>
            {recentUsers.length > 0 ? (
              recentUsers.map((user: any) => (
                <UserItem 
                  key={user.id} 
                  user={user} 
                  isSelected={selectedUserId === user.id} 
                  onClick={() => onSelectUser(user)} 
                />
              ))
            ) : (
              <div className="py-20 flex flex-col items-center justify-center opacity-20 px-10">
                 <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-purple-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                 <p className="text-[12px] font-bold tracking-widest text-center uppercase">Start a new conversation</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserItem({ user, isSelected, onClick }: { user: any, isSelected: boolean, onClick: () => void }) {
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
        <div className={`absolute bottom-0 right-1 w-3.5 h-3.5 border-[3px] border-[#0a0a0b] rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <div className={`text-[16px] font-bold truncate transition-colors ${isSelected ? 'text-white' : 'text-gray-100 group-hover:text-white'}`}>
            {user.username}
          </div>
          <span className="text-[11px] text-gray-500 font-medium">Just now</span>
        </div>
        <div className="flex items-center justify-between">
          <div className={`text-[13px] truncate ${isSelected ? 'text-purple-300/70' : 'text-gray-500 group-hover:text-gray-400'}`}>
            {user.status === 'online' ? 'Active now' : 'Last seen recently'}
          </div>
        </div>
      </div>
    </div>
  );
}
