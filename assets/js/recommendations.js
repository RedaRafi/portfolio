/** Validate the published collection before replacing the recommendations on screen. */
export function normalizeRecommendations(payload) {
  if (!payload || !Array.isArray(payload.recommendations) || payload.recommendations.length > 250) {
    throw new Error('Expected a recommendations array with at most 250 entries.');
  }

  const identifiers = new Set();
  const entries = payload.recommendations.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid recommendation.');
    for (const field of ['id', 'name', 'excerpt']) {
      if (typeof entry[field] !== 'string' || !entry[field].trim()) {
        throw new Error(`A recommendation is missing ${field}.`);
      }
    }
    if (identifiers.has(entry.id)) throw new Error('Duplicate recommendation identifier.');
    identifiers.add(entry.id);

    let source;
    try { source = new URL(entry.sourceUrl); } catch { throw new Error('Expected a LinkedIn source URL.'); }
    if (source.protocol !== 'https:' || !/(^|\.)linkedin\.com$/.test(source.hostname)) {
      throw new Error('Expected a secure LinkedIn source URL.');
    }

    const date = entry.date || '';
    if (date) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== date) throw new Error('Invalid recommendation date.');
    }
    if (!Array.isArray(entry.paragraphs) || entry.paragraphs.some((paragraph) => typeof paragraph !== 'string')) {
      throw new Error('Recommendation paragraphs must be an array of text.');
    }
    return {
      ...entry,
      date,
      headline: typeof entry.headline === 'string' ? entry.headline : '',
      relationship: typeof entry.relationship === 'string' ? entry.relationship : '',
      language: entry.language === 'fr' ? 'fr' : 'en',
      sourceUrl: source.href,
    };
  });
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
