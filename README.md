# 🎉 Freshers Welcome Surprise & VIP Pass Portal

A web application designed for college freshers welcome events. Freshers scan a QR code at registration stands, enter their **Name & USN**, select their **Interests & Talents** (singing, dancing, tech, etc.), and upon submission:
1. **The Organizer / Admin Panel receives an instantaneous real-time notification** with audio chime, toast notification, and live counter updates.
2. **The Fresher receives an exclusive Personalized VIP Invitation Card** with confetti animations and 1-click image download for entry.

---

## 🚀 Quick Start

### 1. Start the Server
```bash
cd C:\Users\SHREE\.gemini\antigravity\scratch\freshers-surprise-web
npm start
```
The server will run on port `3000`.

### 2. URLs:
- **Fresher Portal (Mobile / Browser):** `http://localhost:3000`
- **Organizer Live Command Center:** `http://localhost:3000/admin`
- **For Smartphones on Wi-Fi / Hotspot:** `http://<YOUR_LOCAL_IP>:3000` (e.g. `http://10.115.158.44:3000`)

---

## ✨ Features & Architecture

### 📱 Student Portal (`/`)
- **Step 1: Identity & Credentials**
  - Full Name, USN / College Roll Number, Department
- **Step 2: Talents & Interests**
  - High-contrast interactive passion chips: Singing, Dancing, Instruments, Tech/Coding, Photography, Drama, Art, Sports, Anchoring, Esports, Fashion, Poetry.
  - Custom talent write-in and batch shoutout note.
- **Step 3: The Grand Reveal & VIP Invitation Pass**
  - Suspenseful loading sequence + multi-cannon confetti blast!
  - Luxury VIP Pass featuring:
    - Event branding (*AURA 2026 Freshers Gala*)
    - Attendee Name & USN
    - Ticket code (e.g., `FEST-2026-VIP-XXXX`)
    - Passion tags
    - Event Date, Venue, Dress Code
    - Verification QR code embedded on ticket stub
  - **"Save / Download Pass as Image"** button (generates high-res PNG directly to student's phone photos).

### 🛡️ Admin & Organizer Center (`/admin`)
- **Real-time WebSocket connection via Socket.io**
- **Celebration Audio Chime** on new student submission (synthesized via Web Audio API, works offline without external audio files) with sound toggle (Mute/Unmute).
- **Live Toast Notification** displaying fresher's Name, USN, and hobbies.
- **Live Metrics**: Total Freshers Registered, Top Interest/Talent breakdown, Recent activity counter.
- **Search & Filter Table**: Filter by Name, USN, Branch, or Interest.
- **QR Code Studio & Print Standee**:
  - Auto-detects local Wi-Fi IP.
  - Printable Tabletop Standee poster ready to print on A4/cardstock for campus desks with 1 click!
- **Data Export**: 1-click CSV download for Excel/Google Sheets.
