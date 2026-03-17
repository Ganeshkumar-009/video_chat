require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const supabase = require('./config/supabase');

const app = express();
const server = http.createServer(app);

// Socket.io setup for WebRTC Signaling
const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Socket.io Connection Event
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User logs in and connects to their personal room
  socket.on('setup', (userData) => {
    const userId = userData.id; 
    socket.join(userId);
    console.log(`User ${userData.username} joined room: ${userId}`);
    socket.emit('connected');
  });

  // WebRTC Signaling Events
  socket.on('callUser', ({ userToCall, signalData, from, name }) => {
    io.to(userToCall).emit('callUser', { signal: signalData, from, name });
  });

  socket.on('answerCall', (data) => {
    io.to(data.to).emit('callAccepted', data.signal);
  });

  // Chat Messaging Events
  socket.on('sendMessage', async (messageData) => {
    // messageData: { senderId, senderName, receiverId, text, timestamp }
    const receiverId = messageData.receiverId;
    
    // Persist to Supabase
    try {
        await supabase
            .from('messages')
            .insert([{
                sender_id: messageData.senderId,
                receiver_id: receiverId,
                text: messageData.text,
                is_read: false
            }]);
    } catch (err) {
        console.error("Failed to save message", err);
    }

    io.to(receiverId).emit('receiveMessage', messageData);
  });

  socket.on('typing', (data) => {
    // data: { receiverId, senderId }
    io.to(data.receiverId).emit('typing', data);
  });
  
  socket.on('stopTyping', (data) => {
    io.to(data.receiverId).emit('stopTyping', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Server Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

