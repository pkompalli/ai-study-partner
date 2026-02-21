import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
// import { env } from '../config/env.js';

// AUTH DISABLED — all requests get a fixed dev user. Re-enable by swapping the bodies below.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = { id: 'dev-user', email: 'dev@localhost' };
  next();

  // --- real auth (uncomment to re-enable) ---
  // const authHeader = req.headers.authorization;
  // if (!authHeader?.startsWith('Bearer ')) {
  //   res.status(401).json({ error: 'Missing authorization header' });
  //   return;
  // }
  // const token = authHeader.slice(7);
  // try {
  //   const payload = jwt.verify(token, env.JWT_SECRET) as { id: string; email: string };
  //   req.user = { id: payload.id, email: payload.email };
  //   next();
  // } catch {
  //   res.status(401).json({ error: 'Invalid or expired token' });
  // }
}
