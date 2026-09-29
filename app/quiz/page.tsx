'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase'
import s from './quiz.module.css';

type Doc = { id: string; title: string };
type Q = { id: string; q: string; options: string[]; topic: string };
type Review = { id: string; q: string; options: string[]; pick: number | null; answer: number; explanation: string; ok: boolean };
type Result = { score: number; total: number; pct: number; remark: string; weak: string[]; review: Review[] };

const LEVELS = [
  { k: 'beginner', label: 'Beginner', emoji: '🌱', note: 'Key terms and facts' },
  { k: 'intermediate', label: 'Intermediate', emoji: '🔥', note: 'Apply what you know' },
  { k: 'advanced', label: 'Advanced', emoji: '🚀', note: 'Tricky, multi-step' },
];
const LETTERS = ['A', 'B', 'C', 'D'];

export default function QuizPage() {
  const router = useRouter();
  const [stage, setStage] = useState<'setup' | 'loading' | 'quiz' | 'result'>('setup');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [level, setLevel] = useState('beginner');
  const [count, setCount] = useState(10);
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [shown, setShown] = useState(0);
  const [err, setErr] = useState('');
  const [history, setHistory] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from('reference_docs').select('id,title').order('created_at', { ascending: false });
    setDocs(data ?? []);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.push('/login');
    const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', u.user.id).single();
    setIsAdmin(!!p?.is_admin);
    const { data: h } = await supabase
      .from('quiz_attempts')
      .select('score,total,level,created_at,reference_docs(title)')
      .order('created_at', { ascending: false })
      .limit(4);
    setHistory(h ?? []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const call = async (path: string, body: any) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Something went wrong.');
    return j;
  };

  const start = async () => {
    if (!doc) return;
    setErr(''); setStage('loading');
    try {
      const j = await call('/api/quiz/start', { docId: doc.id, level, count });
      setQs(j.questions); setAnswers({}); setI(0); setStage('quiz');
    } catch (e: any) { setErr(e.message); setStage('setup'); }
  };

  const submit = async () => {
    setStage('loading');
    try {
      const full = Object.fromEntries(qs.map((q) => [q.id, answers[q.id] ?? null]));
      setResult(await call('/api/quiz/submit', { docId: doc!.id, level, answers: full }));
      setStage('result'); load();
    } catch (e: any) { setErr(e.message); setStage('quiz'); }
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const title = window.prompt('Title for this handout?', f.name.replace(/\.pdf$/i, ''));
    if (!title) return;
    const path = `${crypto.randomUUID()}.pdf`;
    const up = await supabase.storage.from('reference').upload(path, f, { contentType: 'application/pdf' });
    if (up.error) return setErr(up.error.message);
    const { data: u } = await supabase.auth.getUser();
    const ins = await supabase.from('reference_docs').insert({ title, file_path: path, uploaded_by: u.user!.id });
    if (ins.error) return setErr(ins.error.message);
    setErr(''); load();
  };

  // count-up for the score ring
  useEffect(() => {
    if (!result) return;
    setShown(0);
    let n = 0;
    const t = setInterval(() => {
      n = Math.min(n + 2, result.pct);
      setShown(n);
      if (n >= result.pct) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [result]);

  const q = qs[i];
  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const C = 2 * Math.PI * 54;

  return (
    <main className={s.wrap}>
      <button className={s.back} onClick={() => router.push('/')}>← Back to documents</button>

      {stage === 'setup' && (
        <section className={s.panel}>
          <h1 className={s.title}>Test yourself</h1>
          <p className={s.sub}>Pick a handout, choose your level, and answer questions built from it.</p>
          {err && <p className={s.err}>{err}</p>}

          <h2 className={s.h2}>1. Handout</h2>
          <div className={s.docs}>
            {docs.length === 0 && <p className={s.sub}>No handouts yet. An admin needs to upload one.</p>}
            {docs.map((d) => (
              <button key={d.id} className={`${s.doc} ${doc?.id === d.id ? s.on : ''}`} onClick={() => setDoc(d)}>
                <span className={s.docIcon}>📄</span>{d.title}
              </button>
            ))}
          </div>
          {isAdmin && (
            <label className={s.upload}>
              + Add handout (PDF)
              <input type="file" accept="application/pdf" hidden onChange={upload} />
            </label>
          )}

          <h2 className={s.h2}>2. Level</h2>
          <div className={s.levels}>
            {LEVELS.map((l) => (
              <button key={l.k} className={`${s.level} ${level === l.k ? s.on : ''}`} onClick={() => setLevel(l.k)}>
                <span className={s.big}>{l.emoji}</span>
                <b>{l.label}</b>
                <small>{l.note}</small>
              </button>
            ))}
          </div>

          <h2 className={s.h2}>3. Length</h2>
          <div className={s.pills}>
            {[5, 10, 15].map((n) => (
              <button key={n} className={`${s.pill} ${count === n ? s.on : ''}`} onClick={() => setCount(n)}>{n} questions</button>
            ))}
          </div>

          <button className={s.go} disabled={!doc} onClick={start}>{doc ? 'Start the test' : 'Choose a handout first'}</button>

          {history.length > 0 && (
            <div className={s.history}>
              <h2 className={s.h2}>Your recent scores</h2>
              {history.map((h, k) => (
                <div key={k} className={s.hrow}>
                  <span>{h.reference_docs?.title ?? 'Handout'} <em>({h.level})</em></span>
                  <b>{h.score}/{h.total}</b>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {stage === 'loading' && (
        <section className={`${s.panel} ${s.center}`}>
          <div className={s.spinner} />
          <p className={s.sub}>{qs.length ? 'Marking your answers…' : 'Reading the handout and writing questions. The first run takes up to 30 seconds.'}</p>
        </section>
      )}

      {stage === 'quiz' && q && (
        <section className={s.panel}>
          <div className={s.bar}><div style={{ width: `${((i + 1) / qs.length) * 100}%` }} /></div>
          <p className={s.meta}>Question {i + 1} of {qs.length} · {q.topic}</p>
          <h2 key={q.id} className={s.q}>{q.q}</h2>
          <div className={s.opts}>
            {q.options.map((o, k) => (
              <button key={k} className={`${s.opt} ${answers[q.id] === k ? s.on : ''}`} onClick={() => setAnswers({ ...answers, [q.id]: k })}>
                <span className={s.letter}>{LETTERS[k]}</span>{o}
              </button>
            ))}
          </div>
          {err && <p className={s.err}>{err}</p>}
          <div className={s.nav}>
            <button className={s.ghost} disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
            {i < qs.length - 1 ? (
              <button className={s.go} onClick={() => setI(i + 1)}>Next</button>
            ) : (
              <button className={s.go} onClick={submit}>Finish and mark ({answered}/{qs.length} answered)</button>
            )}
          </div>
        </section>
      )}

      {stage === 'result' && result && (
        <section className={s.panel}>
          {result.pct >= 70 && (
            <div className={s.confetti} aria-hidden>
              {Array.from({ length: 36 }).map((_, k) => (
                <span key={k} style={{ left: `${(k * 97) % 100}%`, animationDelay: `${(k % 9) * 0.12}s`, background: ['#818cf8', '#f472b6', '#facc15', '#34d399'][k % 4] }} />
              ))}
            </div>
          )}
          <div className={s.ringWrap}>
            <svg viewBox="0 0 120 120" className={s.ring}>
              <circle cx="60" cy="60" r="54" className={s.track} />
              <circle cx="60" cy="60" r="54" className={s.fill} strokeDasharray={C} strokeDashoffset={C * (1 - shown / 100)} />
            </svg>
            <div className={s.score}>{result.score}<small>/{result.total}</small></div>
          </div>
          <p className={s.pct}>{shown}%</p>
          <p className={s.remark}>{result.remark}</p>
          {result.weak.length > 0 && (
            <div className={s.chips}>{result.weak.map((w) => <span key={w}>{w}</span>)}</div>
          )}

          <h2 className={s.h2}>Review</h2>
          {result.review.map((r, k) => (
            <details key={r.id} className={`${s.rev} ${r.ok ? s.good : s.bad}`}>
              <summary>{r.ok ? '✓' : '✗'} {k + 1}. {r.q}</summary>
              <p>Your answer: {r.pick === null ? 'skipped' : r.options[r.pick]}</p>
              {!r.ok && <p>Correct answer: <b>{r.options[r.answer]}</b></p>}
              <p className={s.why}>{r.explanation}</p>
            </details>
          ))}

          <div className={s.nav}>
            <button className={s.ghost} onClick={() => setStage('setup')}>New topic</button>
            <button className={s.go} onClick={start}>Retake with fresh questions</button>
          </div>
        </section>
      )}
    </main>
  );
}
