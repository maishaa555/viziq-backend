# ViziQ Backend 🎬→🧠

> **"Turn Videos into Structured Intelligence"**  
> Complete Node.js backend for the ViziQ hackathon project.

---

## Architecture

```
YouTube URL / Video File
        ↓
  [Route Handler]
        ↓
  ┌─────────────────────────────────┐
  │         Cache Check              │  ← Supabase (same video? instant)
  └─────────────────────────────────┘
        ↓ (cache miss)
  ┌──────────────┐  ┌──────────────────────┐
  │  YouTube     │  │  Uploaded Video       │
  │  Android API │  │  ffmpeg frame extract │
  │  → Transcript│  │  + Tesseract OCR      │
  └──────────────┘  └──────────────────────┘
        ↓                    ↓
  ┌─────────────────────────────────────────┐
  │     Gemini 1.5 Flash (Multimodal)        │
  │  Transcript + OCR text + Frame images    │
  │  → summary, keyPoints, timeline,         │
  │    flowchart, topics, contentType        │
  └─────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────┐
  │     Gemini → HTML Infographic Generator  │
  │  Beautiful standalone HTML visual sheet  │
  └─────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────┐
  │          Supabase Cache Save             │
  └─────────────────────────────────────────┘
        ↓
     JSON Response → Frontend
```

---

## Setup (Step by Step)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/viziq-backend.git
cd viziq-backend
npm install
```

### 2. System Requirements

Install **ffmpeg** and **tesseract**:

```bash
# Ubuntu/Debian (Railway uses this)
sudo apt-get install ffmpeg tesseract-ocr tesseract-ocr-eng

# macOS
brew install ffmpeg tesseract

# Windows
# Download ffmpeg: https://ffmpeg.org/download.html
# Download tesseract: https://github.com/UB-Mannheim/tesseract/wiki
```

### 3. Get API Keys (All Free)

| Service | What to do | Link |
|---------|-----------|------|
| **Gemini API** | Sign in → Create API key | https://aistudio.google.com/app/apikey |
| **Supabase** | Create project → copy URL + keys | https://supabase.com/dashboard |

### 4. Set Up Supabase Database

1. Go to your Supabase project → **SQL Editor**
2. Paste the contents of `supabase_migration.sql`
3. Click **Run**

### 5. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual keys
```

`.env` file:
```env
PORT=3001
GEMINI_API_KEY=AIza...your_key
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your_service_key
FRONTEND_URL=http://localhost:5173
```

### 6. Run Locally

```bash
npm run dev
# Server starts at http://localhost:3001
```

Test it:
```bash
curl http://localhost:3001/api/health
```

---

## API Reference

### `POST /api/video/youtube`

Process a YouTube video URL.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:**
```json
{
  "fromCache": false,
  "id": "uuid-of-saved-result",
  "title": "Video Title",
  "duration": 212,
  "transcript": "Full transcript text...",
  "summary": "2-3 paragraph summary...",
  "keyPoints": [
    { "title": "Point 1", "detail": "...", "emoji": "🔑" }
  ],
  "infographicHtml": "<!DOCTYPE html>...",
  "analysis": {
    "topics": ["AI", "Machine Learning"],
    "timeline": [...],
    "hasFlowchart": true,
    "flowchartSteps": ["Step 1", "Step 2"]
  }
}
```

---

### `POST /api/video/upload`

Process an uploaded video file.

**Request:** `multipart/form-data`
- `video`: video file (mp4, webm, avi, mkv, mov) — max 100MB
- `transcript` (optional): manual transcript text

**Response:** Same structure as YouTube endpoint + `framesExtracted` count.

---

### `GET /api/video/:id`

Retrieve a previously processed result by its UUID.

---

### `GET /api/video`

List recent 20 processed videos (id, title, type, date).

---

## Deployment on Railway (Free Tier)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway new

# Deploy
railway up

# Set env vars in Railway dashboard → Variables tab
```

**Free tier limits:**
- 500 hours/month compute (enough for hackathon)
- 1GB memory
- Auto-sleep after inactivity

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| Android YouTube API | Bypasses server-side blocking that affects all other approaches |
| Gemini 1.5 Flash | Free tier, supports multimodal (text + images), 1M context window |
| MD5 partial hash | Fast cache key for large uploaded files without reading whole file |
| Supabase | Free Postgres + easy setup + RLS for security |
| Tesseract.js | Free OCR, runs in-process, no external service needed |
| Railway | Supports Dockerfile, has ffmpeg/tesseract, free tier for hackathon |

---

## Free Tier Limits to Watch

| Service | Limit | Our Usage |
|---------|-------|-----------|
| Gemini Flash | 15 req/min, 1500/day | 2 calls per video |
| Supabase DB | 500MB storage | ~1KB per result |
| Railway | 500h/month compute | Fine for demo |
| Tesseract | Unlimited (local) | ✅ |

---

## Project Structure

```
viziq-backend/
├── src/
│   ├── index.js              # Express server entry
│   ├── config/
│   │   └── supabase.js       # DB client + cache helpers
│   ├── routes/
│   │   ├── health.js         # GET /api/health
│   │   └── video.js          # POST /youtube, /upload, GET /:id
│   ├── services/
│   │   ├── youtubeService.js # Android API transcript fetcher
│   │   ├── frameService.js   # ffmpeg extraction + OCR
│   │   └── geminiService.js  # AI analysis + infographic generator
│   ├── middleware/
│   │   ├── upload.js         # Multer video upload handler
│   │   └── errorHandler.js   # Global error handler
│   └── utils/
│       └── fileHash.js       # Fast MD5 hash for cache key
├── supabase_migration.sql    # Run this in Supabase SQL editor
├── Dockerfile                # For Railway/Render deployment
├── railway.toml              # Railway config
└── .env.example              # Template for environment vars
```