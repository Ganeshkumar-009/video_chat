// Socket.io signaling logic for video/chat

module.exports = (io, supabaseAdmin) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId, userId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', userId);
      console.log(`User ${userId} joined room ${roomId}`);
    });

    // WebRTC Signaling
    socket.on('offer', (data) => {
      socket.to(data.room).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
      socket.to(data.room).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data) => {
      socket.to(data.room).emit('ice-candidate', data.candidate);
    });

    // Chat
    socket.on('chat-message', (msg) => {
      io.to(msg.room).emit('chat-message', msg);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

