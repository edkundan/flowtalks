const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());

const server = http.createServer(app);

const peerServer = ExpressPeerServer(server, {
  path: '/peerjs/myapp',
  allow_discovery: true,
  debug: 3,
});

app.use('/', peerServer);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.send('Server is running');
});

// Start the server
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});