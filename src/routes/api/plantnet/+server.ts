import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

interface PlantNetCandidate {
  scientificName: string;
  commonNames: string[];
  score: number;
  family?: string;
  genus?: string;
}

interface PlantNetResult {
  source: 'plantnet';
  candidates: PlantNetCandidate[];
}

export const POST: RequestHandler = async ({ request }) => {
  const apiKey = env.PLANTNET_API_KEY;
  if (!apiKey) throw error(500, 'PLANTNET_API_KEY not configured');

  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw error(400, 'Missing image');

  const organ = (form.get('organ') as string) || 'auto';

  // Pl@ntNet expects multipart/form-data with `images` and `organs` fields.
  const upstream = new FormData();
  upstream.append('images', file, file.name || 'image.jpg');
  upstream.append('organs', organ);

  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: 'POST', body: upstream });

  if (!res.ok) {
    const text = await res.text();
    throw error(res.status, `Pl@ntNet error: ${text}`);
  }

  const data = await res.json();
  const candidates: PlantNetCandidate[] = (data.results ?? []).slice(0, 5).map((r: any) => ({
    scientificName: r?.species?.scientificNameWithoutAuthor ?? r?.species?.scientificName ?? 'Unknown',
    commonNames: r?.species?.commonNames ?? [],
    score: r?.score ?? 0,
    family: r?.species?.family?.scientificNameWithoutAuthor,
    genus: r?.species?.genus?.scientificNameWithoutAuthor
  }));

  const result: PlantNetResult = { source: 'plantnet', candidates };
  return json(result);
};
