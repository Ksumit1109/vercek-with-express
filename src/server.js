import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import healthCheck from "./routes/health-check.route.js";
import YoutubeRoutes from "./routes/youtube.route.js";
import InstagramRoutes from "./routes/instagram.route.js";
import FacebookRoutes from "./routes/facebook.route.js";
import TiktokRoutes from "./routes/tiktok.route.js";

const app = express();

app.use(express.json({ extended: false }));
app.use(cors());

app.use("/", healthCheck);
// API Routes
app.use('/api/youtube', YoutubeRoutes);
app.use('/api/instagram', InstagramRoutes);
app.use('/api/facebook', FacebookRoutes);
app.use('/api/tiktok', TiktokRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

