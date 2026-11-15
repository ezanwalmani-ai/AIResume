import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import type { GenerationMode, ResumeTemplateId } from '../types/resume.ts';

export interface DbUser {
  id: number;
  uuid: string;
  uid: string;
  email: string;
  fullName: string | null;
  displayName: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  defaultMode: GenerationMode;
  defaultTemplate: ResumeTemplateId;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUser;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty authentication token.' });
    return;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const email = decodedToken.email || `${decodedToken.uid}@user.local`;
    const displayName = typeof decodedToken.name === 'string' ? decodedToken.name : null;
    const dbUser = await getOrCreateUser(decodedToken.uid, email, displayName);
    req.dbUser = {
      id: dbUser.id,
      uuid: dbUser.uuid,
      uid: dbUser.uid,
      email: dbUser.email,
      fullName: dbUser.fullName,
      displayName: dbUser.displayName,
      phone: dbUser.phone,
      role: dbUser.role,
      defaultMode: dbUser.defaultMode,
      defaultTemplate: dbUser.defaultTemplate,
    };

    next();
  } catch (error) {
    console.error('Authentication verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.dbUser || req.dbUser.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: Administrator privileges are required.' });
    return;
  }
  next();
};
