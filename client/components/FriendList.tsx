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

  const filteredUsers = users.filter((u: any) => u.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-2">
      <input
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <ul>
        {filteredUsers.map((user: any) => (
          <li key={user.id} className="p-2 hover:bg-gray-100 rounded cursor-pointer flex justify-between">
            {user.username}
            <button onClick={() => sendFriendRequest(user.id)} className="ml-2 px-3 py-1 bg-blue-500 text-white text-sm rounded">
              Add Friend
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
