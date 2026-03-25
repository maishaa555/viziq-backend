// src/services/frameService.js
/**
 * Frame Extraction + OCR Service
 *
 * Pipeline:
 * 1. Extract N evenly-spaced frames from a video using ffmpeg
 * 2. Run Tesseract OCR on each frame to extract visible text
 * 3. Encode frames as base64 for Gemini Vision analysis
 * 4. Clean up temporary files
 */
 
import ffmpeg from "fluent-ffmpeg";
import Tesseract from "tesseract.js";
import fs from "fs/promises";
import { mkdirSync } from "fs"; 
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
 
const FRAMES_DIR = path.join(process.cwd(), "frames");
const FRAMES_PER_VIDEO = parseInt(process.env.FRAMES_PER_VIDEO || "8", 10);
 
// Ensure frames directory exists (safe sync check at module load)

mkdirSync(FRAMES_DIR, { recursive: true });
 
/**
 * Get video duration in seconds using ffmpeg probe.
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });
}
 
/**
 * Extract a single frame at a specific timestamp (in seconds).
 */
function extractFrameAt(videoPath, timestamp, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .outputOptions(["-vframes 1", "-q:v 2"])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}
 
/**
 * Run OCR on an image file. Returns extracted text string.
 */
async function runOCR(imagePath) {
  try {
    const result = await Tesseract.recognize(imagePath, "eng", {
      logger: () => {}, // suppress verbose logs
    });
    return result.data.text.trim();
  } catch {
    return "";
  }
}
 
/**
 * Resize frame and convert to base64 for Gemini Vision.
 * Keep size small to avoid token limits.
 */
async function frameToBase64(imagePath) {
  const resized = await sharp(imagePath)
    .resize(512, 288, { fit: "inside" }) // 512px wide max
    .jpeg({ quality: 75 })
    .toBuffer();
  return resized.toString("base64");
}
 
/**
 * Main export: Extract frames from a video file.
 * Returns { frames: [{ timestamp, base64, ocrText }], combinedOcrText }
 */
export async function extractFrames(videoPath) {
  const sessionId = uuidv4();
  const sessionDir = path.join(FRAMES_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });
 
  console.log(`🎞️  Starting frame extraction (${FRAMES_PER_VIDEO} frames)...`);
 
  let duration = 0;
  try {
    duration = await getVideoDuration(videoPath);
  } catch {
    console.warn("⚠️  Could not get duration — using 60s default");
    duration = 60;
  }
 
  // Evenly distribute frame timestamps, skip first/last 5% (usually blank)
  const start = duration * 0.05;
  const end = duration * 0.95;
  const step = (end - start) / (FRAMES_PER_VIDEO - 1);
 
  const frames = [];
  const ocrLines = [];
 
  for (let i = 0; i < FRAMES_PER_VIDEO; i++) {
    const timestamp = start + step * i;
    const framePath = path.join(sessionDir, `frame_${i}.jpg`);
 
    try {
      await extractFrameAt(videoPath, timestamp, framePath);
      const [base64, ocrText] = await Promise.all([
        frameToBase64(framePath),
        runOCR(framePath),
      ]);
 
      frames.push({
        index: i,
        timestamp: Math.round(timestamp),
        base64,
        ocrText,
      });
 
      if (ocrText) ocrLines.push(ocrText);
      console.log(`  ✅ Frame ${i + 1}/${FRAMES_PER_VIDEO} @ ${Math.round(timestamp)}s`);
    } catch (err) {
      console.warn(`  ⚠️  Frame ${i + 1} failed: ${err.message}`);
    }
  }
 
  // Cleanup temp frame files
  await fs.rm(sessionDir, { recursive: true, force: true });
 
  const combinedOcrText = ocrLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse excess blank lines
    .trim();
 
  console.log(
    `✅ Frame extraction done. OCR text: ${combinedOcrText.length} chars`
  );
 
  return { frames, combinedOcrText };
}
 