// src/routes/health.js
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "ViziQ Backend",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    env: {
      gemini: !!process.env.GEMINI_API_KEY,
      supabase: !!process.env.SUPABASE_URL,
    },
  });
});