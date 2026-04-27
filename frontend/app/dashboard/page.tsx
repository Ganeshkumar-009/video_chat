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
    supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
      }
    });
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0b] text-white">
      <div className="animate-pulse">Loading dashboard...</div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Sidebar */}
      <aside className="w-80 bg-white/[0.02] backdrop-blur-3xl border-r border-white/5 flex flex-col relative z-10 transition-all duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-500/20">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-semibold truncate max-w-[120px]">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                ONLINE
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <FriendList />
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative z-10 bg-black/20 backdrop-blur-sm">
        <ChatBox />
      </main>
    </div>
  );
}

