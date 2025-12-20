// In-memory store for rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 5; // 5 requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute window

/**
 * Check if a request is within rate limits
 * @param {Object} req - The request object
 * @returns {{ allowed: boolean, remaining?: number, retryAfter?: number }}
 */
export function checkRateLimit(req) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Get or initialize request history for this IP
  let requests = requestCounts.get(ip) || [];

  // Filter to only include requests within the current window
  requests = requests.filter((timestamp) => timestamp > windowStart);

  if (requests.length >= RATE_LIMIT) {
    const oldestRequest = Math.min(...requests);
    const retryAfter = Math.ceil((oldestRequest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Add current request
  requests.push(now);
  requestCounts.set(ip, requests);

  return { allowed: true, remaining: RATE_LIMIT - requests.length };
}

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  for (const [ip, requests] of requestCounts.entries()) {
    const validRequests = requests.filter(
      (timestamp) => timestamp > windowStart
    );
    if (validRequests.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, validRequests);
    }
  }
}, 60 * 1000); // Run cleanup every minute
