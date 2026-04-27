'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import FriendList from '@/components/FriendList';
import ChatBox from '@/components/ChatBox';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const handleLogout = async () => {
    localStorage.removeItem('currentUser');
    router.push('/login');
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-80 bg-white border-r p-4">
        <h1 className="text-2xl font-bold mb-4">{user?.username || 'User'}</h1>
        <button onClick={handleLogout} className="w-full p-2 bg-red-500 text-white rounded mb-4">
          Logout
        </button>
        <FriendList />
      </aside>
      <main className="flex-1 p-4">
        <ChatBox />
      </main>
    </div>
  );
}
