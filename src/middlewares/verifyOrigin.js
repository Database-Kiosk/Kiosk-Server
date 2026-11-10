import env from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CSRF defense (together with SameSite=Strict cookies):
// state-changing requests sent by a browser from another origin are rejected.
// Requests without an Origin header (e.g. curl, server-to-server) are allowed.
export default function verifyOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('Origin');
  if (origin && origin !== env.corsOrigin) {
    res.status(403).json({ message: '허용되지 않은 요청 출처입니다.' });
    return;
  }

  next();
}
