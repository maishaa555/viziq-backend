// src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { videoRouter } from "./routes/video.js";
import { healthRouter } from "./routes/health.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting (protect free tier) ───────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait 15 minutes before trying again.",
  },
});
app.use("/api/", limiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/video", videoRouter);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 ViziQ Backend running on http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? "✅ loaded" : "❌ missing"}`);
  console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL ? "✅ loaded" : "❌ missing"}\n`);
});

export default app;