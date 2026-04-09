# 🔐 OPS-ANONYME — Anonymous Chat System

> No identity. No traces. No mercy.

[![Live Demo](https://img.shields.io/badge/Live-ops--anonyme--production.up.railway.app-00ff90?style=for-the-badge)](https://ops-anonyme-production.up.railway.app)
[![GitHub](https://img.shields.io/badge/GitHub-ravirscott%2Fops--anonyme-181717?style=for-the-badge&logo=github)](https://github.com/ravirscott/ops-anonyme)
[![Railway](https://img.shields.io/badge/Deployed%20on-Railway-8B5CF6?style=for-the-badge)](https://railway.app)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org)

---

## 🌐 Live Site

```
https://ops-anonyme-production.up.railway.app
```

---

## 🎯 Kya Hai Yeh?

**OPS-ANONYME** ek fully anonymous, real-time chat platform hai jahan:

- ✅ Koi login nahi — koi identity nahi
- ✅ Koi IP store nahi hota
- ✅ Messages RAM mein hain — server restart pe sab gone
- ✅ Har user ko random anonymous username milta hai
- ✅ Room password se protected hoti hai
- ✅ Tor (.onion) hidden service pe bhi run kar sakta hai

---

## ✨ Features

### 💬 Chat System
- **Real-time messaging** — WebSockets (Socket.io) se instant messages
- **Random usernames** — jaise `ghost_4821`, `void_7392`, `phantom_1337`
- **Timestamps** — har message pe time dikhai deta hai
- **Session history** — join karne pe last 50 messages milte hain
- **Sound notifications** — naya message aane pe ping

### 🏠 Room System
- **Room banao** — naam + secret key se
- **Room join karo** — same naam + key se
- **Multiple rooms** — ek saath kai rooms active
- **Member count** — kitne log online hain
- **Auto cleanup** — 1 ghante baad empty rooms delete

### 🔐 Security
- **SHA-256 hashing** — room keys hashed store hoti hain
- **Timing-safe comparison** — timing attacks se protection
- **One-time join tokens** — 30 second expiry
- **Rate limiting** — 30 API req/min, 20 msg/10sec per user
- **XSS protection** — sab input sanitize hota hai
- **No IP logging** — privacy first

### 🎨 UI/UX
- **Dark CRT terminal theme** — neon green + black
- **Scanline + noise effects** — authentic hacker feel
- **Mobile responsive** — phone pe bhi kaam karta hai
- **Copy invite link** — room info share karo
- **Sound toggle** — notifications on/off

---

## 🚀 Kaise Use Karein

### Room Banana
1. Site kholo: [ops-anonyme-production.up.railway.app](https://ops-anonyme-production.up.railway.app)
2. **"CREATE ROOM"** section mein:
   - Room Name daalo — jaise `secret-ops`
   - Secret Key daalo — jaise `mypassword123`
3. **"INITIALIZE ROOM"** click karo
4. Automatically room mein enter ho jaoge

### Room Join Karna
1. Site kholo
2. **"JOIN ROOM"** section mein:
   - Wahi Room Name daalo jo creator ne rakha
   - Wahi Secret Key daalo
3. **"ACCESS ROOM"** click karo
4. Chat shuru!

### Tips
- Room name automatically lowercase + dashes mein convert hota hai
- `My Room` → `my-room` ban jaata hai
- Dono log same naam aur key use karein
- Room sirf tab tak exist karta hai jab tak koi online ho

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time | Socket.io (WebSockets) |
| Security | crypto (built-in), express-rate-limit |
| Frontend | Vanilla HTML + CSS + JS |
| Fonts | Share Tech Mono (Google Fonts) |
| Deployment | Railway.app |
| Storage | In-memory (RAM only) |

---

## 📁 Project Structure

```
ops-anonyme/
├── server.js          ← Node.js backend
├── package.json       ← Dependencies
├── README.md          ← Yeh file
└── public/
    ├── index.html     ← Single page app
    ├── style.css      ← Dark terminal UI
    └── script.js      ← Real-time chat logic
```

---

## 💻 Local Setup (Apne PC pe Chalana)

```bash
# 1. Clone karo
git clone https://github.com/ravirscott/ops-anonyme.git
cd ops-anonyme

# 2. Dependencies install karo
npm install express socket.io express-rate-limit

# 3. Server chalao
node server.js

# 4. Browser mein kholo
# http://localhost:3000
```

---

## 🧅 Tor .onion Setup (Advanced)

Agar Tor Browser installed hai:

```
# torrc mein add karo:
HiddenServiceDir C:\tor\hidden_service\
HiddenServicePort 80 127.0.0.1:3000

# Tor chalao
tor.exe -f C:\tor\torrc

# .onion address lo
type C:\tor\hidden_service\hostname
```

Full guide: [GUIDE.md](./GUIDE.md)

---

## 🔮 Future Features (Coming Soon)

- [ ] Self-destruct messages (30 sec baad delete)
- [ ] End-to-End Encryption (E2EE) via Web Crypto API
- [ ] Typing indicator (`ghost_1234 is typing...`)
- [ ] File sharing (temporary, 5 min expiry)
- [ ] QR code to join room
- [ ] Custom .onion vanity address
- [ ] Message search
- [ ] Markdown support

---

## ⚠️ Disclaimer

Yeh project **educational purposes** ke liye banaya gaya hai. Privacy aur anonymity tools ke responsible use ke liye bana hai. Illegal activities ke liye use mat karo. Tum apne actions ke liye khud zimmedaar ho.

---

## 👨‍💻 Developer

**Ravir** — Independent Developer, Artist & Author  
📍 Sonma Village, Begusarai, Bihar, India  
🐙 GitHub: [@ravirscott](https://github.com/ravirscott)

---

## 📄 License

MIT License — Free to use, modify, distribute.

---

<div align="center">

**Built with 🔐 for privacy. No logs. No traces. No mercy.**

[🌐 Live Site](https://ops-anonyme-production.up.railway.app) • [📂 GitHub](https://github.com/ravirscott/ops-anonyme)

</div>
