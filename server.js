const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get local network IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Socket.io connection for live admin notifications
io.on('connection', (socket) => {
  // Send current stats on connect
  socket.emit('initial_stats', db.getStats());

  socket.on('disconnect', () => {
    // client disconnected
  });
});

// API: Register Fresher
app.post('/api/register', async (req, res) => {
  try {
    const { name, usn, branch, interests, customHobby, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!usn || !usn.trim()) {
      return res.status(400).json({ error: 'USN / Roll Number is required' });
    }

    const cleanedName = name.trim();
    const cleanedUsn = usn.trim().toUpperCase();

    // Consolidate interests
    let interestList = Array.isArray(interests) ? [...interests] : [];
    if (customHobby && customHobby.trim()) {
      interestList.push(customHobby.trim());
    }
    // Remove duplicates
    interestList = Array.from(new Set(interestList.map(i => i.trim()))).filter(Boolean);

    // Create unique VIP pass code
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketCode = `FEST-2026-${cleanedUsn.slice(-4) || 'VIP'}-${randomHex}`;

    const fresherData = {
      id: uuidv4(),
      ticketCode,
      name: cleanedName,
      usn: cleanedUsn,
      branch: branch ? branch.trim() : 'Freshers Batch',
      interests: interestList.length > 0 ? interestList : ['General Explorer'],
      message: message ? message.trim() : '',
      createdAt: new Date().toISOString()
    };

    const result = db.addFresher(fresherData);

    // Broadcast in real-time to all connected admin panels (if WebSocket is active)
    try {
      io.emit('new_fresher', {
        fresher: result.record,
        isUpdate: result.isUpdate,
        stats: db.getStats()
      });
    } catch (socketErr) {
      // In serverless environments, WebSocket is replaced by smart polling
    }

    return res.status(201).json({
      success: true,
      isUpdate: result.isUpdate,
      data: result.record
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// API: Get Attendees
app.get('/api/attendees', (req, res) => {
  const freshers = db.getAllFreshers();
  res.json({ attendees: freshers, count: freshers.length });
});

// API: Get Stats
app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

// API: Delete attendee
app.delete('/api/attendees/:id', (req, res) => {
  const success = db.deleteFresher(req.params.id);
  if (success) {
    try {
      io.emit('attendee_deleted', { id: req.params.id, stats: db.getStats() });
    } catch (e) {}
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Attendee not found' });
  }
});

// API: Export to CSV
app.get('/api/export-csv', (req, res) => {
  const list = db.getAllFreshers();
  const headers = ['Pass Code', 'Name', 'USN', 'Branch', 'Interests', 'Personal Note', 'Registered At'];
  
  const rows = list.map(item => [
    `"${item.ticketCode || ''}"`,
    `"${(item.name || '').replace(/"/g, '""')}"`,
    `"${(item.usn || '').replace(/"/g, '""')}"`,
    `"${(item.branch || '').replace(/"/g, '""')}"`,
    `"${(item.interests || []).join(', ').replace(/"/g, '""')}"`,
    `"${(item.message || '').replace(/"/g, '""')}"`,
    `"${item.createdAt || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=freshers_attendees_${Date.now()}.csv`);
  res.status(200).send(csvContent);
});

// API: Generate QR Code image or Data URL
app.get('/api/qr', async (req, res) => {
  try {
    const targetUrl = req.query.url || `http://localhost:${PORT}`;
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    res.json({ url: targetUrl, qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// API: Network Info for QR setup
app.get('/api/network-info', (req, res) => {
  const localIps = getLocalIpAddresses();
  const urls = localIps.map(ip => `http://${ip}:${PORT}`);
  res.json({
    port: PORT,
    localIps,
    recommendedUrl: urls[0] || `http://localhost:${PORT}`,
    allUrls: urls
  });
});

// Route for Admin Panel
app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: path.join(__dirname, 'public') });
});

// Route for Fresher Home
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

// Start Server locally if not running as serverless function
if (!process.env.VERCEL && require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    const localIps = getLocalIpAddresses();
    console.log(`\n======================================================`);
    console.log(`🎉 FRESHERS SURPRISE PORTAL & ADMIN PANEL READY!`);
    console.log(`======================================================`);
    console.log(`👉 Local URL:        http://localhost:${PORT}`);
    if (localIps.length > 0) {
      console.log(`👉 Mobile QR URL:    http://${localIps[0]}:${PORT} (For phones on same Wi-Fi)`);
    }
    console.log(`🛡️  Admin Dashboard:  http://localhost:${PORT}/admin`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
