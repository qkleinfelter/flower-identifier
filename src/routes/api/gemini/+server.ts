import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

interface GeminiCandidate {
  scientificName?: string;
  commonName?: string;
  confidence?: string;
  notes?: string;
}

interface GeminiResult {
  source: 'gemini';
  candidates: GeminiCandidate[];
  raw?: string;
  description?: string;
}

const PROMPT = `You are a botanist. Identify the plant in the provided image.
Respond with ONLY valid JSON (no markdown fences) matching this schema:
{
  "candidates": [
    { "scientificName": string, "commonName": string, "confidence": "low"|"medium"|"high", "notes": string }
  ],
  "description": string
}
Provide up to 3 candidates ranked by likelihood.`;

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw error(500, 'GEMINI_API_KEY not configured');

  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw error(400, 'Missing image');

  const buf = await file.arrayBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  const mimeType = file.type || 'image/jpeg';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }
    ],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw error(res.status, `Gemini error: ${text}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let parsed: { candidates?: GeminiCandidate[]; description?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  const result: GeminiResult = {
    source: 'gemini',
    candidates: parsed.candidates ?? [],
    description: parsed.description,
    raw: parsed.candidates ? undefined : text
  };
  return json(result);
};
