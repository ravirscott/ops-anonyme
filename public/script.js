/**
 * ╔═══════════════════════════════════════╗
 * ║       ANONCHAT — SCRIPT.JS            ║
 * ║  Client-side logic. No tracking.      ║
 * ╚═══════════════════════════════════════╝
 */

"use strict";

// ─── STATE ────────────────────────────────────────────────────────────────
let socket = null;
let currentRoom = null;
let myUsername = null;
let joinToken = null;
let soundEnabled = true;
let pendingJoinRoomName = null; // store room name for display after join

// ─── SOCKET.IO INIT ───────────────────────────────────────────────────────
function initSocket() {
  if (socket && socket.connected) return;

  socket = io({
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    setConnStatus(true);
    // If we have a pending join (e.g. after reconnect), re-join
    if (joinToken) {
      socket.emit("join_room", { joinToken });
    }
  });

  socket.on("disconnect", () => {
    setConnStatus(false);
  });

  socket.on("connect_error", () => {
    setConnStatus(false);
  });

  // ── ROOM JOINED ──────────────────────────────
  socket.on("room_joined", ({ roomName, username, history, memberCount }) => {
    currentRoom = roomName;
    myUsername = username;
    joinToken = null; // consumed

    // Switch to chat screen
    showScreen("chat");
    document.getElementById("chat-room-name").textContent = "#" + roomName;
    document.getElementById("my-username").textContent = username;
    document.getElementById("welcome-room").textContent = "#" + roomName;
    document.getElementById("chat-member-count").textContent = memberCount + " online";

    // Render history
    const body = document.getElementById("chat-body");
    body.innerHTML = ""; // clear
    body.appendChild(makeWelcomeBlock(roomName));

    history.forEach(renderMessage);
    scrollToBottom();
  });

  // ── NEW MESSAGE ──────────────────────────────
  socket.on("new_message", (msg) => {
    const isOwn = msg.username === myUsername;
    renderMessage(msg, isOwn);
    scrollToBottom();
    if (!isOwn && soundEnabled) playPing();
  });

  // ── SYSTEM MESSAGE ───────────────────────────
  socket.on("system_message", ({ text }) => {
    renderSystemMessage(text);
    scrollToBottom();
  });

  // ── MEMBER COUNT ─────────────────────────────
  socket.on("member_count", ({ count }) => {
    document.getElementById("chat-member-count").textContent = count + " online";
  });

  // ── ERRORS ───────────────────────────────────
  socket.on("error", ({ message }) => {
    showToast("⚠ " + message, "error");
  });
}

// ─── SCREEN MANAGEMENT ───────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
}

// ─── CONNECTION STATUS ────────────────────────────────────────────────────
function setConnStatus(online) {
  const dot = document.getElementById("conn-dot");
  const label = document.getElementById("conn-status");
  if (!dot || !label) return;
  if (online) {
    dot.className = "status-dot online";
    label.textContent = "relay connected";
  } else {
    dot.className = "status-dot offline";
    label.textContent = "relay offline";
  }
}

// ─── CREATE ROOM ──────────────────────────────────────────────────────────
async function createRoom() {
  const nameEl = document.getElementById("create-name");
  const keyEl = document.getElementById("create-key");
  const msgEl = document.getElementById("create-msg");
  const btn = document.querySelector("#card-create .btn");

  const roomName = nameEl.value.trim();
  const key = keyEl.value.trim();

  if (!roomName || !key) {
    return showFormMsg(msgEl, "Both fields required.", "error");
  }
  if (key.length < 4) {
    return showFormMsg(msgEl, "Key must be at least 4 characters.", "error");
  }

  setLoading(btn, true);
  showFormMsg(msgEl, "", "");

  try {
    const res = await fetch("/api/room/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, key }),
    });
    const data = await res.json();

    if (!res.ok) {
      showFormMsg(msgEl, data.error || "Error creating room.", "error");
    } else {
      showFormMsg(msgEl, `Room "${data.roomName}" created! Joining...`, "success");
      // Auto-join after creating
      nameEl.value = "";
      keyEl.value = "";
      await doJoin(data.roomName, key, "join-msg");
    }
  } catch (e) {
    showFormMsg(msgEl, "Network error. Is the server running?", "error");
  } finally {
    setLoading(btn, false);
  }
}

// ─── JOIN ROOM ────────────────────────────────────────────────────────────
async function joinRoom() {
  const nameEl = document.getElementById("join-name");
  const keyEl = document.getElementById("join-key");
  const msgEl = document.getElementById("join-msg");
  const btn = document.querySelector("#card-join .btn");

  const roomName = nameEl.value.trim();
  const key = keyEl.value.trim();

  if (!roomName || !key) {
    return showFormMsg(msgEl, "Both fields required.", "error");
  }

  setLoading(btn, true);
  showFormMsg(msgEl, "", "");

  await doJoin(roomName, key, "join-msg");
  setLoading(btn, false);
}

// Shared join logic
async function doJoin(roomName, key, msgId) {
  const msgEl = document.getElementById(msgId);

  try {
    const res = await fetch("/api/room/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, key }),
    });
    const data = await res.json();

    if (!res.ok) {
      showFormMsg(msgEl, data.error || "Could not join.", "error");
      return;
    }

    // Store token, init socket, send join event
    joinToken = data.joinToken;
    initSocket();
    if (socket.connected) {
      socket.emit("join_room", { joinToken });
    }
    // socket.on("room_joined") handles screen switch
  } catch (e) {
    showFormMsg(msgEl, "Network error. Is the server running?", "error");
  }
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────
function sendMessage() {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text || !socket || !currentRoom) return;

  socket.emit("send_message", { text });
  input.value = "";
  input.style.height = "auto";
  updateCharCount(input);
  input.focus();
}

function handleMsgKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ─── RENDER MESSAGES ──────────────────────────────────────────────────────
function renderMessage(msg, isOwn) {
  const body = document.getElementById("chat-body");

  const div = document.createElement("div");
  div.className = "msg" + (isOwn ? " mine" : "");
  div.dataset.msgId = msg.id;

  const header = document.createElement("div");
  header.className = "msg-header";

  const user = document.createElement("span");
  user.className = "msg-user";
  user.textContent = msg.username;

  const time = document.createElement("span");
  time.className = "msg-time";
  time.textContent = formatTime(msg.timestamp);

  header.appendChild(user);
  header.appendChild(time);

  const text = document.createElement("div");
  text.className = "msg-text";
  text.textContent = msg.text; // textContent = XSS safe

  div.appendChild(header);
  div.appendChild(text);
  body.appendChild(div);
}

function renderSystemMessage(text) {
  const body = document.getElementById("chat-body");
  const div = document.createElement("div");
  div.className = "msg-system";
  div.textContent = text;
  body.appendChild(div);
}

function makeWelcomeBlock(roomName) {
  const div = document.createElement("div");
  div.className = "chat-welcome";
  div.innerHTML = `
    <div class="welcome-glyph">⬡</div>
    <p>You are in <strong>#${roomName}</strong></p>
    <p class="welcome-sub">Messages live in RAM only. When all users leave, history is gone.</p>
  `;
  return div;
}

// ─── LEAVE ROOM ───────────────────────────────────────────────────────────
function leaveRoom() {
  if (socket) socket.disconnect();
  currentRoom = null;
  myUsername = null;
  joinToken = null;
  document.getElementById("chat-body").innerHTML = "";
  showScreen("home");
  // Reconnect socket for home screen status
  setTimeout(initSocket, 300);
}

// ─── UTILITIES ────────────────────────────────────────────────────────────
function formatTime(ts) {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function scrollToBottom() {
  const body = document.getElementById("chat-body");
  body.scrollTop = body.scrollHeight;
}

function showFormMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + type;
}

function setLoading(btn, loading) {
  const text = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".btn-loader");
  btn.disabled = loading;
  if (loading) {
    text?.classList.add("hidden");
    loader?.classList.remove("hidden");
  } else {
    text?.classList.remove("hidden");
    loader?.classList.add("hidden");
  }
}

function togglePassword(id, btn) {
  const input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
  } else {
    input.type = "password";
    btn.textContent = "👁";
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
  updateCharCount(el);
}

function updateCharCount(el) {
  const count = el.value.length;
  const max = 2000;
  const countEl = document.getElementById("char-count");
  if (!countEl) return;
  countEl.textContent = `${count} / ${max}`;
  countEl.className =
    count >= max ? "char-count at-limit" :
    count >= max * 0.8 ? "char-count near-limit" :
    "char-count";
}

// ─── COPY INVITE ──────────────────────────────────────────────────────────
function copyInvite() {
  if (!currentRoom) return;
  const text = `Room: ${currentRoom}\nJoin at: ${window.location.href}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Room info copied!");
  }).catch(() => {
    showToast("Could not copy. Select manually.", "error");
  });
}

// ─── SOUND ────────────────────────────────────────────────────────────────
function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById("sound-btn");
  btn.textContent = soundEnabled ? "🔔" : "🔕";
  showToast(soundEnabled ? "Sound ON" : "Sound OFF");
}

function playPing() {
  try {
    // Generate a simple beep via Web Audio API — no external files
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) { /* silently fail if AudioContext blocked */ }
}

// ─── TOAST ────────────────────────────────────────────────────────────────
let toastTimeout = null;

function showToast(msg, type = "success") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.borderColor = type === "error" ? "var(--red)" : "var(--green)";
  toast.style.color = type === "error" ? "var(--red)" : "var(--green)";
  toast.style.boxShadow = type === "error"
    ? "0 0 8px #ff3b3b88"
    : "0 0 8px #00ff9088";

  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ─── INIT ─────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initSocket();

  // Focus first input
  const nameInput = document.getElementById("create-name");
  if (nameInput) nameInput.focus();

  // Enter key support on home screen inputs
  document.getElementById("create-key")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createRoom();
  });
  document.getElementById("join-key")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinRoom();
  });

  // Char counter on msg input
  document.getElementById("msg-input")?.addEventListener("input", function () {
    updateCharCount(this);
  });
});
