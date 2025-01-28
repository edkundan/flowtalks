const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: '/myapp',
  allow_discovery: true,
  debug: 3,
  proxied: false,
  pingInterval: 5000,
  key: 'peerjs',
  concurrent_limit: 5000
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

// Health check endpoint
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