export function notFound(req, res) {
  res.status(404).json({
    message: "Endpoint not found.",
    error: "Endpoint not found.",
  });
}

export function errorHandler(error, req, res, next) {
  const normalizedStatus = Number(error?.status || error?.statusCode);
  const status = Number.isInteger(normalizedStatus) && normalizedStatus >= 400 && normalizedStatus < 600
    ? normalizedStatus
    : 500;
  const message = error?.message || "Unexpected server error.";

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  res.status(status).json({
    message,
    error: message,
  });
}
