'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import FriendList from '@/components/FriendList';
import ChatBox from '@/components/ChatBox';
import { decryptMessage } from '@/lib/crypto';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (!storedUser) {
      router.push('/login');
    } else {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // 1. Mark as Online
      supabase.from('users').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', parsedUser.id).then();
      
      const presenceInterval = setInterval(() => {
        supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', parsedUser.id).then();
      }, 60000);

      // 2. Setup Global Message Listener for Notifications (Super Reliable)
      const channel = supabase
        .channel('global-chat-events')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages'
        }, (payload) => {
          const newMsg = payload.new;
          // Only notify if YOU are the receiver
          if (String(newMsg.receiver_id) === String(parsedUser.id)) {
            // Trigger Flutter Notification
            const decryptedContent = decryptMessage(newMsg.content, newMsg.room_id);
            if ((window as any).NotificationChannel) {
              (window as any).NotificationChannel.postMessage(`${newMsg.sender_username}: ${decryptedContent}`);
            }
          }
        })
        .subscribe();

      // 3. Expose FCM Token Setter for Flutter
      (window as any).setFCMToken = async (token: string) => {
        await supabase.from('users').update({ fcm_token: token }).eq('id', parsedUser.id);
      };

      // 4. Request Token from Flutter now that React is ready
      if ((window as any).FCMChannel) {
        (window as any).FCMChannel.postMessage('requestToken');
      }

      // 5. Set Offline on Close or Background (Mobile-Proof)
      const handleTabClose = () => {
        supabase.from('users').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', parsedUser.id).then();
      };
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          handleTabClose();
        } else if (document.visibilityState === 'visible') {
          supabase.from('users').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', parsedUser.id).then();
        }
      };

      window.addEventListener('beforeunload', handleTabClose);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(presenceInterval);
        supabase.removeChannel(channel);
        window.removeEventListener('beforeunload', handleTabClose);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    router.push('/login');
  };

  if (!user) return <div className="h-screen bg-[#0a0a0b] flex items-center justify-center text-purple-500">Loading...</div>;

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-gray-100 overflow-hidden font-sans">
      {/* Sidebar - Hidden on mobile if a user is selected */}
      <aside className={`w-full md:w-80 bg-white/[0.02] border-r border-white/[0.05] backdrop-blur-xl flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-white/[0.05] flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="font-bold text-white truncate max-w-[120px]">{user?.username}</h1>
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

      {/* Main Chat Area - Hidden on mobile if NO user is selected */}
      <main className={`flex-1 flex flex-col relative bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.05)_0%,transparent_70%)] ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
        {selectedUser ? (
          <ChatBox 
            recipient={selectedUser} 
            currentUser={user} 
            onBack={() => setSelectedUser(null)} 
          />
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
