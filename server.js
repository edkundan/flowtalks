
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Track connected users
let connectedUsers = new Set();
let userPartners = new Map(); // Track user partnerships

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  connectedUsers.add(socket.id);
  io.emit('userCount', connectedUsers.size);

  // Find chat partner
  socket.on('findPartner', () => {
    // First, clean up any existing partnerships for this user
    if (userPartners.has(socket.id)) {
      const oldPartner = userPartners.get(socket.id);
      const partnerSocket = io.sockets.sockets.get(oldPartner);
      
      if (partnerSocket) {
        partnerSocket.partner = null;
        userPartners.delete(oldPartner);
        partnerSocket.emit('partnerDisconnected');
      }
      
      userPartners.delete(socket.id);
      socket.partner = null;
    }
    
    const availableUsers = Array.from(connectedUsers).filter(id => 
      id !== socket.id && 
      !userPartners.has(id) // Only users not already partnered
    );
    
    if (availableUsers.length > 0) {
      const randomPartner = availableUsers[Math.floor(Math.random() * availableUsers.length)];
      socket.partner = randomPartner;
      
      const partnerSocket = io.sockets.sockets.get(randomPartner);
      if (partnerSocket) {
        partnerSocket.partner = socket.id;
        
        // Record the partnership
        userPartners.set(socket.id, randomPartner);
        userPartners.set(randomPartner, socket.id);
        
        // Notify both users
        socket.emit('partnerFound', randomPartner);
        partnerSocket.emit('partnerFound', socket.id);
      }
    }
  });

  // Handle chat messages
  socket.on('chatMessage', (message) => {
    if (socket.partner) {
      io.to(socket.partner).emit('chatMessage', {
        text: message,
        from: socket.id
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    if (socket.partner) {
      io.to(socket.partner).emit('webrtc-offer', data);
    }
  });

  socket.on('webrtc-answer', (data) => {
    if (socket.partner) {
      io.to(socket.partner).emit('webrtc-answer', data);
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    if (socket.partner) {
      io.to(socket.partner).emit('webrtc-ice-candidate', data);
    }
  });

  // Handle explicit disconnect request
  socket.on('endConnection', () => {
    if (socket.partner) {
      const partnerSocket = io.sockets.sockets.get(socket.partner);
      if (partnerSocket) {
        partnerSocket.partner = null;
        userPartners.delete(partnerSocket.id);
        partnerSocket.emit('partnerDisconnected');
      }
      
      userPartners.delete(socket.id);
      socket.partner = null;
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.partner) {
      const partnerSocket = io.sockets.sockets.get(socket.partner);
      if (partnerSocket) {
        partnerSocket.partner = null;
        userPartners.delete(partnerSocket.id);
        partnerSocket.emit('partnerDisconnected');
      }
      
      userPartners.delete(socket.id);
    }
    
    connectedUsers.delete(socket.id);
    io.emit('userCount', connectedUsers.size);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'Server is running',
    connectedUsers: connectedUsers.size
  });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
