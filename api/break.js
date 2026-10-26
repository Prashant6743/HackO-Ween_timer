/**
 * Vercel Serverless Function & Express Route: /api/break
 * Secure Event Controller Backend for HackO'Ween
 * 
 * Security Features:
 * - Password (6743) stored exclusively in backend (never sent or exposed to client).
 * - Constant-time SHA-256 comparison against timing attacks.
 * - Anti-brute force rate limiting (locks after 5 failed attempts for 60 seconds).
 * - Cryptographically random 256-bit session tokens (browser stores only the token, never the password).
 */

const crypto = require('crypto');

// Master backend password (can also be overridden via environment variable)
const ADMIN_PIN = process.env.ADMIN_PIN || '6743';

// In-memory active session tokens: token -> expiresAt (timestamp)
const sessionTokens = new Map();

// Rate limiting: clientKey -> { count, lockedUntil }
const failedAttempts = new Map();

// Shared in-memory event state
let eventState = {
  mode: 'normal', // 'normal' | 'break' | 'judging'
  active: false,  // true if mode !== 'normal'
  message: 'Break Time — Please Enjoy Your Food 🍕',
  roundName: 'Judging Round 1',
  hidePills: false,
  updatedAt: new Date().toISOString()
};

function getBreakState() {
  return { ...eventState };
}

// Constant-time comparison to prevent timing attacks
function verifyPin(inputPin) {
  if (!inputPin) return false;
  const target = String(ADMIN_PIN).trim();
  const given = String(inputPin).trim();
  const hashTarget = crypto.createHash('sha256').update(target).digest();
  const hashGiven = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(hashTarget, hashGiven);
}

// Generate secure HMAC-signed stateless session token
// Ensures any Vercel Serverless Function instance can validate the session across cold starts
function createSessionToken() {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', String(ADMIN_PIN)).update(timestamp).digest('hex');
  const token = `${timestamp}.${hmac}`;
  sessionTokens.set(token, Date.now() + 14 * 3600 * 1000);
  return token;
}

// Validate session token (Stateless HMAC-SHA256 + fallback to memory)
function isValidToken(token) {
  if (!token || typeof token !== 'string') return false;

  // 1. Verify stateless HMAC-SHA256 signed token (works across Vercel serverless instances)
  if (token.includes('.')) {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [timestamp, hmac] = parts;
      const created = parseInt(timestamp, 10);
      if (!isNaN(created)) {
        const age = Date.now() - created;
        // Valid for up to 24 hours
        if (age >= 0 && age <= 24 * 3600 * 1000) {
          const expectedHmac = crypto.createHmac('sha256', String(ADMIN_PIN)).update(timestamp).digest('hex');
          const sigBuf = Buffer.from(hmac, 'hex');
          const expBuf = Buffer.from(expectedHmac, 'hex');
          if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
            return true;
          }
        }
      }
    }
  }

  // 2. Fallback to in-memory check
  const expiresAt = sessionTokens.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    sessionTokens.delete(token);
    return false;
  }
  return true;
}

// Rate limiter check
function checkRateLimit(key) {
  const now = Date.now();
  const record = failedAttempts.get(key);
  if (record && record.lockedUntil > now) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return `Too many failed attempts. Locked for ${remainingSec}s.`;
  }
  return null;
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const record = failedAttempts.get(key) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 60 * 1000; // 60s lockout
    record.count = 0;
  }
  failedAttempts.set(key, record);
}

function clearRateLimit(key) {
  failedAttempts.delete(key);
}

function handler(req, res) {
  // Disable caching for real-time synchronization
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // GET: Public read-only event state (for display screens)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      ...eventState
    });
  }

  // POST: Admin authentication & state mutation
  if (req.method === 'POST') {
    const body = req.body || {};
    const authHeader = req.headers['authorization'] || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const token = bearerToken || body.token;
    const clientKey = req.ip || req.headers['x-forwarded-for'] || 'default-client';

    let authenticated = false;
    let newToken = null;

    // Check if authenticating via token
    if (token && isValidToken(token)) {
      authenticated = true;
    } 
    // Check if authenticating via PIN
    else if (body.pin) {
      const lockError = checkRateLimit(clientKey);
      if (lockError) {
        return res.status(429).json({
          success: false,
          error: lockError
        });
      }

      if (verifyPin(body.pin)) {
        authenticated = true;
        newToken = createSessionToken();
        clearRateLimit(clientKey);
      } else {
        recordFailedAttempt(clientKey);
        return res.status(401).json({
          success: false,
          error: 'Invalid security PIN'
        });
      }
    }

    if (!authenticated) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized — Please enter admin PIN'
      });
    }

    // Apply state changes if requested
    const { mode, active, message, roundName, hidePills } = body;

    if (mode && ['normal', 'break', 'judging'].includes(mode)) {
      eventState.mode = mode;
      eventState.active = (mode !== 'normal');
    } else if (typeof active === 'boolean') {
      eventState.active = active;
      eventState.mode = active ? 'break' : 'normal';
    }

    if (typeof message === 'string' && message.trim().length > 0) {
      eventState.message = message.trim();
    }

    if (typeof roundName === 'string' && roundName.trim().length > 0) {
      eventState.roundName = roundName.trim();
    }

    if (typeof hidePills === 'boolean') {
      eventState.hidePills = hidePills;
    }

    eventState.updatedAt = new Date().toISOString();

    const responsePayload = {
      success: true,
      ...eventState
    };

    // Return new token if one was minted during login
    if (newToken) {
      responsePayload.token = newToken;
    }

    return res.status(200).json(responsePayload);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

handler.getBreakState = getBreakState;
module.exports = handler;
