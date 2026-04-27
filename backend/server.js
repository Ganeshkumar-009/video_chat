require('dotenv').config();
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] }
});
const cors = require('cors');
app.use(cors());

require('./src/index')(io);  // Load routes/sockets

const PORT = process.env.PORT || 5000;
http.listen(PORT, () => console.log(`Server on port ${PORT}`));

module.exports = app;

