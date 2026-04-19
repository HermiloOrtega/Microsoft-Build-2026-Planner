import { Request, Response, NextFunction } from 'express';

/**
 * Blocks all non-GET requests unless the X-Master-Password header matches
 * the MASTER_PASSWORD environment variable.
 * If MASTER_PASSWORD is not configured, all requests pass through.
 */
export function requireMasterPassword(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET') return next();

  const master = process.env.MASTER_PASSWORD;
  if (!master || master.trim() === '') return next(); // not configured → open

  const provided = req.headers['x-master-password'];
  if (provided !== master) {
    return res.status(401).json({ error: 'Invalid master password' });
  }

  next();
}
