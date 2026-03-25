// src/middleware/errorHandler.js

export function errorHandler(err, req, res, next) {
  console.error("❌ Error:", err.message);

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";

  // Don't leak stack traces in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(status).json(response);
}