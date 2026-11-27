// One provider configuration for every AI feature. This setup is limited to
// private developer experiments using a Free-tier project without linked billing.
const models = new Set(['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);

function failure(status, reason) {
  return Object.assign(new Error('The AI service is unavailable.'), { status, reason });
}

export async function requestGeminiJson({ instructions, input, schema, maxOutputTokens = 1024 }, {
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  fetchImpl = fetch
} = {}) {
  if (process.env.NODE_ENV === 'production') throw failure(503, 'private_only');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw failure(503, 'not_configured');
  if (!models.has(model)) throw failure(503, 'unsupported_model');

  let response;
  try {
    response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'x-goog-api-key': apiKey.trim(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0, candidateCount: 1, maxOutputTokens,
          responseMimeType: 'application/json', responseJsonSchema: schema,
          thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: false }
        },
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }]
      })
    });
  } catch (error) {
    throw failure(502, error?.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  if (response.status === 429) throw failure(503, 'quota');
  if (!response.ok) throw failure(502, 'provider');
  const body = await response.json().catch(() => null);
  const candidate = body?.candidates?.[0];
  if (body?.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) {
    throw failure(502, 'incomplete_or_blocked');
  }
  try {
    const content = candidate.content.parts
      .filter(part => !part.thought && typeof part.text === 'string')
      .map(part => part.text).join('');
    return JSON.parse(content);
  } catch { throw failure(502, 'invalid_json'); }
}
