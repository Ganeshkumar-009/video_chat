'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface FriendListProps {
  onSelectUser: (user: any) => void;
  selectedUserId?: string;
}

export default function FriendList({ onSelectUser, selectedUserId }: FriendListProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*');
      setUsers(data || []);
    };
    fetchUsers();
  }, []);

  // Filter users based on search, and exclude the current user
  const filteredUsers = search.trim() === '' 
    ? [] 
    : users.filter((u: any) => 
        u.username?.toLowerCase().includes(search.toLowerCase()) && 
        u.id !== currentUser?.id
      );

  return (
    <div className="p-4 space-y-6">
      <div className="relative group">
        <input
          placeholder="Search for users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 text-sm text-white placeholder-gray-500 transition-all duration-300 outline-none"
        />
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>

      <div className="space-y-1">
        {search.trim() !== '' && filteredUsers.length > 0 && (
          <h3 className="px-2 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Search Results</h3>
        )}
        
        <div className="space-y-1">
          {filteredUsers.map((user: any) => (
            <div 
              key={user.id} 
              onClick={() => onSelectUser(user)}
              className={`group p-3 border border-transparent rounded-2xl cursor-pointer flex items-center justify-between transition-all duration-200 ${
                selectedUserId === user.id 
                  ? 'bg-purple-600/10 border-purple-500/20' 
                  : 'hover:bg-white/[0.03] hover:border-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-white/[0.05] border flex items-center justify-center text-xs font-bold transition-colors ${
                    selectedUserId === user.id ? 'border-purple-500/30 text-purple-400' : 'border-white/[0.1] text-gray-400 group-hover:text-purple-400'
                  }`}>
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0a0a0b] rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                </div>
                <div>
                  <div className={`text-sm font-semibold transition-colors ${selectedUserId === user.id ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
                    {user.username}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">{user.status || 'Offline'}</div>
                </div>
              </div>
            </div>
          ))}

          {search.trim() !== '' && filteredUsers.length === 0 && (
            <p className="text-center py-8 text-xs text-gray-600 italic">No users found for "{search}"</p>
          )}

          {search.trim() === '' && (
            <div className="py-12 flex flex-col items-center justify-center opacity-30">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <p className="text-[10px] font-bold uppercase tracking-widest text-center px-4">Start by searching above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
