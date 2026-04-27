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
    <div className="p-4 space-y-6">
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

      <div className="space-y-6">
        {/* Search Results Section */}
        {search.trim() !== '' && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
            <h3 className="px-2 pb-2 text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">Search Results</h3>
            <div className="space-y-1">
              {filteredSearch.map((user: any) => (
                <UserItem 
                  key={user.id} 
                  user={user} 
                  isSelected={selectedUserId === user.id} 
                  onClick={() => { onSelectUser(user); setSearch(''); }} 
                />
              ))}
              {filteredSearch.length === 0 && (
                <p className="text-[10px] text-gray-600 px-2 italic">No matches found</p>
              )}
            </div>
          </div>
        )}

        {/* Recent Chats Section */}
        {search.trim() === '' && (
          <div className="space-y-1">
            <h3 className="px-2 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Recent Messages</h3>
            <div className="space-y-1">
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
                <div className="py-12 flex flex-col items-center justify-center opacity-20">
                   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-purple-400"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                   <p className="text-[10px] font-bold tracking-widest text-center px-4 uppercase">No conversations yet</p>
                </div>
              )}
            </div>
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
      className={`group p-3 border border-transparent rounded-2xl cursor-pointer flex items-center gap-3 transition-all duration-200 ${
        isSelected 
          ? 'bg-purple-600/10 border-purple-500/20' 
          : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className="relative">
        <div className={`w-10 h-10 rounded-full bg-white/[0.05] border flex items-center justify-center text-xs font-bold transition-colors ${
          isSelected ? 'border-purple-500/30 text-purple-400' : 'border-white/[0.1] text-gray-400 group-hover:text-purple-400'
        }`}>
          {user.username?.[0]?.toUpperCase()}
        </div>
        <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0a0a0b] rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
      </div>
      <div>
        <div className={`text-sm font-semibold transition-colors ${isSelected ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
          {user.username}
        </div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">{user.status || 'Offline'}</div>
      </div>
    </div>
  );
}
