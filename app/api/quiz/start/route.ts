import { NextRequest, NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { admin, getUser, shuffle } from '../../../lib/quiz-server';
import { chat } from '../../../lib/llm';

export const maxDuration = 60; // Hobby plan limit

const LEVEL_HINT: Record<string, string> = {
  beginner: 'Recall and basic understanding: definitions, key terms, simple facts.',
  intermediate: 'Application: apply concepts to short scenarios, compare and explain.',
  advanced: 'Analysis: multi-step reasoning, edge cases, subtle distinctions between similar options.',
};

type Q = { id: string; q: string; options: string[]; answer: number; explanation: string; topic: string };

// Reads "Q: / A) B) C) D) / ANSWER: / WHY: / TOPIC:" blocks. Anything that is not a complete block is skipped.
function parseQuestions(raw: string): Q[] {
  const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/\*\*|__|`/g, '');
  const chunks = clean.split(/^\s*Q(?:uestion)?\s*\d*\s*[:.)]\s*/gim).slice(1);
  const out: Q[] = [];

  for (const c of chunks) {
    const lines = c.split('\n').map((l) => l.trim()).filter(Boolean);
    const firstOpt = lines.findIndex((l) => /^[A-D][).:]\s*\S/.test(l));
    if (firstOpt < 1) continue;

    const opts: string[] = [];
    for (const l of lines.slice(firstOpt)) {
      const m = l.match(/^([A-D])[).:]\s*(.+)$/);
      if (m && opts.length < 4 && 'ABCD'.indexOf(m[1]) === opts.length) opts.push(m[2].trim());
    }
    const ans = c.match(/^\s*ANSWER\s*[:\-]\s*\(?([A-D])/im);
    if (opts.length !== 4 || !ans) continue;

    const idx = 'ABCD'.indexOf(ans[1].toUpperCase());
    const why = c.match(/^\s*(?:WHY|EXPLANATION)\s*:\s*(.+)$/im);
    const topic = c.match(/^\s*TOPIC\s*:\s*(.+)$/im);

    // shuffle options so the correct answer isn't always in the same slot
    const mixed = shuffle(opts.map((o, k) => ({ o, ok: k === idx })));
    out.push({
      id: `q${out.length + 1}`,
      q: lines.slice(0, firstOpt).join(' '),
      options: mixed.map((m) => m.o),
      answer: mixed.findIndex((m) => m.ok),
      explanation: why ? why[1].trim() : '',
      topic: topic ? topic[1].trim() : 'General',
    });
  }
  return out;
}

async function generatePool(text: string, title: string, level: string): Promise<Q[]> {
  const { text: reply, model, finish } = await chat(
    [
      {
        role: 'system',
        content:
          'You are a quiz generator. You never solve or summarise the material, you only write ' +
          'multiple-choice questions about it. You reply with the questions only, no introduction.',
      },
      {
        role: 'user',
        content:
          `STUDY MATERIAL titled "${title}":\n"""\n${text.slice(0, 12000)}\n"""\n\n` +
          `Write 12 multiple-choice questions at this level: ${LEVEL_HINT[level]}\n` +
          `Use only facts from the material. Exactly 4 plausible options, exactly one correct.\n` +
          `Use EXACTLY this format for every question, with a line containing only --- between questions:\n\n` +
          `Q: the question\nA) option\nB) option\nC) option\nD) option\nANSWER: one letter (A, B, C or D)\n` +
          `WHY: one short sentence\nTOPIC: 1-3 words\n---\n\n` +
          `Start your reply immediately with "Q:".`,
      },
    ],
    { maxTokens: 4096, temperature: 0.3, timeoutMs: 55_000 }
  );

  console.log('[quiz] model:', model, '| finish_reason:', finish, '| reply length:', reply.length);
  console.log('[quiz] reply starts:', reply.slice(0, 200).replace(/\s+/g, ' '));

  const pool = parseQuestions(reply);
  console.log('[quiz] parsed questions:', pool.length);
  if (pool.length === 0) {
    throw new Error(
      finish === 'length'
        ? 'This model used its whole budget "thinking" before answering. Set LLM_MODEL to a non-reasoning instruct model.'
        : 'No questions found in the AI reply. Check the terminal to see what it sent.'
    );
  }
  return pool;
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