// src/services/youtubeService.js
/**
 * YouTube Transcript Service
 *
 * Strategy: Use YouTube's internal Android client API.
 * YouTube treats Android app requests differently and provides caption tracks.
 * This avoids the server-side blocking issue that affects web scraping.
 */

import axios from "axios";

const ANDROID_API_KEY = "AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM394";
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: "19.09.37",
    androidSdkVersion: 30,
    hl: "en",
    gl: "US",
    utcOffsetMinutes: 0,
  },
};

/**
 * Extract YouTube video ID from any valid YouTube URL.
 */
export function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch video metadata + caption URL via Android client API.
 */
async function fetchPlayerData(videoId) {
  const response = await axios.post(
    `https://www.youtube.com/youtubei/v1/player?key=${ANDROID_API_KEY}`,
    {
      videoId,
      context: INNERTUBE_CONTEXT,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "19.09.37",
      },
      timeout: 15000,
    }
  );
  return response.data;
}

/**
 * Parse YouTube's timed XML caption format into plain text.
 */
function parseXmlCaptions(xml) {
  const lines = [];
  // Match <text start="..." dur="...">...</text>
  const regex = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, "") // strip any inner tags
      .trim();
    if (text) lines.push(text);
  }
  return lines.join(" ");
}

/**
 * Main function: fetch real transcript from YouTube video.
 * Returns { transcript, title, duration }
 */
export async function getYouTubeTranscript(videoId) {
  console.log(`📺 Fetching YouTube data for: ${videoId}`);

  const playerData = await fetchPlayerData(videoId);

  // ── Extract title & duration ──────────────────────────────────────────────
  const title =
    playerData?.videoDetails?.title || "Untitled Video";
  const duration = parseInt(
    playerData?.videoDetails?.lengthSeconds || "0",
    10
  );

  console.log(`🎬 Title: "${title}" | Duration: ${duration}s`);

  // ── Find caption tracks ───────────────────────────────────────────────────
  const captionTracks =
    playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  if (captionTracks.length === 0) {
    throw new Error(
      "No captions available for this video. Try a video with subtitles enabled (lectures, tutorials, talks)."
    );
  }

  // Prefer English captions; fallback to first available
  const preferred =
    captionTracks.find((t) => t.languageCode === "en") ||
    captionTracks.find((t) => t.languageCode?.startsWith("en")) ||
    captionTracks[0];

  console.log(`📝 Using caption track: ${preferred.languageCode}`);

  // ── Download caption XML ──────────────────────────────────────────────────
  const captionResponse = await axios.get(preferred.baseUrl, {
    headers: {
      "User-Agent":
        "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
    },
    timeout: 10000,
  });

  const transcript = parseXmlCaptions(captionResponse.data);

  if (!transcript || transcript.length < 50) {
    throw new Error("Transcript appears empty or too short to process.");
  }

  console.log(`✅ Transcript fetched: ${transcript.length} characters`);

  return { transcript, title, duration };
}