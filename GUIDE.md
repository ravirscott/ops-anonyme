# ANONCHAT — Complete Setup & Deployment Guide

> Anonymous room-based chat. No identity. No traces. Tor-ready.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Quick Start (Local)](#2-quick-start-local)
3. [Tor Onion Setup (Linux)](#3-tor-onion-setup-linux)
4. [Tor Onion Setup (Windows)](#4-tor-onion-setup-windows)
5. [Free Deployment Guide](#5-free-deployment-guide)
6. [Security Best Practices](#6-security-best-practices)
7. [Troubleshooting](#7-troubleshooting)
8. [Future Improvements](#8-future-improvements)

---

## 1. Project Structure

```
anonchat/
├── server.js           ← Node.js backend (Express + Socket.io)
├── package.json        ← Dependencies
└── public/
    ├── index.html      ← Single-page frontend
    ├── style.css       ← Dark terminal UI
    └── script.js       ← Client logic (WebSocket, room join/create)
```

**How it works (high-level):**

```
Browser ──── HTTPS ──── Tor Network ──── .onion ──── your Node.js server
              ↕ WebSocket (Socket.io)
```

- Rooms live in RAM only (Node.js Map). No database.
- Messages auto-expire when server restarts or room empties.
- No IP logging. No identity tracking. No persistent data.

---

## 2. Quick Start (Local)

### Prerequisites
- Node.js v18+ → https://nodejs.org
- npm (comes with Node)

### Steps

```bash
# 1. Enter project folder
cd anonchat

# 2. Install dependencies
npm install

# 3. Start server
npm start

# 4. Open browser
# Go to: http://localhost:3000
```

You'll see the ANONCHAT landing page. Create a room, share the room name + key with a friend, and start chatting.

---

## 3. Tor Onion Setup (Linux)

This makes your chat accessible as a `.onion` address — no public IP, no domain, fully anonymous.

### Step 1: Install Tor

```bash
# Debian / Ubuntu / Kali
sudo apt update
sudo apt install tor -y

# Arch Linux
sudo pacman -S tor

# Fedora / CentOS
sudo dnf install tor -y
```

### Step 2: Configure torrc

Open the Tor config file:

```bash
sudo nano /etc/tor/torrc
```

Add these lines at the **bottom**:

```
HiddenServiceDir /var/lib/tor/anonchat/
HiddenServicePort 80 127.0.0.1:3000
```

- `HiddenServiceDir` — where Tor stores your .onion keys
- `HiddenServicePort 80` — Tor listens on port 80 externally
- `127.0.0.1:3000` — forwards to your Node.js server

Save and exit (Ctrl+X, Y, Enter).

### Step 3: Restart Tor

```bash
sudo systemctl restart tor
sudo systemctl enable tor   # auto-start on boot
```

### Step 4: Get Your .onion Address

```bash
sudo cat /var/lib/tor/anonchat/hostname
```

Output example:
```
ab3kf7x2mno9plqr.onion
```

This is your permanent .onion address. **Share it instead of an IP.**

### Step 5: Start ANONCHAT Server

```bash
cd anonchat
npm start
```

### Step 6: Test in Tor Browser

1. Download Tor Browser: https://www.torproject.org/download/
2. Open it
3. Go to: `http://ab3kf7x2mno9plqr.onion` (your address)
4. You should see the ANONCHAT landing page

> **Note:** First load may take 10–30 seconds. Tor routes through 3 relays.

---

## 4. Tor Onion Setup (Windows)

### Method A: Using the Expert Bundle (Recommended)

**Step 1: Download Tor Expert Bundle**
- Go to: https://www.torproject.org/download/tor/
- Download "Windows Expert Bundle"
- Extract to: `C:\tor\`

**Step 2: Create torrc config**

Create file: `C:\tor\torrc` with content:

```
HiddenServiceDir C:\tor\hidden_service\
HiddenServicePort 80 127.0.0.1:3000
SocksPort 9050
```

Create the folder:
```
mkdir C:\tor\hidden_service
```

**Step 3: Run Tor with config**

Open Command Prompt as Administrator:
```cmd
C:\tor\tor.exe -f C:\tor\torrc
```

**Step 4: Get .onion address**

```cmd
type C:\tor\hidden_service\hostname
```

**Step 5: Start Node server**

Open another CMD:
```cmd
cd anonchat
npm start
```

**Step 6: Test**
Open Tor Browser → navigate to your `.onion` address.

### Method B: WSL2 (Windows Subsystem for Linux)

If you have WSL2 installed (Ubuntu):
```bash
# Inside WSL2
sudo apt install tor -y
# Follow Linux guide above
```

This is often more stable than the Windows Expert Bundle.

---

## 5. Free Deployment Guide

### Primary Method: Run Locally + Expose via Tor

**Cost: $0. No VPS needed.**

```
Your PC → Node.js server → Tor hidden service → .onion address
```

The server only needs to be running when you want to chat.

**Keep it running while you sleep using pm2:**

```bash
# Install pm2 globally
npm install -g pm2

# Start anonchat with pm2
cd anonchat
pm2 start server.js --name anonchat

# Auto-restart on reboot
pm2 startup
pm2 save

# View logs
pm2 logs anonchat

# Stop
pm2 stop anonchat
```

### Optional: Free VPS Options

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Oracle Cloud | Always-free VM (ARM) | Best option, generous RAM |
| Render.com | Free tier | Sleeps after 15min idle |
| Railway.app | Free starter | $5/month credit |
| Fly.io | Free hobby | 256MB RAM |

For Oracle Cloud (best free option):

```bash
# On Oracle VM
sudo apt update && sudo apt install nodejs npm tor -y
git clone your-repo OR scp files
cd anonchat && npm install
# Configure torrc (see Linux guide above)
pm2 start server.js --name anonchat
```

---

## 6. Security Best Practices

### A. Rate Limiting (Already Implemented)

The server already has:
- **API rate limiting**: 30 requests/minute per session
- **Socket rate limiting**: 20 messages per 10 seconds per socket
- **Input sanitization**: All text stripped of HTML, max 2000 chars

To tighten limits, edit `server.js`:
```js
// In the apiLimiter config:
max: 10,             // reduce from 30
windowMs: 60 * 1000, // per minute

// In socket message handler:
if (limit.count > 5) { ... }  // reduce from 20
```

### B. Prevent Brute Force on Room Keys

Room keys are SHA-256 hashed. To add brute-force protection:

```bash
npm install express-slow-down
```

Add to `server.js` before apiLimiter:
```js
const slowDown = require("express-slow-down");
const speedLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 5,
  delayMs: () => 500,  // add 500ms delay after 5 attempts
});
app.use("/api/room/join", speedLimiter);
```

### C. Avoid Logging Sensitive Data

The server already avoids logging:
- Socket IP addresses
- Room keys (only hashes stored)
- Usernames tied to any identity

**Never add** `console.log(socket.handshake.address)` or log request IPs.

For production, disable all console logs or pipe to `/dev/null`:
```bash
pm2 start server.js --name anonchat --log /dev/null
```

### D. Deanonymization Risks — READ THIS

| Risk | How it happens | Mitigation |
|------|----------------|------------|
| JavaScript exploits | Tor Browser JS could leak real IP | Use Tor Browser with Security Level "Safest" |
| Timing correlation | Server traffic timing analyzed by global adversary | Use onion services v3 |
| Room name/key sharing | You share credentials over non-Tor channel | Share only via Tor/.onion |
| Server compromise | Attacker gets your server, adds IP logging | Audit code regularly |
| Browser fingerprinting | Canvas, fonts, screen size | Tor Browser blocks most of this |
| Operational Security | You log in from your home IP at predictable times | Vary usage patterns |

### E. Optional: Add HTTPS Locally

For clearnet HTTPS (if deploying to a VPS with a domain):

```bash
npm install -g certbot
certbot certonly --standalone -d yourdomain.com
```

Then in `server.js`:
```js
const https = require("https");
const fs = require("fs");
const server = https.createServer({
  key:  fs.readFileSync("/etc/letsencrypt/live/yourdomain.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/yourdomain.com/fullchain.pem"),
}, app);
```

> For Tor-only deployment, HTTPS is **not needed** — Tor's encryption handles transport security end-to-end between client and hidden service.

### F. Upgrade Key Hashing to bcrypt (Optional)

SHA-256 is fast but bcrypt is better for password-like keys:

```bash
npm install bcrypt
```

Replace in `server.js`:
```js
const bcrypt = require("bcrypt");
const SALT_ROUNDS = 10;

// On create:
const keyHash = await bcrypt.hash(key, SALT_ROUNDS);

// On join:
const isValid = await bcrypt.compare(inputKey, storedHash);
```

> Note: bcrypt is async and adds ~100ms latency per validation — acceptable for a join, but don't use it in hot loops.

---

## 7. Troubleshooting

### "relay offline" shown on page

- The Node.js server isn't running.
- Run `npm start` in the `anonchat/` folder.
- Check Node is installed: `node --version`

### .onion address not loading

- Check Tor is running: `sudo systemctl status tor`
- Make sure `HiddenServiceDir` in torrc has correct permissions:
  ```bash
  sudo chown -R debian-tor:debian-tor /var/lib/tor/anonchat/
  sudo chmod 700 /var/lib/tor/anonchat/
  ```
- Restart Tor: `sudo systemctl restart tor`
- Wait 30–60 seconds for circuit to build

### "Room not found" when joining

- Room names are normalized to lowercase with dashes.
- "My Room" becomes "my-room".
- Both creator and joiner must use the exact same name.
- Rooms disappear when all users leave AND 1 hour passes. Recreate it.

### Port 3000 already in use

```bash
# Find what's using it
lsof -i :3000
# Kill it
kill -9 <PID>
# Or change PORT in server.js
const PORT = 3001;
```

### WebSocket not connecting

- If behind a proxy, ensure WebSocket upgrade headers are passed through.
- For nginx proxy:
  ```nginx
  location / {
      proxy_pass http://127.0.0.1:3000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
  }
  ```

---

## 8. Future Improvements

### Bonus Features (Not Yet Implemented)

1. **Self-destruct messages** — `{ text, destructAfter: 30 }` — client-side timer removes after N seconds
2. **End-to-End Encryption (E2EE)** — Use Web Crypto API:
   ```js
   // Client generates room key via ECDH
   const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-384" }, true, ["deriveKey"]);
   ```
3. **File sharing** — Accept binary blobs, store as temp Buffer, TTL-expire in 5 minutes
4. **QR code to join** — Use `qrcode.js` library client-side, encode `roomName` into QR
5. **Typing indicator** — `socket.emit("typing")` → broadcast `user_typing` → show "ghost_1234 is typing..."
6. **Room expiry timer** — Auto-delete rooms after 24h even if occupied
7. **Redis backend** — Replace in-memory Map with Redis for multi-process / multi-server scaling
8. **Message search** — Client-side text search through chat history
9. **Markdown rendering** — Use `marked.js` to render **bold**, `code`, etc.
10. **onion v3 + vanity address** — Use `mkp224o` to generate `.onion` with custom prefix

### Security Upgrades

- Move to **bcrypt** for key hashing
- Add **HMAC-signed join tokens** (currently random bytes, which is fine but HMAC adds integrity)
- Implement **honeypot fields** on the create/join forms to catch bots
- Add **room key rotation** — creator can re-key a room without recreating it

---

*Built for privacy. Use responsibly. You are responsible for how you use this software.*
