'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FriendList() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*');
      setUsers(data || []);
    };
    fetchUsers();
  }, []);

  const sendFriendRequest = async (friendId: string) => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) return;
    const currentUser = JSON.parse(storedUser);
    
    await supabase
      .from('friend_requests') // Assuming this table still exists or works similarly
      .insert({
        from_id: currentUser.id,
        to_id: friendId,
        status: 'pending'
      });
  };

  const filteredUsers = users.filter((u: any) => u.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 space-y-6">
      <div className="relative group">
        <input
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 text-sm text-white placeholder-gray-500 transition-all duration-300 outline-none"
        />
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>

      <div className="space-y-1">
        <h3 className="px-2 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">All Users ({filteredUsers.length})</h3>
        <div className="space-y-1">
          {filteredUsers.map((user: any) => (
            <div 
              key={user.id} 
              className="group p-3 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.03] rounded-2xl cursor-pointer flex items-center justify-between transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-purple-400 transition-colors">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0a0a0b] rounded-full ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{user.username}</div>
                  <div className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">{user.status || 'Offline'}</div>
                </div>
              </div>
              <button 
                onClick={() => sendFriendRequest(user.id)} 
                className="opacity-0 group-hover:opacity-100 p-2 rounded-lg bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white transition-all duration-300"
                title="Add Friend"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
