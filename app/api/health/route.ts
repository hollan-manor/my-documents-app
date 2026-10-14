import { NextResponse } from 'next/server';

export async function GET() {
  const names = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LLM_BASE_URL',
    'LLM_API_KEY',
    'LLM_MODEL',
  ];
  return NextResponse.json(Object.fromEntries(names.map((n) => [n, Boolean(process.env[n]?.trim())])));
}