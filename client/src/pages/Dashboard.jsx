import React, { useState, useEffect, useRef } from 'react';
import { Search, Phone, Video, LogOut, Send, MoreVertical, Paperclip, Smile } from 'lucide-react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const ENDPOINT = 'http://localhost:5000';

export default function Dashboard({ user, onLogout }) {
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserRef = useRef(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);
  
  // Messaging State
  const [messages, setMessages] = useState({}); // { userId: [messages] }
  const [unreadCounts, setUnreadCounts] = useState({}); // { userId: count }
  const [activeChats, setActiveChats] = useState([]); // Array of user objects
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [remoteIsTyping, setRemoteIsTyping] = useState(false);

  // WebRTC State
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);

  const socketRef = useRef();
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const chatEndRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(ENDPOINT);
    socketRef.current.emit('setup', user);

    socketRef.current.on('receiveMessage', (message) => {
      const senderId = message.senderId;
      
      setMessages(prev => ({
        ...prev,
        [senderId]: [...(prev[senderId] || []), message]
      }));

      // Update active chats if not already there
      setActiveChats(prev => {
        const existing = prev.find(c => c.id === senderId);
        if (!existing) {
           return [{ id: senderId, username: message.senderName || 'User', status: 'online', lastMessage: message.text }, ...prev];
        } else {
           // Update last message
           return prev.map(c => c.id === senderId ? { ...c, lastMessage: message.text } : c);
        }
      });

      // Increment unread count if this user is not the selected one
      if (!selectedUserRef.current || (selectedUserRef.current.id !== senderId)) {
        setUnreadCounts(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }));
      }
    });

    socketRef.current.on('typing', (data) => {
       if (selectedUserRef.current?.id === data.senderId) {
          setRemoteIsTyping(true);
       }
    });

    socketRef.current.on('stopTyping', () => setRemoteIsTyping(false));

    socketRef.current.on('callUser', (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerName(data.name);
      setCallerSignal(data.signal);
    });

    // Fetch recent chats on load
    const fetchRecent = async () => {
        try {
            const res = await fetch(`${ENDPOINT}/api/messages/recent/${user.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setActiveChats(data);
                
                // Map unread counts
                const counts = {};
                data.forEach(chat => {
                    if (chat.unreadCount > 0) counts[chat.id] = chat.unreadCount;
                });
                setUnreadCounts(counts);
            } else {
                console.error("Recent chats data is not an array:", data);
            }
        } catch (err) {
            console.error("Failed to fetch recent chats", err);
        }
    };
    fetchRecent();

    return () => {
      socketRef.current.disconnect();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [user.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser]);

  const searchUsers = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/users/search?query=${query}`);
      const data = await res.json();
      setSearchResults(data.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Search error', err);
    }
  };

  const handleSelectUser = async (u) => {
    setSelectedUser(u);
    // Add to active chats if not present
    if (!activeChats.find(c => c.id === u.id)) {
      setActiveChats([u, ...activeChats]);
    }

    // Mark as read in DB
    try {
        await fetch(`${ENDPOINT}/api/messages/read/${user.id}/${u.id}`, { method: 'PATCH' });
        setUnreadCounts(prev => ({ ...prev, [u.id]: 0 }));
    } catch (err) {
        console.error("Failed to mark read", err);
    }

    // Fetch message history
    try {
        const otherId = u.id;
        const res = await fetch(`${ENDPOINT}/api/messages/history/${user.id}/${otherId}`);
        const history = await res.json();
        
        // Transform Supabase snake_case to frontend camelCase if necessary
        const formattedHistory = history.map(m => ({
            senderId: m.sender_id,
            receiverId: m.receiver_id,
            text: m.text,
            timestamp: m.created_at
        }));

        setMessages(prev => ({
            ...prev,
            [otherId]: formattedHistory
        }));
    } catch (err) {
        console.error("Failed to fetch history", err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const currentUserId = user.id || user._id;
    const targetUserId = selectedUser.id || selectedUser._id;

    const messageData = {
      senderId: currentUserId,
      senderName: user.username,
      receiverId: targetUserId,
      text: newMessage,
      timestamp: new Date().toISOString()
    };

    socketRef.current.emit('sendMessage', messageData);
    setMessages(prev => ({
      ...prev,
      [targetUserId]: [...(prev[targetUserId] || []), messageData]
    }));
    setNewMessage('');
    socketRef.current.emit('stopTyping', { receiverId: targetUserId });
  };

  const onTyping = (e) => {
    setNewMessage(e.target.value);
    if (!selectedUser) return;
    
    if (!isTyping) {
        setIsTyping(true);
        socketRef.current.emit('typing', { receiverId: selectedUser.id, senderId: user.id });
    }

    setTimeout(() => {
        setIsTyping(false);
        socketRef.current.emit('stopTyping', { receiverId: selectedUser.id });
    }, 3000);
  };

  const getMediaStream = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;
      return currentStream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      alert("Please allow camera and microphone access to start a call.");
    }
  };

  const callUser = async () => {
    const localStream = await getMediaStream();
    if (!localStream) return;

    const idToCall = selectedUser.id || selectedUser._id;
    const peer = new Peer({ initiator: true, trickle: false, stream: localStream });

    peer.on('signal', (data) => {
      socketRef.current.emit('callUser', {
        userToCall: idToCall,
        signalData: data,
        from: user.id || user._id,
        name: user.username
      });
    });

    peer.on('stream', (userStream) => {
      if (userVideo.current) userVideo.current.srcObject = userStream;
    });

    socketRef.current.on('callAccepted', (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = async () => {
    const localStream = await getMediaStream();
    if (!localStream) return;

    setCallAccepted(true);
    const peer = new Peer({ initiator: false, trickle: false, stream: localStream });

    peer.on('signal', (data) => {
      socketRef.current.emit('answerCall', { signal: data, to: caller });
    });

    peer.on('stream', (userStream) => {
      if (userVideo.current) userVideo.current.srcObject = userStream;
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (connectionRef.current) connectionRef.current.destroy();
    window.location.reload();
  };

  const currentChatMessages = messages[selectedUser?.id] || [];

  return (
    <div className="flex h-screen bg-[#0b0c14] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-white/5 bg-[#141624] flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2 overflow-hidden relative shadow-sm">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-50"></div>
            <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20">
                    {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                   <div className="font-bold text-sm tracking-tight">{user?.username}</div>
                   <div className="text-[10px] text-green-400 font-medium flex items-center">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span> Online
                   </div>
                </div>
            </div>
            <button onClick={onLogout} className="text-gray-400 hover:text-white transition-all hover:rotate-12 p-2">
                <LogOut className="w-5 h-5" />
            </button>
        </div>

        <div className="p-4 bg-white/2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4 group-focus-within:text-purple-400 transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={searchUsers}
              placeholder="Search people..." 
              className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/5 rounded-xl focus:outline-none focus:border-purple-500/50 text-sm transition-all text-white placeholder:text-gray-600 focus:ring-4 focus:ring-purple-500/5"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-2 flex justify-between items-center">
              <span>{searchQuery ? 'Search Results' : 'Recent Chats'}</span>
              <span className="bg-white/5 px-2 py-0.5 rounded-full text-[8px] tracking-normal">{searchQuery ? searchResults.length : activeChats.length}</span>
          </h3>
          
          {(searchQuery ? searchResults : activeChats).map(contact => {
            const cid = contact._id || contact.id;
            const unread = unreadCounts[cid] || 0;
            const isSelected = selectedUser?.id === cid;
            
            return (
              <div 
                  key={cid} 
                  onClick={() => handleSelectUser(contact)}
                  className={`group flex items-center space-x-3 p-3 rounded-2xl transition-all cursor-pointer border ${isSelected ? 'bg-purple-600/10 border-purple-500/30 shadow-lg shadow-purple-500/5' : 'hover:bg-white/5 border-transparent'}`}
              >
                  <div className="relative">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg ${isSelected ? 'bg-purple-600' : 'bg-gradient-to-br from-indigo-600 to-purple-600'}`}>
                      {contact.username.charAt(0).toUpperCase()}
                    </div>
                    {unread > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center border-2 border-[#141624] animate-bounce shadow-lg">
                        {unread}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#141624] ${contact.status === 'online' ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${unread > 0 ? 'text-white' : 'text-gray-100'}`}>{contact.username}</p>
                    <p className="text-[10px] text-gray-500 truncate font-medium">
                      {messages[cid]?.length > 0 ? messages[cid][messages[cid].length-1].text : 'Click to start chat'}
                    </p>
                  </div>
              </div>
            );
          })}
          
          {!searchQuery && activeChats.length === 0 && (
             <div className="text-center p-8 bg-white/2 rounded-3xl border border-dashed border-white/5 mt-4">
                <Video className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <div className="text-gray-600 text-[10px] font-black uppercase tracking-widest">No active chats</div>
                <div className="text-gray-500 text-[10px] mt-1">Search to find someone</div>
             </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-[#0b0c14] relative">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#141624]/30 backdrop-blur-xl z-20 shrink-0">
                <div className="flex items-center space-x-4">
                   <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-bold shadow-lg shadow-purple-500/20">
                      {selectedUser.username.charAt(0).toUpperCase()}
                   </div>
                   <div>
                      <h2 className="font-bold text-base leading-tight tracking-tight">{selectedUser.username}</h2>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${remoteIsTyping ? 'text-green-400 animate-pulse' : 'text-purple-400'}`}>
                         {remoteIsTyping ? 'Typing...' : (selectedUser.status || 'Active')}
                      </p>
                   </div>
                </div>
                <div className="flex items-center space-x-3">
                   <button onClick={callUser} className="p-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-600/30 hover:scale-105 active:scale-95 border border-purple-400/20">
                      <Video className="w-5 h-5 shadow-sm" />
                   </button>
                   <button className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5">
                      <MoreVertical className="w-5 h-5" />
                   </button>
                </div>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-none scrollbar-thumb-white/10 hover:scrollbar-thin">
                {currentChatMessages.length > 0 ? (
                  currentChatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                       <div className={`max-w-[70%] px-5 py-3 rounded-[2rem] ${msg.senderId === user.id ? 'bg-purple-600 text-white rounded-tr-none shadow-xl shadow-purple-600/10' : 'bg-[#1a1d2e] text-gray-100 rounded-tl-none border border-white/5'}`}>
                          <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
                          <div className={`text-[9px] mt-1.5 flex items-center font-black uppercase tracking-tighter ${msg.senderId === user.id ? 'text-purple-200' : 'text-gray-500'}`}>
                             {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 transform translate-y-[-20px] pointer-events-none">
                      <Smile className="w-24 h-24 mb-6" />
                      <p className="text-xs font-black uppercase tracking-[0.4em]">Send a wave</p>
                  </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-8 bg-gradient-to-t from-[#0b0c14] via-[#0b0c14] to-transparent shrink-0">
               <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center space-x-4 bg-[#141624] p-2 rounded-[2.5rem] border border-white/5 shadow-2xl focus-within:border-purple-500/40 transition-all">
                  <button type="button" className="p-3.5 text-gray-500 hover:text-purple-400 transition-colors ml-1">
                     <Paperclip className="w-5 h-5" />
                  </button>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={onTyping}
                    onFocus={() => {
                        if (selectedUser) {
                          setUnreadCounts(prev => ({ ...prev, [selectedUser.id]: 0 }));
                        }
                    }}
                    placeholder={`Message ${selectedUser.username}...`}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm font-semibold py-3 px-2 text-white placeholder:text-gray-600"
                  />
                  <button type="button" className="p-3.5 text-gray-500 hover:text-purple-400 transition-colors">
                     <Smile className="w-5 h-5" />
                  </button>
                  <button type="submit" disabled={!newMessage.trim()} className="bg-purple-600 hover:bg-purple-500 disabled:bg-white/5 disabled:text-gray-700 text-white p-3.5 rounded-[2rem] transition-all shadow-lg shadow-purple-600/20 active:scale-95 mr-1 group">
                     <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-[#0b0c14]">
             {/* Decorative Background Elements */}
             <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/[0.03] rounded-full blur-[120px]"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/[0.03] rounded-full blur-[120px]"></div>
             
             <div className="relative z-10 flex flex-col items-center p-12 text-center">
                <div className="w-32 h-32 rounded-[3.5rem] bg-[#141624] border border-white/5 flex items-center justify-center mb-10 shadow-2xl relative group">
                   <div className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity rounded-[3.5rem]"></div>
                   <Video className="w-12 h-12 text-purple-600/60 group-hover:text-purple-500 transition-colors" />
                </div>
                <h2 className="text-4xl font-black mb-6 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent tracking-tighter">Encrypted Workspace</h2>
                <p className="text-gray-500 max-w-sm text-sm font-bold leading-relaxed uppercase tracking-[0.1em] opacity-80 italic">Select a conversation or start searching to securely connect with your team.</p>
                
                <div className="mt-16 grid grid-cols-2 gap-4 w-full max-w-md">
                   <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-left">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3 text-xs font-black">01</div>
                      <h4 className="text-xs font-black uppercase mb-1">P2P Calls</h4>
                      <p className="text-[10px] text-gray-500 font-bold">Encrypted WebRTC streams</p>
                   </div>
                   <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 text-left">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 text-xs font-black">02</div>
                      <h4 className="text-xs font-black uppercase mb-1">Instant</h4>
                      <p className="text-[10px] text-gray-500 font-bold">Real-time socket messaging</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Video Overlays */}
        {(callAccepted || receivingCall) && (
            <div className="absolute inset-0 z-[100] bg-[#0b0c14] flex flex-col p-10 animate-in fade-in zoom-in duration-500">
                 <div className="flex-1 flex gap-10">
                    <div className="flex-1 bg-[#141624] rounded-[3rem] overflow-hidden border border-white/5 relative shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                        <video playsInline muted ref={myVideo} autoPlay className="w-full h-full object-cover transform scale-x-[-1]" />
                        <div className="absolute bottom-8 left-8 bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 shadow-lg">You (Host)</div>
                    </div>
                    {callAccepted && (
                        <div className="flex-1 bg-[#141624] rounded-[3rem] overflow-hidden border border-purple-500/20 relative shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                           <video playsInline ref={userVideo} autoPlay className="w-full h-full object-cover" />
                           <div className="absolute bottom-8 left-8 bg-purple-600/80 backdrop-blur-md px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 shadow-lg">{callerName || selectedUser?.username}</div>
                        </div>
                    )}
                 </div>

                 {receivingCall && !callAccepted && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1a1d2e] p-12 rounded-[4rem] border border-purple-500/50 flex flex-col items-center shadow-[0_0_150px_rgba(168,85,247,0.3)] z-[110] animate-bounce-short">
                        <div className="w-24 h-24 rounded-full bg-purple-600 flex items-center justify-center mb-8 shadow-2xl shadow-purple-600/50 animate-pulse">
                           <Phone className="w-12 h-12 text-white" />
                        </div>
                        <h3 className="text-3xl font-black mb-2 tracking-tighter">{callerName}</h3>
                        <p className="text-purple-400 font-black text-[10px] uppercase tracking-widest mb-12 animate-pulse">Incoming High-Def Video Call</p>
                        <div className="flex space-x-6">
                            <button onClick={answerCall} className="bg-green-500 hover:bg-green-400 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase transition-all shadow-xl shadow-green-500/20 active:scale-95">Accept Call</button>
                            <button onClick={() => setReceivingCall(false)} className="bg-red-500 hover:bg-red-400 text-white px-10 py-5 rounded-3xl font-black text-xs uppercase transition-all shadow-xl shadow-red-500/20 active:scale-95">Decline</button>
                        </div>
                    </div>
                 )}

                 {callAccepted && (
                    <div className="h-32 flex items-center justify-center pt-10">
                       <button onClick={leaveCall} className="bg-red-500 hover:bg-red-400 text-white p-7 rounded-[2.5rem] shadow-2xl shadow-red-500/40 transition-all hover:scale-110 active:scale-90 border-[6px] border-[#0b0c14] group">
                          <Phone className="w-10 h-10 transform rotate-[135deg] group-hover:rotate-[145deg] transition-transform" />
                       </button>
                    </div>
                 )}
            </div>
        )}
      </main>
    </div>
  );
}
