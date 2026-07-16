export async function POST(req) {
  try {
    const { messages } = await req.json()

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-8b-instruct', // adjust to match your key's available model
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return Response.json({ error: errText }, { status: response.status })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'No response received.'

    return Response.json({ reply })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}