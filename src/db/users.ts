import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';
import type { GenerationMode, ResumeTemplateId } from '../types/resume.ts';

function isConfiguredAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS || 'ezanwalmani@gmail.com';
  const allowed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null) {
  try {
    const adminRole: 'user' | 'admin' = isConfiguredAdminEmail(email) ? 'admin' : 'user';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: displayName ?? null,
        displayName: displayName ?? null,
        role: adminRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName !== undefined ? { displayName } : {}),
          ...(adminRole === 'admin' ? { role: 'admin' as const } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function updateUserPreferences(
  userId: number,
  prefs: {
    defaultMode?: GenerationMode;
    defaultTemplate?: ResumeTemplateId;
    displayName?: string | null;
    fullName?: string | null;
    phone?: string | null;
  },
) {
  try {
    const result = await db
      .update(users)
      .set({
        ...prefs,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserPreferences:', error);
    throw new Error('Failed to update user preferences.', { cause: error });
  }
}

export async function deleteUserAccountData(userId: number) {
  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch (error) {
    console.error('Database query failed in deleteUserAccountData:', error);
    throw new Error('Failed to delete account data.', { cause: error });
  }
}
