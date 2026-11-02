import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizeRecommendations } from '../assets/js/recommendations.js';

const entry = (changes = {}) => ({
  id: 'example', name: 'Example Person', headline: 'Engineering manager', date: '2024-08-07',
  relationship: 'Managed Reda directly', language: 'en', excerpt: 'Thoughtful engineering.',
  paragraphs: ['Thoughtful engineering and dependable collaboration.'],
  sourceUrl: 'https://www.linkedin.com/in/redarafi/details/recommendations/', ...changes,
});

test('normalizes a collection and orders dated recommendations newest first', () => {
  const result = normalizeRecommendations({ recommendations: [
    entry({ id: 'old', date: '2023-10-13' }),
    entry({ id: 'excerpt', date: '', paragraphs: [] }),
    entry({ id: 'new', date: '2025-12-31' }),
  ] });
  assert.deepEqual(result.map(item => item.id), ['new', 'old', 'excerpt']);
});

test('rejects malformed collections, duplicate identifiers, unsafe links, and invalid dates', () => {
  assert.throws(() => normalizeRecommendations({}), /recommendations/i);
  assert.throws(() => normalizeRecommendations({ recommendations: [entry(), entry()] }), /duplicate/i);
  assert.throws(() => normalizeRecommendations({ recommendations: [entry({ sourceUrl: 'javascript:alert(1)' })] }), /LinkedIn/i);
  assert.throws(() => normalizeRecommendations({ recommendations: [entry({ date: '2024-02-30' })] }), /date/i);
  assert.throws(() => normalizeRecommendations({ recommendations: [entry({ paragraphs: 'wrong' })] }), /paragraphs/i);
});

test('the published collection contains every supplied author and preserves full recommendations', async () => {
  const data = JSON.parse(await readFile(new URL('../data/recommendations.json', import.meta.url), 'utf8'));
  const recommendations = normalizeRecommendations(data);
  assert.equal(recommendations.length, 8);
  assert.equal(recommendations.filter(item => item.paragraphs.length > 0).length, 7);
  assert.ok(recommendations.find(item => item.name === 'Dominique Laporte'));
  assert.ok(recommendations.find(item => item.name === 'Faissal Zita'));
  assert.ok(recommendations.find(item => item.name === 'Luc Barthel'));
});
