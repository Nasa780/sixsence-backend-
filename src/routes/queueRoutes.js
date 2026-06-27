const express = require("express");
const supabase = require("../utils/supabase");
const { authMiddleware } = require("../../middleware/auth.js");

const router = express.Router();

/* ---------------------------------------------------------
   QUEUE EN MÉMOIRE (identique à ta version)
--------------------------------------------------------- */
let queue = {};

/* ---------------------------------------------------------
   FONCTION : Nettoyer les entrées expirées (identique)
--------------------------------------------------------- */
function clearExpired() {
  const now = Date.now();
  for (const id in queue) {
    const entry = queue[id];
    const elapsed = (now - entry.joinedAt) / 1000;

    if (elapsed >= entry.duration) {
      delete queue[id];
    }
  }
}

/* ---------------------------------------------------------
   POST /queue/join
--------------------------------------------------------- */
router.post("/queue/join", authMiddleware, (req, res) => {
  clearExpired();

  const discord_id = req.user.discord_id;

  // Déjà dans la file
  if (queue[discord_id]) {
    const entry = queue[discord_id];
    const elapsed = (Date.now() - entry.joinedAt) / 1000;
    const timeLeft = Math.max(entry.duration - elapsed, 0);

    return res.json({
      inQueue: true,
      timeLeft,
      message: "Tu es déjà dans la file",
    });
  }

  // Nouvelle entrée
  queue[discord_id] = {
    username: req.user.username,
    avatar: req.user.avatar,
    joinedAt: Date.now(),
    duration: 30 * 60, // 30 minutes
  };

  return res.json({
    inQueue: true,
    timeLeft: 30 * 60,
    message: "Tu as rejoint la file",
  });
});

/* ---------------------------------------------------------
   POST /queue/leave
--------------------------------------------------------- */
router.post("/queue/leave", authMiddleware, (req, res) => {
  clearExpired();

  const discord_id = req.user.discord_id;

  if (queue[discord_id]) {
    delete queue[discord_id];
  }

  return res.json({
    inQueue: false,
    message: "Tu as quitté la file",
  });
});

/* ---------------------------------------------------------
   GET /queue/status
--------------------------------------------------------- */
router.get("/queue/status", authMiddleware, (req, res) => {
  clearExpired();

  const discord_id = req.user.discord_id;

  if (!queue[discord_id]) {
    return res.json({
      inQueue: false,
      message: "Tu n’es pas dans la file",
    });
  }

  const entry = queue[discord_id];
  const elapsed = (Date.now() - entry.joinedAt) / 1000;
  const timeLeft = Math.max(entry.duration - elapsed, 0);

  return res.json({
    inQueue: true,
    timeLeft,
    message: "Tu es dans la file",
  });
});

/* ---------------------------------------------------------
   GET /queue/list
   → Pour afficher les joueurs dans la file
--------------------------------------------------------- */
router.get("/queue/list", authMiddleware, (req, res) => {
  clearExpired();

  const players = Object.entries(queue).map(([id, data]) => ({
    discord_id: id,
    username: data.username,
    avatar: data.avatar,
    joinedAt: data.joinedAt,
  }));

  return res.json({ players });
});

module.exports = router;
