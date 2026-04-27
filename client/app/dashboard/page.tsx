'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FriendList from '@/components/FriendList';
import ChatBox from '@/components/ChatBox';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      router.push('/login');
    } else {
      setUser(JSON.parse(storedUser));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    router.push('/login');
  };

  if (!user) return <div className="h-screen bg-[#0a0a0b] flex items-center justify-center text-purple-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-gray-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-white/[0.02] border-r border-white/[0.05] backdrop-blur-xl flex flex-col">
        <div className="p-6 border-b border-white/[0.05] flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="font-bold text-white truncate max-w-[120px]">{user?.username}</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Online</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-red-500/10 text-gray-400 hover:text-red-400 border border-white/[0.05] hover:border-red-500/20 transition-all duration-300 group"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <FriendList onSelectUser={setSelectedUser} selectedUserId={selectedUser?.id} />
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.05)_0%,transparent_70%)]">
        {selectedUser ? (
          <ChatBox recipient={selectedUser} currentUser={user} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-6 shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500/50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Private Messaging</h2>
            <p className="text-gray-500 max-w-sm">
              Search for a user in the sidebar and click on their name to start a private conversation.
            </p>
          </div>
        )}
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
