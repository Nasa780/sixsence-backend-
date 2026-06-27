const express = require("express");
const jwt = require("jsonwebtoken");
const supabase = require("../utils/supabase");

const router = express.Router();

/* ---------------------------------------------------------
   MIDDLEWARE : Récupérer l'utilisateur depuis le token
--------------------------------------------------------- */
async function getUserFromToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: "Aucun token fourni" });

  const token = authHeader.split(" ")[1] || authHeader;

  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", decoded.discord_id)
      .single();

    if (error || !user)
      return res.status(401).json({ error: "Utilisateur introuvable" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalide" });
  }
}

/* ---------------------------------------------------------
   QUEUE EN MÉMOIRE (simple pour commencer)
   queue = {
     discord_id: {
       username,
       avatar,
       joinedAt,
       duration
     }
   }
--------------------------------------------------------- */
let queue = {};

/* ---------------------------------------------------------
   FONCTION : Nettoyer les entrées expirées
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
router.post("/queue/join", getUserFromToken, (req, res) => {
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
router.post("/queue/leave", getUserFromToken, (req, res) => {
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
router.get("/queue/status", getUserFromToken, (req, res) => {
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
router.get("/queue/list", (req, res) => {
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
