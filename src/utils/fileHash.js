// src/utils/fileHash.js
/**
 * Compute a quick MD5-like hash of a file for cache keying.
 * We read only the first + last 64KB for speed on large files.
 */

import fs from "fs/promises";
import crypto from "crypto";

export async function hashFile(filePath) {
  const CHUNK_SIZE = 64 * 1024; // 64KB

  const stat = await fs.stat(filePath);
  const fileSize = stat.size;

  const fd = await fs.open(filePath, "r");
  const hash = crypto.createHash("md5");

  try {
    // Read first chunk
    const firstChunk = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize));
    await fd.read(firstChunk, 0, firstChunk.length, 0);
    hash.update(firstChunk);

    // If file is large, also read last chunk
    if (fileSize > CHUNK_SIZE * 2) {
      const lastChunk = Buffer.alloc(CHUNK_SIZE);
      await fd.read(lastChunk, 0, CHUNK_SIZE, fileSize - CHUNK_SIZE);
      hash.update(lastChunk);
    }

    // Include file size in hash to differentiate same-start files
    hash.update(fileSize.toString());
  } finally {
    await fd.close();
  }

  return hash.digest("hex");
}