import { NextRequest, NextResponse } from 'next/server';
import { admin, getUser } from '../../../lib/quiz-server';

function remarkFor(pct: number, weak: string[]): string {
  const focus = weak.length ? ` Revisit: ${weak.slice(0, 3).join(', ')}.` : '';
  if (pct === 100) return 'Perfect score. You have this handout down cold.';
  if (pct >= 80) return `Excellent work, you clearly know this material.${focus}`;
  if (pct >= 60) return `Good effort, you are nearly there.${focus}`;
  if (pct >= 40) return `A fair start, but this needs another read-through.${focus}`;
  return `Tough round, and that is fine. Re-read the handout, then try again.${focus}`;
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });

  const { docId, level, answers } = (await req.json()) as {
    docId: string;
    level: string;
    answers: Record<string, number | null>;
  };

  const sb = admin();
  const { data: quiz } = await sb
    .from('quizzes').select('questions').eq('doc_id', docId).eq('level', level).single();
  if (!quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });

  const byId = new Map<string, any>(quiz.questions.map((q: any) => [q.id, q]));
  const missedByTopic: Record<string, number> = {};
  const review: any[] = [];
  let score = 0;

  for (const [id, pick] of Object.entries(answers)) {
    const q = byId.get(id);
    if (!q) continue;
    const ok = pick === q.answer;
    if (ok) score++;
    else missedByTopic[q.topic] = (missedByTopic[q.topic] || 0) + 1;
    review.push({ id, q: q.q, options: q.options, pick, answer: q.answer, explanation: q.explanation, ok });
  }

  const total = review.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const weak = Object.entries(missedByTopic).sort((a, b) => b[1] - a[1]).map(([t]) => t);

  await sb.from('quiz_attempts').insert({ user_id: user.id, doc_id: docId, level, score, total, weak_topics: weak });

  return NextResponse.json({ score, total, pct, remark: remarkFor(pct, weak), weak, review });
}