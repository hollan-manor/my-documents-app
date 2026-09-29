import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

// Server-only client. SUPABASE_SERVICE_ROLE_KEY must NOT have a NEXT_PUBLIC_ prefix.
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

const peek = (v?: string) => (v ? `${v.slice(0, 10)}… (length ${v.length})` : 'MISSING');

// Identify the caller from the access token the browser sends
export async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || token === 'undefined') {
    console.log('[quiz] no access token received from the browser');
    return null;
  }
  const { data, error } = await admin().auth.getUser(token);
  if (error) {
    console.log('[quiz] getUser failed:', error.message);
    console.log('[quiz] service key:', peek(process.env.SUPABASE_SERVICE_ROLE_KEY));
    console.log('[quiz] supabase url:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  }
  return data.user ?? null;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}