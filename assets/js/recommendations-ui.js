import { normalizeRecommendations } from './recommendations.js';

const dateLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const INITIAL_VISIBLE = 4;

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function recommendationCard(entry) {
  const card = element('figure', 'recommendation-card');
  card.dataset.recommendationId = entry.id;
  const mark = element('span', 'recommendation-mark', '“');
  mark.setAttribute('aria-hidden', 'true');
  const quote = element('blockquote');
  quote.lang = entry.language;
  quote.append(element('p', '', entry.excerpt));
  card.append(mark, quote);

  if (entry.paragraphs.length) {
    const details = element('details', 'recommendation-full');
    const text = element('div');
    text.lang = entry.language;
    text.append(...entry.paragraphs.map(paragraph => element('p', '', paragraph)));
    details.append(element('summary', '', 'Read full recommendation'), text);
    card.append(details);
  } else {
    card.append(element('p', 'recommendation-excerpt-note', 'Short public excerpt · full text on LinkedIn'));
  }

  const metadata = element('div', 'recommendation-meta');
  if (entry.date) {
    const time = element('time', '', dateLabel.format(new Date(`${entry.date}T00:00:00Z`)));
    time.dateTime = entry.date;
    metadata.append(time);
  }
  metadata.append(element('span', '', entry.relationship));
  card.append(metadata);

  const caption = element('figcaption');
  const initials = entry.name.split(/\s+/).slice(0, 2).map(word => [...word][0]).join('');
  const avatar = element('span', 'recommendation-avatar', initials);
  avatar.setAttribute('aria-hidden', 'true');
  const author = element('span');
  author.append(element('strong', '', entry.name), element('small', '', entry.headline));
  const source = element('a', '', '↗');
  source.href = entry.sourceUrl;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.setAttribute('aria-label', `Read ${entry.name}’s recommendation on LinkedIn`);
  caption.append(avatar, author, source);
  card.append(caption);
  return card;
}

export function setupRecommendations() {
  const grid = document.querySelector('#recommendations-grid');
  const more = document.querySelector('#show-all-recommendations');
  const refresh = document.querySelector('#refresh-recommendations');
  const status = document.querySelector('#recommendations-status');
  const source = new URL('../../data/recommendations.json', import.meta.url);
  let expanded = false;
  let signature = '';
  let checking = false;
  let lastChecked = 0;

  function updateVisibleCards() {
    const cards = [...grid.querySelectorAll('.recommendation-card')];
    cards.forEach((card, index) => { card.hidden = !expanded && index >= INITIAL_VISIBLE; });
    more.hidden = cards.length <= INITIAL_VISIBLE;
    more.textContent = expanded ? 'Show fewer recommendations' : `Show all ${cards.length} recommendations`;
    more.setAttribute('aria-expanded', String(expanded));
  }

  async function loadCollection({ announce = false } = {}) {
    if (checking) return;
    checking = true;
    refresh.disabled = true;
    if (announce) status.textContent = 'Checking the published collection…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      // This refreshes our published collection. It does not call LinkedIn's API.
      const url = new URL(source);
      url.searchParams.set('checked', Date.now());
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('The collection could not be loaded.');
      const payload = await response.json();
      const entries = normalizeRecommendations(payload);
      const nextSignature = JSON.stringify(entries);
      if (signature !== nextSignature) {
        const openCards = new Set([...grid.querySelectorAll('details[open]')].map(details => details.closest('figure').dataset.recommendationId));
        const cards = entries.map(entry => {
          const card = recommendationCard(entry);
          if (openCards.has(entry.id) && card.querySelector('details')) card.querySelector('details').open = true;
          return card;
        });
        grid.replaceChildren(...cards);
        if (!entries.length) grid.append(element('p', 'subtle', 'Recommendations will appear here when published.'));
        signature = nextSignature;
        updateVisibleCards();
      }
      status.textContent = `${entries.length} recommendations · ${announce ? 'collection checked just now' : 'published collection'}`;
      lastChecked = Date.now();
    } catch {
      // Keep the last good cards, including the HTML snapshot, when a refresh fails.
      status.textContent = 'Couldn’t check for updates. Showing saved recommendations.';
    } finally {
      clearTimeout(timeout);
      checking = false;
      refresh.disabled = false;
    }
  }

  more.addEventListener('click', () => {
    expanded = !expanded;
    updateVisibleCards();
  });
  refresh.hidden = false;
  refresh.addEventListener('click', () => loadCollection({ announce: true }));
  updateVisibleCards();
  loadCollection();

  // Pick up newly published data while the page is open without interrupting reading.
  setInterval(() => {
    if (document.visibilityState === 'visible') loadCollection();
  }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastChecked > 60 * 1000) loadCollection();
  });
}
