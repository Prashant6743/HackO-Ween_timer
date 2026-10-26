/**
 * Vercel Serverless Function: /api/time
 * Returns authoritative server time in ISO 8601 UTC.
 */

module.exports = (req, res) => {
  // Disable caching so countdown sync is always real-time
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  res.status(200).json({
    serverTime: new Date().toISOString(),
    targets: {
      // Official HackO'Ween schedule: Oct 27, 2026 7:00 PM IST (13:30 UTC) to Oct 28, 2026 7:00 AM IST (01:30 UTC)
      hackathonStart: '2026-10-27T13:30:00.000Z',
      hackathonEnd:   '2026-10-28T01:30:00.000Z'
    }
  });
};
