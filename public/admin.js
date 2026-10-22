// Admin Panel Script & Real-Time Monitoring Center

let socket = null;
let attendees = [];
let soundEnabled = true;
let audioCtx = null;
let activeQrUrl = '';
let knownAttendeeIds = new Set();
let isInitialLoad = true;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Init Socket.io or smart cloud polling
  initSocket();

  // Load initial attendees
  loadAttendees();

  // Load network info for QR code setup
  loadNetworkInfo();
});

// Sound Alert Synthesizer via Web Audio API (Zero external audio file dependencies)
function playNotificationChime() {
  if (!soundEnabled) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // First note: C5 (523.25 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note: G5 (783.99 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);

    // Third note: C6 (1046.50 Hz)
    const osc3 = audioCtx.createOscillator();
    const gain3 = audioCtx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1046.50, now + 0.22);
    gain3.gain.setValueAtTime(0.22, now + 0.22);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc3.connect(gain3);
    gain3.connect(audioCtx.destination);
    osc3.start(now + 0.22);
    osc3.stop(now + 0.7);

  } catch (e) {
    console.warn('Audio chime playback note:', e);
  }
}

// Toggle Sound
function toggleAudioAlerts() {
  soundEnabled = !soundEnabled;
  const label = document.getElementById('sound-label');
  const icon = document.getElementById('sound-icon');
  
  if (soundEnabled) {
    label.textContent = 'Sound On';
    icon.setAttribute('data-lucide', 'volume-2');
    playNotificationChime(); // test beep
  } else {
    label.textContent = 'Muted';
    icon.setAttribute('data-lucide', 'volume-x');
  }

  if (window.lucide) window.lucide.createIcons();
}

// Start Smart Polling fallback (essential for Vercel/serverless where long-lived WebSockets are disabled)
function startPollingFallback() {
  if (pollInterval) return;
  const statusEl = document.getElementById('connection-status');
  if (statusEl) statusEl.textContent = 'Live Cloud Sync';

  pollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/attendees');
      if (!res.ok) return;
      const data = await res.json();
      const latestList = data.attendees || [];

      // Detect any new fresher
      let newlyAdded = [];
      latestList.forEach(item => {
        if (!knownAttendeeIds.has(item.id)) {
          knownAttendeeIds.add(item.id);
          if (!isInitialLoad) {
            newlyAdded.push(item);
          }
        }
      });

      if (newlyAdded.length > 0) {
        // Trigger sound and toast for newest fresher
        playNotificationChime();
        newlyAdded.forEach(f => showLiveToast(f));
        attendees = latestList;
        renderAttendeesTable(attendees);

        // Update stats
        const statsRes = await fetch('/api/stats');
        if (statsRes.ok) {
          const stats = await statsRes.json();
          renderStats(stats);
        }
      }
    } catch (e) {
      // transient network error
    }
  }, 2500);
}

// Initialize Socket.io with smart fallback
function initSocket() {
  const statusEl = document.getElementById('connection-status');

  try {
    if (typeof io !== 'undefined') {
      socket = io({ reconnectionAttempts: 2, timeout: 2500 });

      socket.on('connect', () => {
        if (statusEl) statusEl.textContent = 'Live Connected';
      });

      socket.on('connect_error', () => {
        startPollingFallback();
      });

      socket.on('disconnect', () => {
        startPollingFallback();
      });

      // Initial Stats from server
      socket.on('initial_stats', (stats) => {
        renderStats(stats);
      });

      // REAL TIME NOTIFICATION EVENT: Student submitted!
      socket.on('new_fresher', (data) => {
        const fresher = data.fresher;
        knownAttendeeIds.add(fresher.id);
        
        playNotificationChime();
        showLiveToast(fresher);

        const existingIdx = attendees.findIndex(a => a.id === fresher.id || (a.usn && a.usn === fresher.usn));
        if (existingIdx !== -1) {
          attendees[existingIdx] = fresher;
        } else {
          attendees.unshift(fresher);
        }
        renderAttendeesTable(attendees);

        if (data.stats) {
          renderStats(data.stats);
        }
      });

      socket.on('attendee_deleted', (data) => {
        knownAttendeeIds.delete(data.id);
        attendees = attendees.filter(a => a.id !== data.id);
        renderAttendeesTable(attendees);
        if (data.stats) {
          renderStats(data.stats);
        }
      });
    } else {
      startPollingFallback();
    }
  } catch (err) {
    startPollingFallback();
  }

  // Backup timer in case socket hangs in serverless
  setTimeout(() => {
    if (!socket || !socket.connected) {
      startPollingFallback();
    }
  }, 3000);
}

// Show animated toast in top-right
function showLiveToast(fresher) {
  const container = document.getElementById('live-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto bg-[#131b2e] border-2 border-amber-400/80 rounded-xl p-3.5 shadow-2xl flex items-start gap-3 transition-all duration-300 transform translate-x-10 opacity-0';
  
  const hobbiesText = (fresher.interests && fresher.interests.length > 0) 
    ? fresher.interests.slice(0, 3).join(', ') 
    : 'New Registration';

  toast.innerHTML = `
    <div class="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-500/30">
      <i data-lucide="sparkles" class="w-4 h-4"></i>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-1">
        <span class="text-[10px] font-bold tracking-wider text-amber-400 uppercase">New Fresher Registered!</span>
        <span class="text-[9px] text-slate-400 font-mono">Just now</span>
      </div>
      <h4 class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(fresher.name)} (${escapeHtml(fresher.usn)})</h4>
      <p class="text-[11px] text-slate-300 truncate">Likes: <span class="text-amber-200">${escapeHtml(hobbiesText)}</span></p>
    </div>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white text-xs p-1">
      &times;
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-10', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  }, 50);

  // Auto remove after 5.5 seconds
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-10');
    setTimeout(() => toast.remove(), 300);
  }, 5500);
}

// Load attendees from REST API
async function loadAttendees() {
  try {
    const res = await fetch('/api/attendees');
    const data = await res.json();
    attendees = data.attendees || [];
    attendees.forEach(a => knownAttendeeIds.add(a.id));
    isInitialLoad = false;
    renderAttendeesTable(attendees);

    // Also fetch stats
    const statsRes = await fetch('/api/stats');
    const statsData = await statsRes.json();
    renderStats(statsData);
  } catch (err) {
    console.error('Failed to load attendees:', err);
    isInitialLoad = false;
  }
}

// Render Stats & KPIs
function renderStats(stats) {
  if (!stats) return;

  const totalEl = document.getElementById('stat-total');
  const recentEl = document.getElementById('stat-recent');
  const topHobbyEl = document.getElementById('stat-top-hobby');
  const topHobbyCountEl = document.getElementById('stat-top-hobby-count');
  const badgeEl = document.getElementById('roster-count-badge');

  if (totalEl) totalEl.textContent = stats.totalRegistered || 0;
  if (badgeEl) badgeEl.textContent = stats.totalRegistered || 0;
  if (recentEl) recentEl.textContent = stats.recentCount || 0;

  if (stats.interests && stats.interests.length > 0) {
    const top = stats.interests[0];
    if (topHobbyEl) topHobbyEl.textContent = top.name;
    if (topHobbyCountEl) topHobbyCountEl.textContent = `${top.count} student(s) interested`;
  } else {
    if (topHobbyEl) topHobbyEl.textContent = 'None yet';
    if (topHobbyCountEl) topHobbyCountEl.textContent = '0 students';
  }

  // Render Interests breakdown pills
  const distContainer = document.getElementById('interests-distribution-container');
  if (distContainer) {
    if (!stats.interests || stats.interests.length === 0) {
      distContainer.innerHTML = '<span class="text-xs text-slate-500 italic">No registrations yet</span>';
    } else {
      distContainer.innerHTML = stats.interests.map(item => `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-[#111728] border border-slate-700/80 text-slate-200">
          <span>${escapeHtml(item.name)}</span>
          <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">${item.count}</span>
        </span>
      `).join('');
    }
  }
}

// Render Table Rows
function renderAttendeesTable(list) {
  const tbody = document.getElementById('attendees-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-slate-500 italic">
          No freshers registered yet. Print or share the QR code to get started!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => {
    const interestsBadges = (item.interests || []).map(i => `
      <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-amber-300 border border-slate-700">
        ${escapeHtml(i)}
      </span>
    `).join(' ');

    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

    return `
      <tr class="hover:bg-[#111827] transition">
        <td class="px-4 py-3 font-mono font-bold text-amber-400 text-[11px] whitespace-nowrap">
          ${escapeHtml(item.ticketCode || 'VIP-PASS')}
        </td>
        <td class="px-4 py-3 font-semibold text-white">
          ${escapeHtml(item.name)}
        </td>
        <td class="px-4 py-3 font-mono text-slate-300 font-medium">
          ${escapeHtml(item.usn)}
        </td>
        <td class="px-4 py-3 text-slate-400">
          ${escapeHtml(item.branch || 'Freshers Batch')}
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-1 max-w-xs">
            ${interestsBadges}
          </div>
        </td>
        <td class="px-4 py-3 text-slate-500 text-[11px] whitespace-nowrap font-mono">
          ${dateStr}
        </td>
        <td class="px-4 py-3 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5">
            <button 
              onclick="viewAttendeeDetails('${item.id}')" 
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="View details"
            >
              Inspect
            </button>
            <button 
              onclick="deleteAttendee('${item.id}')" 
              class="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Delete record"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Filter Attendees
function filterAttendees() {
  const query = (document.getElementById('search-input').value || '').toLowerCase().trim();
  if (!query) {
    renderAttendeesTable(attendees);
    return;
  }

  const filtered = attendees.filter(a => {
    const nameMatch = (a.name || '').toLowerCase().includes(query);
    const usnMatch = (a.usn || '').toLowerCase().includes(query);
    const branchMatch = (a.branch || '').toLowerCase().includes(query);
    const ticketMatch = (a.ticketCode || '').toLowerCase().includes(query);
    const interestMatch = (a.interests || []).some(i => i.toLowerCase().includes(query));
    return nameMatch || usnMatch || branchMatch || ticketMatch || interestMatch;
  });

  renderAttendeesTable(filtered);
}

// View Attendee Modal
function viewAttendeeDetails(id) {
  const item = attendees.find(a => a.id === id);
  if (!item) return;

  document.getElementById('modal-name').textContent = item.name;
  document.getElementById('modal-usn').textContent = item.usn;
  document.getElementById('modal-ticket').textContent = item.ticketCode || 'FEST-2026-VIP';
  document.getElementById('modal-branch').textContent = item.branch || 'Freshers Batch';
  document.getElementById('modal-timestamp').textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : '-';

  const interestsBox = document.getElementById('modal-interests');
  interestsBox.innerHTML = (item.interests || []).map(i => `
    <span class="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">${escapeHtml(i)}</span>
  `).join('');

  const messageBox = document.getElementById('modal-message-box');
  const messageEl = document.getElementById('modal-message');
  if (item.message && item.message.trim()) {
    messageBox.classList.remove('hidden');
    messageEl.textContent = `"${item.message}"`;
  } else {
    messageBox.classList.add('hidden');
  }

  document.getElementById('attendee-modal').classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeModal() {
  document.getElementById('attendee-modal').classList.add('hidden');
}

// Delete Attendee
async function deleteAttendee(id) {
  if (!confirm('Are you sure you want to remove this registration record?')) return;

  try {
    const res = await fetch(`/api/attendees/${id}`, { method: 'DELETE' });
    if (res.ok) {
      attendees = attendees.filter(a => a.id !== id);
      renderAttendeesTable(attendees);
    } else {
      alert('Failed to delete attendee');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Error deleting attendee');
  }
}

// Load Network Info & Initialize QR Studio
async function loadNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    const data = await res.json();

    const targetUrlInput = document.getElementById('custom-qr-url');
    const ipsList = document.getElementById('detected-ips-list');

    // Default target URL is current origin or recommended local IP
    activeQrUrl = data.recommendedUrl || window.location.origin;
    if (targetUrlInput) {
      targetUrlInput.value = activeQrUrl;
    }

    // Populate quick-select buttons for Wi-Fi IP
    if (ipsList) {
      const allUrls = [
        window.location.origin,
        ...(data.allUrls || [])
      ];
      // Deduplicate
      const uniqueUrls = Array.from(new Set(allUrls));

      ipsList.innerHTML = uniqueUrls.map(url => `
        <button 
          onclick="setQrUrl('${url}')" 
          class="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
        >
          ${url}
        </button>
      `).join('');
    }

    renderPosterQr(activeQrUrl);
  } catch (err) {
    console.error('Network info error:', err);
    activeQrUrl = window.location.origin;
    renderPosterQr(activeQrUrl);
  }
}

function setQrUrl(url) {
  activeQrUrl = url;
  const input = document.getElementById('custom-qr-url');
  if (input) input.value = url;
  renderPosterQr(url);
}

function updateQrCode() {
  const input = document.getElementById('custom-qr-url');
  if (input && input.value.trim()) {
    activeQrUrl = input.value.trim();
    renderPosterQr(activeQrUrl);
  }
}

function renderPosterQr(url) {
  const canvas = document.getElementById('poster-qr-canvas');
  if (!canvas || !window.QRCode) return;

  QRCode.toCanvas(canvas, url, {
    width: 180,
    margin: 1,
    color: {
      dark: '#080d1a',
      light: '#ffffff'
    }
  }, (err) => {
    if (err) console.error('Poster QR error:', err);
  });
}

// Print Standee Poster for Registration Desks
function printPoster() {
  const canvas = document.getElementById('poster-qr-canvas');
  const qrDataUrl = canvas.toDataURL('image/png');
  const targetUrl = activeQrUrl || window.location.origin;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Freshers Standee Poster</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          text-align: center;
          background: #ffffff;
          color: #0f172a;
        }
        .poster-card {
          border: 4px solid #0f172a;
          border-radius: 24px;
          padding: 40px 30px;
          max-width: 650px;
          margin: 0 auto;
        }
        .badge {
          display: inline-block;
          background: #0f172a;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          padding: 6px 18px;
          border-radius: 50px;
          text-transform: uppercase;
        }
        h1 {
          font-size: 38px;
          font-weight: 900;
          margin: 16px 0 8px 0;
          letter-spacing: -0.5px;
        }
        p.subtitle {
          font-size: 18px;
          color: #475569;
          margin: 0 0 28px 0;
        }
        .qr-box {
          display: inline-block;
          padding: 16px;
          border: 3px dashed #0f172a;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 10px 25px rgba(0,0,0,0.06);
        }
        .qr-box img {
          display: block;
          width: 260px;
          height: 260px;
        }
        .instructions {
          margin-top: 28px;
          font-size: 20px;
          font-weight: 800;
          color: #d97706;
        }
        .sub-inst {
          font-size: 14px;
          color: #64748b;
          margin-top: 6px;
        }
        .url-box {
          margin-top: 20px;
          font-family: monospace;
          font-size: 13px;
          color: #334155;
          background: #f1f5f9;
          display: inline-block;
          padding: 6px 14px;
          border-radius: 8px;
        }
      </style>
    </head>
    <body>
      <div class="poster-card">
        <span class="badge">Official Freshers Gala 2026</span>
        <h1>WELCOME FRESHERS!</h1>
        <p class="subtitle">A special surprise & exclusive VIP pass awaits you</p>
        
        <div class="qr-box">
          <img src="${qrDataUrl}" alt="Scan QR Code" />
        </div>

        <div class="instructions">👉 SCAN THIS QR CODE WITH YOUR PHONE</div>
        <p class="sub-inst">Enter your Name, USN & Talents to reveal your customized event pass!</p>
        <div class="url-box">${targetUrl}</div>
      </div>
      <script>
        window.onload = function() {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

// Utility: HTML escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
