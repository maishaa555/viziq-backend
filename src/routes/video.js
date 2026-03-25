// src/routes/video.js
/**
 * Video Processing Routes
 *
 * POST /api/video/youtube   - Process a YouTube URL
 * POST /api/video/upload    - Process an uploaded video file
 * GET  /api/video/:id       - Retrieve a cached result by DB row ID
 */

import { Router } from "express";
import fs from "fs/promises";
import { handleUpload } from "../middleware/upload.js";
import { extractYouTubeId, getYouTubeTranscript } from "../services/youtubeService.js";
import { extractFrames } from "../services/frameService.js";
import {
  analyzeTranscriptAndFrames,
  analyzeTranscriptOnly,
  generateInfographic,
} from "../services/geminiService.js";
import { getCachedResult, saveResult } from "../config/supabase.js";
import { hashFile } from "../utils/fileHash.js";

export const videoRouter = Router();

// ─── POST /api/video/youtube ──────────────────────────────────────────────────
videoRouter.post("/youtube", async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "YouTube URL is required." });

    // 1. Extract video ID
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL. Could not extract video ID." });
    }

    console.log(`\n▶️  YouTube request: ${videoId}`);

    // 2. Check cache first
    const cached = await getCachedResult(videoId);
    if (cached) {
      console.log(`✅ Cache hit for: ${videoId}`);
      return res.json({
        fromCache: true,
        id: cached.id,
        title: cached.title,
        transcript: cached.transcript,
        summary: cached.summary,
        keyPoints: cached.key_points,
        infographicHtml: cached.infographic_html,
        ocrText: cached.ocr_text,
        createdAt: cached.created_at,
      });
    }

    // 3. Fetch transcript from YouTube (Android API)
    const { transcript, title, duration } = await getYouTubeTranscript(videoId);

    // 4. Analyze with Gemini (text-only for YouTube — we can't extract frames from a URL server-side)
    const analysis = await analyzeTranscriptOnly({ transcript, title });

    // 5. Generate infographic HTML
    const infographicHtml = await generateInfographic(analysis, title);

    // 6. Build result object
    const result = {
      transcript,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      infographicHtml,
      ocrText: null,
    };

    // 7. Save to cache
    const saved = await saveResult(videoId, "youtube", title, result);

    return res.json({
      fromCache: false,
      id: saved?.id,
      title,
      duration,
      ...result,
      analysis, // full analysis object for frontend to use (topics, timeline, etc.)
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/video/upload ───────────────────────────────────────────────────
videoRouter.post("/upload", async (req, res, next) => {
  let filePath = null;

  try {
    // 1. Handle multipart upload
    await handleUpload(req, res);

    if (!req.file) {
      return res.status(400).json({ error: "No video file provided." });
    }

    filePath = req.file.path;
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, ""); // strip extension
    const title = originalName || "Uploaded Video";

    console.log(`\n📁 Uploaded file: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(1)}MB)`);

    // 2. Hash file for cache key
    const fileHash = await hashFile(filePath);
    console.log(`🔑 File hash: ${fileHash}`);

    // 3. Check cache
    const cached = await getCachedResult(fileHash);
    if (cached) {
      console.log(`✅ Cache hit for uploaded file hash: ${fileHash}`);
      await fs.unlink(filePath).catch(() => {}); // clean up
      return res.json({
        fromCache: true,
        id: cached.id,
        title: cached.title,
        transcript: cached.transcript,
        summary: cached.summary,
        keyPoints: cached.key_points,
        infographicHtml: cached.infographic_html,
        ocrText: cached.ocr_text,
        createdAt: cached.created_at,
      });
    }

    // 4. Extract frames + OCR (this is the multimodal advantage for uploaded videos)
    const { frames, combinedOcrText } = await extractFrames(filePath);

    // 5. We don't have audio extraction (requires Whisper which needs GPU/paid tier).
    //    For uploaded videos, use OCR text + frame vision as the transcript.
    //    If transcript is provided in form-data, use that.
    const manualTranscript = req.body?.transcript || "";
    const transcript =
      manualTranscript ||
      combinedOcrText ||
      "No transcript available. Analysis based on visual frames only.";

    // 6. Multimodal analysis — transcript + frames + OCR
    const analysis = await analyzeTranscriptAndFrames({
      transcript,
      ocrText: combinedOcrText,
      frames,
      title,
    });

    // 7. Generate infographic
    const infographicHtml = await generateInfographic(analysis, title);

    // 8. Build result
    const result = {
      transcript,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      infographicHtml,
      ocrText: combinedOcrText,
    };

    // 9. Save to cache
    const saved = await saveResult(fileHash, "upload", title, result);

    // 10. Clean up uploaded file (saved in Supabase, no need to keep on disk)
    await fs.unlink(filePath).catch(() => {});

    return res.json({
      fromCache: false,
      id: saved?.id,
      title,
      framesExtracted: frames.length,
      ...result,
      analysis,
    });
  } catch (err) {
    // Clean up file on error
    if (filePath) await fs.unlink(filePath).catch(() => {});
    next(err);
  }
});

// ─── GET /api/video/:id ───────────────────────────────────────────────────────
videoRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await (await import("../config/supabase.js")).supabase
      .from("video_results")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Result not found." });
    }

    return res.json({
      id: data.id,
      title: data.title,
      transcript: data.transcript,
      summary: data.summary,
      keyPoints: data.key_points,
      infographicHtml: data.infographic_html,
      ocrText: data.ocr_text,
      createdAt: data.created_at,
      videoType: data.video_type,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/video (list recent results) ─────────────────────────────────────
videoRouter.get("/", async (req, res, next) => {
  try {
    const { data, error } = await (await import("../config/supabase.js")).supabase
      .from("video_results")
      .select("id, title, video_type, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return res.json({ results: data });
  } catch (err) {
    next(err);
  }
});