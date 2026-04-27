'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function FriendList() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*');
      setUsers(data || []);
    };
    fetchUsers();
  }, []);

  const sendFriendRequest = async (friendId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('friend_requests')
      .insert({
        from_id: user.id,
        to_id: friendId,
        status: 'pending'
      });
  };

  const filteredUsers = users.filter((u: any) => u.displayName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500 group-focus-within:text-purple-400 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/5 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 outline-none transition-all placeholder:text-gray-600 text-sm"
        />
      </div>
      
      <div className="space-y-1">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 mb-2">My Friends</h3>
        <ul className="space-y-1">
          {filteredUsers.length > 0 ? filteredUsers.map((user: any) => (
            <li 
              key={user.id} 
              className="group p-3 hover:bg-white/[0.05] rounded-xl cursor-pointer flex items-center justify-between transition-all duration-200 border border-transparent hover:border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-semibold text-gray-300">
                    {user.displayName?.[0] || user.email?.[0] || 'U'}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b0e11]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">{user.displayName || user.email?.split('@')[0] || 'Unknown'}</p>
                  <p className="text-[10px] text-gray-500">Available</p>
                </div>
              </div>
              <button 
                onClick={() => sendFriendRequest(user.id)} 
                className="opacity-0 group-hover:opacity-100 p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-lg transition-all text-xs font-medium"
              >
                Chat
              </button>
            </li>
          )) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm italic">No users found</p>
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}

