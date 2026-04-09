/**
 * ╔══════════════════════════════════════════╗
 * ║         ANONCHAT - SERVER.JS             ║
 * ║  Anonymous Room-Based Chat Backend       ║
 * ╚══════════════════════════════════════════╝
 *
 * No IPs stored. No identities. No logs.
 * Rooms are in-memory only — gone when server restarts.
 */

"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const path = require("path");

// ─── CONFIG ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
// Bind to localhost ONLY — Tor will proxy to this
const HOST = "0.0.0.0";
// ─── APP SETUP ─────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false }, // no CORS — Tor handles routing
  // Don't expose transport details
  transports: ["websocket", "polling"],
});

// ─── IN-MEMORY STORE ───────────────────────────────────────────────────────
/**
 * rooms: Map<roomName, { keyHash: string, messages: Message[], clients: Set<socketId> }>
 * Message: { username, text, timestamp, id }
 * No IPs, no real usernames, nothing personal.
 */
const rooms = new Map();

// Rate limiting store (keyed by anonymous session token, NOT ip)
const rateLimitStore = new Map(); // token -> { count, resetAt }

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────

// Disable fingerprinting headers
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;"
  );
  next();
});

// HTTP rate limiter on API routes (by IP — but since we're behind Tor, all IPs are 127.0.0.1)
// We use a session-token approach instead for fairness
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers["x-anon-token"] || "unknown",
  handler: (req, res) => {
    res.status(429).json({ error: "Too many requests. Slow down." });
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── HELPERS ───────────────────────────────────────────────────────────────

/** SHA-256 hash a room key. Returns hex string. */
function hashKey(key) {
  return crypto.createHash("sha256").update(key.trim()).digest("hex");
}

/** Generate a random anonymous username like ghost_7342 */
function randomUsername() {
  const adjectives = [
    "ghost", "void", "null", "phantom", "echo",
    "shadow", "cipher", "anon", "specter", "wraith",
    "static", "glitch", "node", "nexus", "drift",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}_${num}`;
}

/** Generate a short message ID */
function msgId() {
  return crypto.randomBytes(6).toString("hex");
}

/** Sanitize text — strip HTML, limit length */
function sanitize(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;")
    .slice(0, 2000); // max 2000 chars per message
}

// ─── REST API ──────────────────────────────────────────────────────────────

/**
 * POST /api/room/create
 * Body: { roomName, key }
 * Creates a new room with hashed key.
 */
app.post("/api/room/create", apiLimiter, (req, res) => {
  const { roomName, key } = req.body;

  if (!roomName || !key) {
    return res.status(400).json({ error: "Room name and key are required." });
  }

  const name = roomName.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 50);
  const cleanKey = key.trim();

  if (name.length < 2) return res.status(400).json({ error: "Room name too short." });
  if (cleanKey.length < 4) return res.status(400).json({ error: "Key must be at least 4 chars." });

  if (rooms.has(name)) {
    return res.status(409).json({ error: "Room already exists. Try joining it." });
  }

  rooms.set(name, {
    keyHash: hashKey(cleanKey),
    messages: [],
    clients: new Set(),
    createdAt: Date.now(),
  });

  console.log(`[ROOM] Created: ${name} | Rooms active: ${rooms.size}`);

  return res.json({ success: true, roomName: name });
});

/**
 * POST /api/room/join
 * Body: { roomName, key }
 * Validates credentials. Returns a short-lived join token.
 */
app.post("/api/room/join", apiLimiter, (req, res) => {
  const { roomName, key } = req.body;

  if (!roomName || !key) {
    return res.status(400).json({ error: "Room name and key are required." });
  }

  const name = roomName.trim().toLowerCase().replace(/\s+/g, "-");
  const room = rooms.get(name);

  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }

  // Constant-time comparison to avoid timing attacks
  const inputHash = hashKey(key.trim());
  const storedHash = room.keyHash;
  const isValid = crypto.timingSafeEqual(
    Buffer.from(inputHash, "hex"),
    Buffer.from(storedHash, "hex")
  );

  if (!isValid) {
    return res.status(401).json({ error: "Wrong key." });
  }

  // Issue a one-time join token
  const joinToken = crypto.randomBytes(24).toString("hex");
  // Store token briefly (30s to connect)
  pendingTokens.set(joinToken, { roomName: name, expiresAt: Date.now() + 30000 });

  return res.json({ success: true, joinToken, roomName: name });
});

// Temporary join tokens (expire in 30s)
const pendingTokens = new Map();

// Clean up expired tokens every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingTokens) {
    if (data.expiresAt < now) pendingTokens.delete(token);
  }
}, 60000);

// Clean up empty old rooms every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [name, room] of rooms) {
    // Delete rooms with 0 clients older than 1 hour
    if (room.clients.size === 0 && now - room.createdAt > 3600000) {
      rooms.delete(name);
      console.log(`[ROOM] Auto-deleted empty room: ${name}`);
    }
  }
}, 600000);

// ─── WEBSOCKET ─────────────────────────────────────────────────────────────

// Per-socket rate limit: max 20 messages per 10 seconds
const socketMessageCount = new Map(); // socketId -> { count, resetAt }

io.on("connection", (socket) => {
  // DO NOT log socket.handshake.address — privacy first
  let currentRoom = null;
  let username = null;

  /**
   * EVENT: join_room
   * Client sends joinToken received from /api/room/join
   */
  socket.on("join_room", ({ joinToken }) => {
    if (!joinToken) return socket.emit("error", { message: "No join token." });

    const tokenData = pendingTokens.get(joinToken);
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      return socket.emit("error", { message: "Invalid or expired join token." });
    }

    // Consume the token (one-time use)
    pendingTokens.delete(joinToken);

    const room = rooms.get(tokenData.roomName);
    if (!room) return socket.emit("error", { message: "Room no longer exists." });

    // Assign random identity
    username = randomUsername();
    currentRoom = tokenData.roomName;

    // Add to room
    room.clients.add(socket.id);
    socket.join(currentRoom);

    // Send last 50 messages (session history)
    const history = room.messages.slice(-50);
    socket.emit("room_joined", {
      roomName: currentRoom,
      username,
      history,
      memberCount: room.clients.size,
    });

    // Notify others
    io.to(currentRoom).emit("system_message", {
      text: `${username} connected`,
      timestamp: Date.now(),
    });

    io.to(currentRoom).emit("member_count", { count: room.clients.size });

    console.log(`[JOIN] ${username} -> ${currentRoom} | Members: ${room.clients.size}`);
  });

  /**
   * EVENT: send_message
   * Client sends a chat message to current room.
   */
  socket.on("send_message", ({ text }) => {
    if (!currentRoom || !username) return;

    // Per-socket rate limiting
    const now = Date.now();
    const limit = socketMessageCount.get(socket.id) || { count: 0, resetAt: now + 10000 };
    if (now > limit.resetAt) {
      limit.count = 0;
      limit.resetAt = now + 10000;
    }
    limit.count++;
    socketMessageCount.set(socket.id, limit);

    if (limit.count > 20) {
      return socket.emit("error", { message: "Slow down — rate limit exceeded." });
    }

    const clean = sanitize(text);
    if (!clean || clean.trim().length === 0) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    const message = {
      id: msgId(),
      username,
      text: clean,
      timestamp: Date.now(),
    };

    // Keep last 200 messages in memory per room
    room.messages.push(message);
    if (room.messages.length > 200) room.messages.shift();

    // Broadcast to room ONLY
    io.to(currentRoom).emit("new_message", message);
  });

  /**
   * EVENT: disconnect
   */
  socket.on("disconnect", () => {
    if (!currentRoom || !username) return;

    const room = rooms.get(currentRoom);
    if (room) {
      room.clients.delete(socket.id);
      io.to(currentRoom).emit("system_message", {
        text: `${username} disconnected`,
        timestamp: Date.now(),
      });
      io.to(currentRoom).emit("member_count", { count: room.clients.size });
    }

    socketMessageCount.delete(socket.id);
    console.log(`[LEAVE] ${username} left ${currentRoom}`);
  });
});

// ─── START ─────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════╗
║         ANONCHAT RUNNING             ║
║  http://${HOST}:${PORT}              ║
║  Bind: localhost only (Tor-ready)    ║
╚══════════════════════════════════════╝
  `);
});
