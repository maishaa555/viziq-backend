// src/middleware/upload.js
/**
 * Multer middleware for handling offline video uploads.
 * Limits: 100MB, only video MIME types.
 */

import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-msvideo", // .avi
    "video/x-matroska", // .mkv
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`), false);
  }
};

const MAX_SIZE_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || "100", 10);

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024,
  },
}).single("video");

/**
 * Promise-wrapped version for use in async route handlers.
 */
export function handleUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          reject(new Error(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`));
        } else {
          reject(new Error(`Upload error: ${err.message}`));
        }
      } else if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}