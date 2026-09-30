export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(
  messages: ChatMsg[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}
) {
  const apiKey = process.env.LLM_API_KEY || process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is missing in .env.local');
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error('LLM_MODEL is missing in .env.local');
  const baseUrl = (process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 55_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const choice = data.choices?.[0];
  const text = String(choice?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { text, model, finish: choice?.finish_reason as string | undefined };
}