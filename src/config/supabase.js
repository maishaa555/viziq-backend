// src/config/supabase.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // use service key for server-side
);

// ─── Cache Helpers ────────────────────────────────────────────────────────────

/**
 * Look up a cached result by video identifier (YouTube ID or file hash).
 * Returns the full result row or null.
 */
export async function getCachedResult(videoIdentifier) {
  const { data, error } = await supabase
    .from("video_results")
    .select("*")
    .eq("video_identifier", videoIdentifier)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Save a result to cache.
 * @param {string} videoIdentifier - YouTube video ID or MD5 hash of file
 * @param {string} videoType - "youtube" | "upload"
 * @param {string} title - Video title
 * @param {object} result - Full structured result (transcript, summary, infographic HTML, keyPoints)
 */
export async function saveResult(videoIdentifier, videoType, title, result) {
  const { data, error } = await supabase
    .from("video_results")
    .upsert(
      {
        video_identifier: videoIdentifier,
        video_type: videoType,
        title,
        transcript: result.transcript,
        summary: result.summary,
        key_points: result.keyPoints,
        infographic_html: result.infographicHtml,
        ocr_text: result.ocrText || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "video_identifier" }
    )
    .select()
    .single();

  if (error) {
    console.error("❌ Failed to save result to Supabase:", error.message);
    return null;
  }
  return data;
}