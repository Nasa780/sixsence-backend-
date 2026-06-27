const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const supabase = require("../utils/supabase");

require("dotenv").config();


// ---------------------------------------------
// 1) REDIRECTION VERS DISCORD
// ---------------------------------------------
router.get("/auth/discord", (req, res) => {
  const redirect = `https://discord.com/oauth2/authorize?client_id=${
    process.env.DISCORD_CLIENT_ID
  }&redirect_uri=${encodeURIComponent(
    process.env.DISCORD_REDIRECT_URI
  )}&response_type=code&scope=identify%20email`;

  res.redirect(redirect);
});

// ---------------------------------------------
// 2) CALLBACK DISCORD
// ---------------------------------------------
router.get("/auth/discord/callback", async (req, res) => {
  const code = req.query.code;
  console.log("CODE REÇU :", code);

  // 🔥 Correction : ignorer les callbacks sans code SANS redirection
  if (!code) {
    console.log("CALLBACK SANS CODE → IGNORÉ");
    return res.status(200).send("Callback ignoré");
  }

  try {
    // Échanger le code contre un access_token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Récupérer les infos utilisateur Discord
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const discordUser = userResponse.data;
    console.log("Utilisateur Discord :", discordUser);

    // ---------------------------------------------
    // 3) INSÉRER / METTRE À JOUR L'UTILISATEUR DANS SUPABASE
    // ---------------------------------------------
const { data: existingUser, error: selectError } = await supabase
  .from("users")
  .select("*")
  .eq("discord_id", discordUser.id)
  .single();

console.log("SELECT ERROR :", selectError);
console.log("EXISTING USER :", existingUser);

if (!existingUser) {
  const { error: insertError } = await supabase.from("users").insert([
    {
      discord_id: discordUser.id,
      username: discordUser.username,
      avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
      email: discordUser.email || null,
    },
  ]);

  console.log("INSERT ERROR :", insertError);
} else {
  const { error: updateError } = await supabase
    .from("users")
    .update({
      username: discordUser.username,
      avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
    })
    .eq("discord_id", discordUser.id);

  console.log("UPDATE ERROR :", updateError);
}

    // ---------------------------------------------
    // 4) CRÉER UN TOKEN JWT POUR LE FRONTEND
    // ---------------------------------------------
    const token = jwt.sign(
      {
        discord_id: discordUser.id,
      },
      process.env.SESSION_SECRET,
      { expiresIn: "7d" }
    );

    // Redirection vers le frontend AVEC le token
    return res.redirect(`http://localhost:3000?token=${token}`);

  } catch (err) {
    console.log("===== ERREUR DISCORD =====");
    console.log(err.response?.data || err);
    console.log("===== FIN ERREUR =====");
    return res.send("Erreur lors de la connexion Discord");
  }
});

// ---------------------------------------------
// 5) ROUTE /me → RENVOIE L'UTILISATEUR CONNECTÉ
// ---------------------------------------------
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET);

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", decoded.discord_id)
      .single();

    if (error) return res.status(400).json({ error });

    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
