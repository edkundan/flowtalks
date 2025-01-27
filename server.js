const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();

// Enable CORS for all routes with specific configuration
app.use(cors({
  origin: '*', // Be more specific in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: '/peerjs/myapp',
  allow_discovery: true,
  debug: 3,
  proxied: true, // Add this if behind a proxy
  pingInterval: 5000, // More frequent ping to keep connections alive
  key: 'peerjs', // Default key
  concurrent_limit: 5000 // Increase concurrent connection limit
});

app.use('/', peerServer);

// Track connected peers
const connectedPeers = new Set();

peerServer.on('connection', (client) => {
  console.log('Client connected:', client.getId());
  connectedPeers.add(client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('Client disconnected:', client.getId());
  connectedPeers.delete(client.getId());
});

// Health check endpoint that also returns number of connected peers
app.get('/health', (req, res) => {
  res.json({
    status: 'Server is running',
    connectedPeers: connectedPeers.size
  });
});

// Start the server
const PORT = process.env.PORT || 9000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});