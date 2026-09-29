import { NextRequest, NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { admin, getUser, shuffle } from '../../../lib/quiz-server';

export const maxDuration = 120; // local dev ignores this; on a host, check your plan's limit

const LEVEL_HINT: Record<string, string> = {
  beginner: 'Recall and basic understanding: definitions, key terms, simple facts.',
  intermediate: 'Application: apply concepts to short scenarios, compare and explain.',
  advanced: 'Analysis: multi-step reasoning, edge cases, subtle distinctions between similar options.',
};

type Q = { id: string; q: string; options: string[]; answer: number; explanation: string; topic: string };

// Tolerant parser: strips code fences and reasoning tags, and keeps every complete question if the reply was cut off
function parseQuestions(raw: string): any[] {
  let s = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json|```/gi, '')
    .trim();
  const start = s.indexOf('[');
  if (start === -1) throw new Error('The AI reply had no question list. Check the terminal for what it sent.');
  s = s.slice(start);

  const end = s.lastIndexOf(']');
  if (end !== -1) {
    try { return JSON.parse(s.slice(0, end + 1)); } catch {}
  }
  const lastObj = s.lastIndexOf('}');
  if (lastObj !== -1) {
    try { return JSON.parse(s.slice(0, lastObj + 1) + ']'); } catch {}
  }
  throw new Error('Could not read the AI reply as JSON.');
}

async function generatePool(text: string, title: string, level: string): Promise<Q[]> {
  const apiKey = process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is missing in .env.local');
  const baseUrl = (process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || process.env.NVIDIA_MODEL || 'mistralai/mistral-large-2-instruct';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(100_000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 4096,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are a quiz generator. You never answer or solve the material, you only turn it into ' +
            'multiple-choice exam questions. Your entire reply is one JSON array and nothing else.',
        },
        {
          role: 'user',
          content:
            `STUDY MATERIAL titled "${title}" (do not solve it or summarise it, only quiz on it):\n"""\n${text.slice(0, 12000)}\n"""\n\n` +
            `TASK: Write 12 multiple-choice questions at this level: ${LEVEL_HINT[level]}\n` +
            `Rules: use only facts from the material; exactly 4 plausible options; exactly one correct.\n` +
            `Format: a JSON array where each item is {"q": string, "options": [4 strings], ` +
            `"answer": 0-3 (index of the correct option), "explanation": one short sentence, "topic": 1-3 words}.\n` +
            `Your reply MUST start with [ and end with ]. No introduction, no markdown, no code fences.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const choice = data.choices?.[0];
  const raw: string = choice?.message?.content ?? '';
  console.log('[quiz] model:', model, '| finish_reason:', choice?.finish_reason, '| reply length:', raw.length);
  console.log('[quiz] reply starts:', raw.slice(0, 300).replace(/\s+/g, ' '));
  if (!raw.trim()) throw new Error('The AI returned an empty reply. Try a different model in LLM_MODEL.');

  return parseQuestions(raw)
    .filter((x: any) => x?.q && Array.isArray(x.options) && x.options.length === 4 && x.answer >= 0 && x.answer <= 3)
    .map((x: any, i: number): Q => {
      // shuffle options so the correct answer isn't always in the same slot
      const mixed = shuffle(x.options.map((o: string, k: number) => ({ o, ok: k === x.answer })));
      return {
        id: `q${i + 1}`,
        q: x.q,
        options: mixed.map((m: any) => m.o),
        answer: mixed.findIndex((m: any) => m.ok),
        explanation: x.explanation ?? '',
        topic: x.topic ?? 'General',
      };
    });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });

  const { docId, level, count } = await req.json();
  if (!LEVEL_HINT[level]) return NextResponse.json({ error: 'Unknown level.' }, { status: 400 });

  const sb = admin();
  try {
    // 1. Reuse the cached pool for this handout + level if it exists
    let { data: quiz } = await sb
      .from('quizzes').select('questions').eq('doc_id', docId).eq('level', level).maybeSingle();

    if (!quiz) {
      const { data: doc, error: docErr } = await sb
        .from('reference_docs').select('title,file_path').eq('id', docId).single();
      if (!doc) {
        console.log('[quiz] doc lookup failed:', docErr?.message);
        return NextResponse.json({ error: `Handout lookup failed: ${docErr?.message ?? 'not found'}` }, { status: 404 });
      }

      const file = await sb.storage.from('reference').download(doc.file_path);
      if (file.error) throw new Error(`Could not open the PDF: ${file.error.message}`);

      const pdf = await getDocumentProxy(new Uint8Array(await file.data.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      console.log('[quiz] pdf text length:', text.length);
      if (text.trim().length < 200) {
        return NextResponse.json(
          { error: 'This PDF has no readable text (it may be a scan). Upload a text-based PDF.' },
          { status: 422 }
        );
      }

      const pool = await generatePool(text, doc.title, level);
      console.log('[quiz] valid questions generated:', pool.length);
      if (pool.length < 5) throw new Error('The AI returned too few valid questions. Try again.');

      const ins = await sb
        .from('quizzes')
        .upsert({ doc_id: docId, level, questions: pool }, { onConflict: 'doc_id,level' })
        .select('questions')
        .single();
      if (ins.error) console.log('[quiz] saving pool failed:', ins.error.message);
      quiz = ins.data ?? { questions: pool };
    }

    // 2. Serve a random subset WITHOUT the answers
    const all = quiz.questions as Q[];
    const picked = shuffle(all).slice(0, Math.min(count || 10, all.length));
    const questions = picked.map(({ id, q, options, topic }) => ({ id, q, options, topic }));
    return NextResponse.json({ questions });
  } catch (e: any) {
    console.error('[quiz] start failed:', e);
    return NextResponse.json({ error: e.message || 'Could not build the quiz.' }, { status: 500 });
  }
}