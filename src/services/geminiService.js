// src/services/geminiService.js
/**
 * Gemini AI Service - The Brain of ViziQ
 *
 * Uses Gemini 1.5 Flash (free tier: 15 req/min, 1500 req/day)
 *
 * Two main functions:
 * 1. analyzeTranscriptAndFrames() - multimodal fusion → structured intelligence
 * 2. generateInfographic() - creates beautiful HTML infographic sheet
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = "gemini-1.5-flash"; // Free tier

// ─── Step 1: Multimodal Analysis ──────────────────────────────────────────────

/**
 * Send transcript + OCR text + frame images to Gemini for deep analysis.
 * Returns: { summary, keyPoints, topics, timeline, hasVisualContent }
 */
export async function analyzeTranscriptAndFrames({
  transcript,
  ocrText,
  frames, // array of { base64, timestamp }
  title,
}) {
  console.log("🧠 Running Gemini multimodal analysis...");

  const model = genAI.getGenerativeModel({ model: MODEL });

  // Build prompt parts — text first, then images
  const parts = [];

  parts.push({
    text: `You are analyzing a video titled: "${title}".

TRANSCRIPT:
${transcript.slice(0, 8000)} ${transcript.length > 8000 ? "[...truncated...]" : ""}

${
  ocrText
    ? `TEXT VISIBLE IN VIDEO FRAMES (from OCR):
${ocrText.slice(0, 2000)}`
    : ""
}

Analyze all provided information including the video frames below and return a JSON response with EXACTLY this structure:
{
  "summary": "2-3 paragraph comprehensive summary of the video content",
  "keyPoints": [
    {
      "title": "Short title",
      "detail": "1-2 sentence explanation",
      "emoji": "relevant emoji"
    }
  ],
  "topics": ["topic1", "topic2", "..."],
  "timeline": [
    {
      "phase": "Phase name",
      "description": "What happens in this phase"
    }
  ],
  "hasFlowchart": true/false (does the content have a process/steps/flow that can be a flowchart?),
  "flowchartSteps": ["Step 1", "Step 2", "..."] (if hasFlowchart, list the steps),
  "contentType": "lecture|tutorial|talk|documentary|other",
  "difficulty": "beginner|intermediate|advanced",
  "hasVisualContent": true/false (did the video frames contain meaningful diagrams/text/slides?)
}

Rules:
- keyPoints: 6–10 items
- timeline: 3–6 phases
- Be specific, use actual content from the video, not generic statements
- Respond ONLY with valid JSON, no markdown backticks, no extra text`,
  });

  // Attach frame images for vision analysis (max 6 to stay within limits)
  const framesToSend = frames.slice(0, 6);
  for (const frame of framesToSend) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: frame.base64,
      },
    });
    parts.push({
      text: `[Frame at ${frame.timestamp}s]`,
    });
  }

  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  const responseText = result.response.text();

  // Strip any accidental markdown fences
  const cleaned = responseText.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    console.log(`✅ Analysis complete. Key points: ${parsed.keyPoints?.length}`);
    return parsed;
  } catch (err) {
    console.error("❌ JSON parse failed:", cleaned.slice(0, 200));
    throw new Error("Gemini returned malformed JSON. Try again.");
  }
}

// ─── Step 2: Infographic Generation ──────────────────────────────────────────

/**
 * Generate a beautiful standalone HTML infographic sheet from structured data.
 * This is the "visual sheet" that replaces needing to watch the video.
 */
export async function generateInfographic(analysisData, title) {
  console.log("🎨 Generating HTML infographic...");

  const model = genAI.getGenerativeModel({ model: MODEL });

  const { summary, keyPoints, topics, timeline, flowchartSteps, hasFlowchart, contentType } =
    analysisData;

  const prompt = `Generate a COMPLETE, BEAUTIFUL standalone HTML infographic for the video "${title}".

Content to visualize:
- Summary: ${summary}
- Key Points: ${JSON.stringify(keyPoints)}
- Topics: ${topics?.join(", ")}
- Timeline phases: ${JSON.stringify(timeline)}
${hasFlowchart ? `- Process Flow: ${flowchartSteps?.join(" → ")}` : ""}
- Content type: ${contentType}

Requirements for the HTML:
1. Complete self-contained HTML file (no external dependencies except Google Fonts)
2. Beautiful dark theme: background #0f0f1a, cards with subtle gradients
3. MUST include ALL these sections:
   a) Hero header: video title + 3 stat badges (topics count, key points count, content type)
   b) Executive Summary: styled card with the summary text
   c) Key Insights grid: cards with emoji, title, detail for EACH key point
   d) Topics cloud: pill badges for each topic
   e) Timeline section: vertical timeline with phases (SVG-styled connector line)
   ${hasFlowchart ? `f) Process Flowchart: SVG flowchart showing the ${flowchartSteps?.length} steps with arrows` : "f) Visual diagram: an SVG illustration relevant to the content"}
4. Typography: Import "Space Grotesk" from Google Fonts for headings, "Inter" for body
5. Color accents: use gradient from #6366f1 to #8b5cf6 (indigo-violet) for highlights
6. Cards: rounded-xl, subtle box-shadow, hover:transform scale(1.02) transition
7. The flowchart/SVG MUST be drawn using real SVG elements (rect, circle, path, text) - not placeholders
8. Fully responsive - works on mobile
9. At the very bottom: a footer "Generated by ViziQ • viziq.app"

Return ONLY the complete HTML code. No explanation. No markdown. Just the raw HTML starting with <!DOCTYPE html>.`;

  const result = await model.generateContent(prompt);
  const html = result.response.text().trim();

  // Ensure we got actual HTML
  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    throw new Error("Gemini did not return valid HTML for infographic.");
  }

  console.log(`✅ Infographic HTML generated: ${html.length} chars`);
  return html;
}

// ─── YouTube-only fast path (no frames) ──────────────────────────────────────

/**
 * For YouTube videos where we can't extract frames server-side.
 * Text-only analysis via Gemini.
 */
export async function analyzeTranscriptOnly({ transcript, title }) {
  return analyzeTranscriptAndFrames({
    transcript,
    ocrText: "",
    frames: [],
    title,
  });
}