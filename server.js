const express = require('express');
const https = require('https');
const fs = require('fs');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();

// Enable CORS for all routes with specific configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// SSL/TLS certificates configuration
// You'll need to replace these with your actual certificate paths
const options = {
  key: fs.readFileSync('/path/to/your/private-key.pem'),
  cert: fs.readFileSync('/path/to/your/certificate.pem')
};

const server = https.createServer(options, app);

const peerServer = ExpressPeerServer(server, {
  path: '/peerjs/myapp',
  allow_discovery: true,
  debug: 3,
  ssl: options,
  proxied: true,
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
const PORT = process.env.PORT || 443;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Secure server is running on port ${PORT}`);
});