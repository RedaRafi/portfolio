/** A small batch pipeline. Kept independent of the page so its behavior is testable. */

const SUPPORTED_REGIONS = new Set(['CA', 'EU', 'US']);
const MONEY = /^\d{1,7}(?:\.\d{1,2})?$/;

function validateEvent(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Expected an event object.');
  }

  const eventId = typeof record.event_id === 'string' ? record.event_id.trim() : '';
  if (!eventId || eventId.length > 80) throw new Error('event_id must contain 1–80 characters.');

  const date = typeof record.occurred_at === 'string' ? record.occurred_at.trim() : '';
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0, 4)) < 1000
      || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('occurred_at must be a valid calendar date (YYYY-MM-DD).');
  }

  const region = typeof record.region === 'string' ? record.region.trim().toUpperCase() : '';
  if (!SUPPORTED_REGIONS.has(region)) throw new Error('region must be CA, EU, or US.');

  const amount = ['string', 'number'].includes(typeof record.amount) ? String(record.amount).trim() : '';
  if (!MONEY.test(amount)) throw new Error('amount must be 0–9,999,999.99 with at most two decimal places.');

  // Parse the fractional part directly: floating-point arithmetic would lose cents.
  const [whole, fraction = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return { event_id: eventId, occurred_at: date, region, amount_cents: cents };
}

export function processEvents(records) {
  if (!Array.isArray(records)) throw new Error('Input must be a JSON array of events.');
  if (records.length > 5000) throw new Error('This demo accepts at most 5,000 events per run.');

  const accepted = [];
  const rejected = [];
  const duplicates = [];
  const seen = new Set();
  const regionTotals = new Map();
  const dailyTotals = new Map();
  let totalCents = 0;

  records.forEach((record, index) => {
    let event;
    try {
      event = validateEvent(record);
    } catch (error) {
      rejected.push({ row: index + 1, reason: error.message, record });
      return;
    }

    // Only valid events claim an ID. A bad event must not poison a later retry.
    if (seen.has(event.event_id)) {
      duplicates.push({ row: index + 1, event_id: event.event_id, reason: 'Duplicate event_id; first valid event retained.' });
      return;
    }
    seen.add(event.event_id);
    accepted.push(event);
    totalCents += event.amount_cents;

    const region = regionTotals.get(event.region) ?? { region: event.region, count: 0, totalCents: 0 };
    region.count += 1;
    region.totalCents += event.amount_cents;
    regionTotals.set(event.region, region);
    dailyTotals.set(event.occurred_at, (dailyTotals.get(event.occurred_at) ?? 0) + event.amount_cents);
  });

  return {
    inputCount: records.length,
    accepted,
    rejected,
    duplicates,
    totalCents,
    regions: [...regionTotals.values()].sort((a, b) => a.region.localeCompare(b.region)),
    daily: [...dailyTotals].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, totalCents: total })),
  };
}
