// Client Logic for Freshers Surprise Portal

// State
const state = {
  currentStep: 1,
  name: '',
  usn: '',
  branch: '',
  selectedHobbies: new Set(),
  customHobby: '',
  message: '',
  ticketData: null
};

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Setup Hobby Selection Toggles
  setupHobbySelection();

  // Try loading cached ticket if already registered on this device
  const cachedTicket = localStorage.getItem('freshers_vip_pass_2026');
  if (cachedTicket) {
    try {
      const parsed = JSON.parse(cachedTicket);
      if (parsed && parsed.ticketCode) {
        state.ticketData = parsed;
        renderTicket(parsed);
        goToStep(3);
      }
    } catch (e) {
      console.warn('Failed to parse cached pass:', e);
    }
  }
});

// Setup click handlers for hobby cards
function setupHobbySelection() {
  const cards = document.querySelectorAll('.hobby-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const hobby = card.getAttribute('data-hobby');
      if (card.classList.contains('selected')) {
        card.classList.remove('selected');
        state.selectedHobbies.delete(hobby);
      } else {
        card.classList.add('selected');
        state.selectedHobbies.add(hobby);
        
        // Haptic feedback on mobile if supported
        if (navigator.vibrate) {
          navigator.vibrate(25);
        }
      }
    });
  });
}

// Navigate between steps
function goToStep(stepNumber) {
  state.currentStep = stepNumber;

  const stages = [1, 2, 3];
  stages.forEach(s => {
    const el = document.getElementById(`stage-${s}`);
    if (el) {
      if (s === stepNumber) {
        el.classList.remove('step-hidden');
        el.classList.add('step-active');
      } else {
        el.classList.add('step-hidden');
        el.classList.remove('step-active');
      }
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Step 1 Validation & Proceed
function handleStep1Submit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('studentName');
  const usnInput = document.getElementById('studentUsn');
  const branchSelect = document.getElementById('studentBranch');

  const nameVal = nameInput.value.trim();
  const usnVal = usnInput.value.trim().toUpperCase();

  if (!nameVal) {
    nameInput.focus();
    alert('Please enter your full name');
    return;
  }
  if (!usnVal) {
    usnInput.focus();
    alert('Please enter your USN or Roll Number');
    return;
  }

  state.name = nameVal;
  state.usn = usnVal;
  state.branch = branchSelect.value;

  goToStep(2);
}

// Step 2 Final Submission
async function submitFresherRegistration() {
  const customHobbyInput = document.getElementById('customHobby');
  const messageInput = document.getElementById('fresherMessage');
  const btnSubmit = document.getElementById('btn-submit-all');
  const loader = document.getElementById('loader-overlay');

  const customHobby = customHobbyInput ? customHobbyInput.value.trim() : '';
  const message = messageInput ? messageInput.value.trim() : '';

  const hobbiesArray = Array.from(state.selectedHobbies);
  if (customHobby) {
    hobbiesArray.push(customHobby);
  }

  // Show loader overlay
  loader.classList.remove('hidden');
  btnSubmit.disabled = true;

  try {
    const payload = {
      name: state.name,
      usn: state.usn,
      branch: state.branch,
      interests: hobbiesArray.length > 0 ? hobbiesArray : ['College Vibes & Socializing'],
      customHobby: customHobby,
      message: message
    };

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit details');
    }

    state.ticketData = result.data;
    localStorage.setItem('freshers_vip_pass_2026', JSON.stringify(result.data));

    // Allow 1.2s for dramatic suspense
    setTimeout(() => {
      loader.classList.add('hidden');
      btnSubmit.disabled = false;

      // Render VIP Pass
      renderTicket(result.data);

      // Transition to Stage 3
      goToStep(3);

      // Trigger Confetti Celebration
      triggerCelebrationConfetti();
    }, 1200);

  } catch (err) {
    loader.classList.add('hidden');
    btnSubmit.disabled = false;
    console.error('Submission failed:', err);
    alert('Error: ' + err.message);
  }
}

// Render the Ticket with Attendee Data
function renderTicket(ticket) {
  document.getElementById('card-student-name').textContent = ticket.name || 'Fresher Guest';
  document.getElementById('card-student-usn').textContent = ticket.usn || 'USN2026';
  document.getElementById('card-student-branch').textContent = ticket.branch || 'Freshers Batch';
  document.getElementById('card-ticket-id').textContent = ticket.ticketCode || 'FEST-2026-VIP';

  // Render Interests
  const interestsContainer = document.getElementById('card-student-interests');
  interestsContainer.innerHTML = '';
  
  const interestsList = (ticket.interests && ticket.interests.length > 0) 
    ? ticket.interests 
    : ['Music & Fun', 'Campus Life'];

  interestsList.forEach(interest => {
    const pill = document.createElement('span');
    pill.className = 'px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30';
    pill.textContent = interest;
    interestsContainer.appendChild(pill);
  });

  // Generate QR Code on Ticket Canvas
  const qrCanvas = document.getElementById('card-qr-canvas');
  if (qrCanvas && window.QRCode) {
    const qrPayload = JSON.stringify({
      code: ticket.ticketCode,
      name: ticket.name,
      usn: ticket.usn,
      event: 'AURA 2026 Freshers Fest'
    });

    QRCode.toCanvas(qrCanvas, qrPayload, {
      width: 72,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }, function (error) {
      if (error) console.error('QR code generation error:', error);
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Confetti Blast sequence
function triggerCelebrationConfetti() {
  if (typeof confetti !== 'function') return;

  // Center burst
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#f59e0b', '#fbbf24', '#6366f1', '#10b981', '#ffffff']
  });

  // Left & right cannons
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#f59e0b', '#eab308', '#6366f1']
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#f59e0b', '#eab308', '#6366f1']
    });
  }, 350);

  // Golden stars rain
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 100,
      shapes: ['star'],
      origin: { y: 0.4 },
      colors: ['#fef08a', '#f59e0b', '#ffffff']
    });
  }, 700);
}

function triggerConfettiAgain() {
  triggerCelebrationConfetti();
}

// Download Invitation Pass as PNG using html2canvas
async function downloadInvitationPass() {
  const cardElement = document.getElementById('invitation-card');
  const btn = document.getElementById('btn-download-pass');
  if (!cardElement) return;

  const originalText = btn.innerHTML;
  btn.innerHTML = `
    <svg class="animate-spin w-4 h-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    <span>Generating High-Res Pass...</span>
  `;
  btn.disabled = true;

  try {
    const canvas = await html2canvas(cardElement, {
      scale: 3, // crisp high definition rendering
      backgroundColor: '#080b12',
      useCORS: true,
      logging: false
    });

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const safeUsn = (state.usn || 'VIP').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `Freshers_VIP_Pass_${safeUsn}.png`;
    link.href = image;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error('Download error:', err);
    alert('Unable to generate pass image automatically. You can take a screenshot of your pass!');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
    if (window.lucide) window.lucide.createIcons();
  }
}

// Share Pass using Web Share API or Clipboard
function sharePass() {
  const shareTitle = "I'm attending AURA 2026 Freshers Gala!";
  const shareText = `Hey! I just claimed my official VIP Freshers Pass for AURA 2026! Check it out!`;
  const shareUrl = window.location.href;

  if (navigator.share) {
    navigator.share({
      title: shareTitle,
      text: shareText,
      url: shareUrl
    }).catch(err => console.log('Share canceled or failed:', err));
  } else {
    // Fallback: Copy link
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).then(() => {
      alert('Event link copied to clipboard! Share it with your classmates!');
    }).catch(() => {
      alert('Share link: ' + shareUrl);
    });
  }
}
