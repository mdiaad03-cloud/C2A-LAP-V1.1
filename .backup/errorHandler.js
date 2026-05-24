export function notFound(req, res) {
  const message = "Endpoint not found.";
  res.status(404).json({
    success: false,
    message,
    error: message,
  });
}

export function errorHandler(error, req, res, next) {
  const status = Number(error?.status || error?.statusCode || 400);
  const message = error?.message || "Unexpected error.";

  if (status >= 500) {
    console.error("Unhandled request error:", {
      path: req.originalUrl,
      method: req.method,
      message,
      stack: error?.stack,
    });
  }

  res.status(status).json({
    success: false,
    message,
    error: message,
    ...(process.env.NODE_ENV !== "production" && error?.stack
      ? { stack: error.stack }
      : {}),
  });
}
