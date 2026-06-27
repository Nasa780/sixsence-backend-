const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../middleware/auth");
const supabase = require("../supabase");

router.get("/leaderboard/top10", authMiddleware, async (req, res) => {
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("points", { ascending: false })
    .limit(10);

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .order("points", { ascending: false })
    .limit(10);

  res.json({ players, teams });
});

module.exports = router;
