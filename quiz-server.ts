// @ts-ignore Supabase client dependency may not have installed type declarations.
import { createClient } from '@supabase/supabase-js';
type NextRequest = {
  headers: {
    get(name: string): string | null;
  };
};

// Server-only client. SUPABASE_SERVICE_ROLE_KEY must NOT have a NEXT_PUBLIC_ prefix.
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

// Identify the caller from the access token the browser sends
export async function getUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
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
