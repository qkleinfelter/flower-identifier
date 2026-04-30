<script lang="ts">
  let file = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let organ = $state('auto');
  let loading = $state(false);
  let geminiResult = $state<any>(null);
  let plantnetResult = $state<any>(null);
  let geminiError = $state<string | null>(null);
  let plantnetError = $state<string | null>(null);
  let geminiMs = $state<number | null>(null);
  let plantnetMs = $state<number | null>(null);

  function onFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const f = target.files?.[0] ?? null;
    file = f;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = f ? URL.createObjectURL(f) : null;
    geminiResult = plantnetResult = null;
    geminiError = plantnetError = null;
    geminiMs = plantnetMs = null;
  }

  async function callApi(path: string, f: File, extra?: Record<string, string>) {
    const fd = new FormData();
    fd.append('image', f);
    if (extra) for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    const res = await fetch(path, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function identify() {
    if (!file) return;
    loading = true;
    geminiResult = plantnetResult = null;
    geminiError = plantnetError = null;
    geminiMs = plantnetMs = null;

    const t0 = performance.now();
    const gemini = callApi('/api/gemini', file)
      .then((r) => {
        geminiMs = Math.round(performance.now() - t0);
        geminiResult = r;
      })
      .catch((e) => {
        geminiMs = Math.round(performance.now() - t0);
        geminiError = String(e.message ?? e);
      });

    const t1 = performance.now();
    const plantnet = callApi('/api/plantnet', file, { organ })
      .then((r) => {
        plantnetMs = Math.round(performance.now() - t1);
        plantnetResult = r;
      })
      .catch((e) => {
        plantnetMs = Math.round(performance.now() - t1);
        plantnetError = String(e.message ?? e);
      });

    await Promise.allSettled([gemini, plantnet]);
    loading = false;
  }
</script>

<main>
  <h1>🌿 Plant Identifier Comparison</h1>
  <p class="sub">Upload a plant photo and compare results from Gemini and Pl@ntNet side by side.</p>

  <section class="controls">
    <input type="file" accept="image/*" onchange={onFileChange} />
    <label>
      Pl@ntNet organ:
      <select bind:value={organ}>
        <option value="auto">auto</option>
        <option value="leaf">leaf</option>
        <option value="flower">flower</option>
        <option value="fruit">fruit</option>
        <option value="bark">bark</option>
        <option value="habit">habit</option>
      </select>
    </label>
    <button onclick={identify} disabled={!file || loading}>
      {loading ? 'Identifying…' : 'Identify'}
    </button>
  </section>

  {#if previewUrl}
    <div class="preview">
      <img src={previewUrl} alt="upload preview" />
    </div>
  {/if}

  <section class="results">
    <article class="card">
      <header>
        <h2>Gemini</h2>
        {#if geminiMs !== null}<span class="ms">{geminiMs} ms</span>{/if}
      </header>
      {#if geminiError}
        <p class="error">{geminiError}</p>
      {:else if geminiResult}
        {#if geminiResult.description}
          <p class="desc">{geminiResult.description}</p>
        {/if}
        {#if geminiResult.candidates?.length}
          <ol>
            {#each geminiResult.candidates as c}
              <li>
                <strong><em>{c.scientificName ?? 'Unknown'}</em></strong>
                {#if c.commonName}— {c.commonName}{/if}
                {#if c.confidence}<span class="badge">{c.confidence}</span>{/if}
                {#if c.notes}<div class="notes">{c.notes}</div>{/if}
              </li>
            {/each}
          </ol>
        {:else if geminiResult.raw}
          <pre>{geminiResult.raw}</pre>
        {/if}
      {:else}
        <p class="muted">No result yet.</p>
      {/if}
    </article>

    <article class="card">
      <header>
        <h2>Pl@ntNet</h2>
        {#if plantnetMs !== null}<span class="ms">{plantnetMs} ms</span>{/if}
      </header>
      {#if plantnetError}
        <p class="error">{plantnetError}</p>
      {:else if plantnetResult}
        {#if plantnetResult.candidates?.length}
          <ol>
            {#each plantnetResult.candidates as c}
              <li>
                <strong><em>{c.scientificName}</em></strong>
                {#if c.commonNames?.length}— {c.commonNames.join(', ')}{/if}
                <span class="badge">{(c.score * 100).toFixed(1)}%</span>
                {#if c.family}<div class="notes">Family: {c.family}{c.genus ? ` · Genus: ${c.genus}` : ''}</div>{/if}
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">No matches.</p>
        {/if}
      {:else}
        <p class="muted">No result yet.</p>
      {/if}
    </article>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, Segoe UI, sans-serif;
    background: #f7f8f5;
    color: #1f2a1a;
  }
  main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }
  h1 { margin: 0 0 0.25rem; }
  .sub { color: #5a6b50; margin-top: 0; }
  .controls {
    display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;
    background: white; padding: 1rem; border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin: 1rem 0;
  }
  button {
    background: #2f7d32; color: white; border: 0; padding: 0.6rem 1.2rem;
    border-radius: 8px; cursor: pointer; font-weight: 600;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  select { padding: 0.4rem; border-radius: 6px; }
  .preview img {
    max-width: 100%; max-height: 320px; border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .results {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
    margin-top: 1.5rem;
  }
  @media (max-width: 720px) { .results { grid-template-columns: 1fr; } }
  .card {
    background: white; border-radius: 12px; padding: 1rem 1.25rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .card header { display: flex; justify-content: space-between; align-items: baseline; }
  .card h2 { margin: 0 0 0.5rem; }
  .ms { color: #888; font-size: 0.85rem; }
  ol { padding-left: 1.25rem; }
  li { margin-bottom: 0.6rem; }
  .badge {
    display: inline-block; background: #e3efe1; color: #2f7d32;
    padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.8rem; margin-left: 0.4rem;
  }
  .notes { color: #555; font-size: 0.9rem; margin-top: 0.2rem; }
  .desc { color: #333; font-style: italic; }
  .error { color: #b00020; white-space: pre-wrap; }
  .muted { color: #888; }
  pre { background: #f0f0eb; padding: 0.75rem; border-radius: 8px; overflow: auto; }
</style>
