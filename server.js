const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./src/routes/auth");
const queueRoutes = require("./src/routes/queueRoutes");

const app = express();

// 🔥 FIX : empêcher les réponses 304
app.set("etag", false);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(cors());
app.use(express.json());

// Route principale
app.get("/", (req, res) => {
    res.json({ message: "Sixsence Backend API is running" });
});

// Utiliser les routes Discord
app.use("/", authRoutes);
app.use("/", queueRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Sixsence Backend running on port ${PORT}`);
});
