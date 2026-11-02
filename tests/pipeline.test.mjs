import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { processEvents } from '../assets/js/pipeline.js';

const event = (changes = {}) => ({
  event_id: 'evt-1', occurred_at: '2026-10-20', region: 'CA', amount: '19.95', ...changes,
});

test('adds monetary values exactly and groups by normalized region', () => {
  const result = processEvents([
    event({ amount: '0.10', region: ' ca ' }),
    event({ event_id: 'evt-2', amount: '0.20' }),
    event({ event_id: 'evt-3', region: 'EU', amount: '10.00' }),
  ]);
  assert.equal(result.totalCents, 1030);
  assert.deepEqual(result.regions, [
    { region: 'CA', count: 2, totalCents: 30 },
    { region: 'EU', count: 1, totalCents: 1000 },
  ]);
});

test('keeps the first valid occurrence and counts duplicates separately', () => {
  const result = processEvents([event(), event({ amount: '99.00' })]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.totalCents, 1995);
});

test('an invalid occurrence does not prevent a later valid event from being accepted', () => {
  const result = processEvents([event({ amount: '-1' }), event()]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.duplicates.length, 0);
  assert.equal(result.rejected[0].row, 1);
});

test('quarantines missing fields, invalid dates, unsupported regions, and invalid money', () => {
  const badRecords = [null, [], {}, event({ event_id: ' ' }),
    event({ occurred_at: '2026-02-30' }), event({ occurred_at: '2025-02-29' }),
    event({ region: 'XX' }), event({ amount: '1.999' }), event({ amount: '' }),
    event({ amount: true }), event({ amount: 'NaN' }), event({ amount: '1e3' }),
    event({ amount: '10000000.00' }), event({ amount: null })];
  const result = processEvents(badRecords);
  assert.equal(result.rejected.length, badRecords.length);
  assert.equal(result.accepted.length, 0);
  assert.ok(result.rejected.every(({ reason }) => reason.length > 0));
});

test('accepts leap days, zero amounts, and whitespace in strings', () => {
  const result = processEvents([event({ event_id: ' evt-1 ', occurred_at: '2024-02-29', amount: ' 0.00 ' })]);
  assert.equal(result.accepted[0].event_id, 'evt-1');
  assert.equal(result.accepted[0].amount_cents, 0);
});

test('returns chronologically sorted daily totals', () => {
  const result = processEvents([
    event({ occurred_at: '2026-10-22' }),
    event({ event_id: 'evt-2', occurred_at: '2026-10-20' }),
  ]);
  assert.deepEqual(result.daily.map(({ date }) => date), ['2026-10-20', '2026-10-22']);
});

test('treats numeric negative zero as zero, while rejecting signed amount strings', () => {
  const result = processEvents([event({ amount: -0.0 }), event({ event_id: 'evt-2', amount: '-0.00' })]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].amount_cents, 0);
  assert.equal(result.rejected.length, 1);
});

test('handles empty inputs and rejects non-array or oversized inputs', () => {
  assert.equal(processEvents([]).totalCents, 0);
  assert.throws(() => processEvents({}), /array/i);
  assert.throws(() => processEvents(new Array(5001)), /5,000/);
});

test('sample records reconcile across accepted, quarantined, and duplicate events', async () => {
  const records = JSON.parse(await readFile(new URL('../data/sample-events.json', import.meta.url), 'utf8'));
  const result = processEvents(records);
  assert.equal(result.inputCount, 12);
  assert.equal(result.accepted.length, 8);
  assert.equal(result.rejected.length, 3);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.totalCents, 83650);
});
