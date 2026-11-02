import { processEvents } from './pipeline.js';
import { profile } from './profile.js';
import { setupRecommendations } from './recommendations-ui.js';

const select = (selector) => document.querySelector(selector);
const selectAll = (selector) => [...document.querySelectorAll(selector)];
const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const formatMoney = (cents) => money.format(cents / 100);

function connectProfile() {
  selectAll('[data-profile]').forEach((link) => {
    const key = link.dataset.profile;
    const value = profile[key];
    if (!value) {
      link.hidden = true;
      return;
    }
    link.href = key === 'email' ? `mailto:${value}` : value;
    if (key === 'email') link.firstChild.textContent = `${value} `;
    link.hidden = false;
  });
  select('#copyright-year').textContent = new Date().getFullYear();
}

function setupTheme() {
  const button = select('.theme-toggle');
  let saved;
  try { saved = localStorage.getItem('reda-theme'); } catch { /* Storage may be unavailable in private browsing. */ }
  if (saved === 'light') document.documentElement.dataset.theme = 'light';

  const updateLabel = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
    button.title = button.getAttribute('aria-label');
  };
  updateLabel();
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('reda-theme', next); } catch { /* Theme still works without persistence. */ }
    updateLabel();
  });
}

function setupNavigation() {
  const toggle = select('.menu-toggle');
  const nav = select('#mobile-nav');
  const close = () => {
    nav.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
  };
  toggle.addEventListener('click', () => {
    const opening = nav.hidden;
    nav.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    toggle.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !nav.hidden) { close(); toggle.focus(); }
  });
  matchMedia('(min-width: 601px)').addEventListener('change', (event) => { if (event.matches) close(); });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        selectAll('.desktop-nav a').forEach((link) => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      }
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    selectAll('#work, #playground, #experience').forEach((section) => observer.observe(section));
  }
}

const caseStudies = {
  aws: {
    context: 'CAPGEMINI / PYTHON & AWS / 2021–2024',
    title: 'From raw data to reliable decisions.',
    lead: 'Building Python-based data workflows on AWS that support downstream reporting and analytics.',
    tags: ['Python', 'SQL', 'PySpark', 'AWS Glue', 'S3', 'Redshift', 'Athena'],
    sections: [
      { title: 'The problem space', text: 'Large-scale data processing needs more than a successful transformation. Datasets must be useful downstream, failures must be visible, and processing must make effective use of compute and storage.' },
      { title: 'My contribution', items: ['Developed Python, SQL, and Spark transformation workflows and ETL/ELT pipelines on AWS.', 'Built and optimized datasets for reporting, analytics, and dashboard visualization.', 'Implemented data quality checks, validation, monitoring, and logging.', 'Applied partitioning, data pruning, and efficient joins to improve processing performance.', 'Worked with Docker, CI/CD, and AWS services including Glue, S3, Redshift, Athena, Kinesis, Lambda, EventBridge, SQS, and CloudWatch.'] },
      { title: 'The engineering lens', text: 'Schema contracts, partition strategy, and useful failure signals belong in the design conversation early. The playground below gives a small, executable example of validation, duplicate handling, and exact aggregation; it is a separate demonstration rather than employer code.' },
    ],
  },
  migration: {
    context: 'SOFRECOM / SENIOR PYTHON DEVELOPER / 2024–PRESENT',
    title: 'One consistent source of truth.',
    lead: 'Leading a historical data migration from ELK to MongoDB while developing Python services and analytics workflows.',
    tags: ['Python', 'MongoDB', 'ELK', 'FastAPI', 'Flask', 'Data modeling'],
    sections: [
      { title: 'The problem space', text: 'Historical data is only useful when its meaning survives the move. A migration also needs data models that make the resulting information traceable, understandable, and accessible to consuming systems.' },
      { title: 'My contribution', items: ['Lead the migration of historical ELK data to MongoDB and design scalable data structures for a reliable source of truth.', 'Design standardized data models and processing workflows to improve traceability and governance.', 'Develop Python, Flask, and FastAPI backend services to expose datasets and support platform integrations.', 'Implement validation and data quality practices for production datasets.', 'Build reporting datasets and automate data processes supporting customer engagement and campaign analysis.'] },
      { title: 'The engineering lens', text: 'I treat data quality and model consistency as part of the migration itself. Clear models and explicit validation make it easier to reason about how historical records become dependable inputs to reporting and application services.' },
    ],
  },
  lidar: {
    context: 'UM6P-CS / PYTHON & DATA SCIENCE / 2021',
    title: 'Making sense of spatial data.',
    lead: 'Turning research requirements into Python-based data processing and feature extraction for LiDAR point-cloud datasets.',
    tags: ['Python', 'LiDAR', 'Point clouds', 'Feature extraction', 'Data science'],
    sections: [
      { title: 'The problem space', text: 'Point-cloud datasets represent a world of spatial observations. Working with them means translating mathematical and AI research requirements into processing steps that researchers can inspect, experiment with, and evaluate.' },
      { title: 'My contribution', items: ['Collaborated with PhD research teams to translate mathematical and AI requirements into application solutions.', 'Designed 2D/3D object detection approaches and feature extraction techniques for LiDAR 3D point-cloud data.', 'Built feature-map sharing solutions to support model experimentation and performance analysis.', 'Applied Python-based data processing and analytical techniques to research datasets.'] },
      { title: 'The engineering lens', text: 'Research collaboration taught me to make assumptions explicit and keep transformations understandable. Those habits carry directly into backend engineering and data platform work.' },
    ],
  },
};

function setupCaseStudies() {
  const dialog = select('#case-dialog');
  selectAll('[data-case]').forEach((button) => button.addEventListener('click', () => {
    const study = caseStudies[button.dataset.case];
    select('#case-context').textContent = study.context;
    select('#case-title').textContent = study.title;
    select('#case-lead').textContent = study.lead;
    select('#case-tags').replaceChildren(...study.tags.map((tag) => {
      const span = document.createElement('span'); span.textContent = tag; return span;
    }));
    select('#case-sections').replaceChildren(...study.sections.map((content) => {
      const section = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = content.title;
      section.append(heading);
      if (content.text) { const paragraph = document.createElement('p'); paragraph.textContent = content.text; section.append(paragraph); }
      if (content.items) {
        const list = document.createElement('ul');
        content.items.forEach((text) => { const item = document.createElement('li'); item.textContent = text; list.append(item); });
        section.append(list);
      }
      return section;
    }));
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('dialog-open');
  }));
  select('#close-case').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
}

function setupTabs() {
  const tabs = selectAll('[role="tab"]');
  const activate = (tab) => {
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      select(`#${item.getAttribute('aria-controls')}`).hidden = !active;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs.at(-1);
      if (!next) return;
      event.preventDefault(); activate(next); next.focus();
    });
  });
}

function drawPointCloud() {
  const group = select('.point-cloud-dots');
  // Deterministic positions give the illustration texture without a large image asset.
  for (let i = 0; i < 130; i += 1) {
    const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const x = 28 + ((i * 47) % 230);
    const y = 35 + ((i * 31) % 76) + Math.sin(x / 20) * 10;
    point.setAttribute('cx', x); point.setAttribute('cy', y); point.setAttribute('r', i % 3 ? '.8' : '1.2');
    group.append(point);
  }
}

function renderResults(result) {
  select('#accepted-count').textContent = result.accepted.length;
  select('#rejected-count').textContent = result.rejected.length;
  select('#duplicate-count').textContent = result.duplicates.length;
  select('#total-value').textContent = `CAD ${formatMoney(result.totalCents)}`;
  const chart = select('#region-chart');
  chart.replaceChildren();
  const largest = Math.max(...result.regions.map((region) => region.totalCents), 1);
  if (!result.regions.length) {
    const empty = document.createElement('p'); empty.className = 'mono subtle';
    empty.textContent = 'No accepted events to aggregate.'; chart.append(empty);
  }
  result.regions.forEach((region) => {
    const row = document.createElement('div'); row.className = 'chart-row';
    const label = document.createElement('span'); label.textContent = region.region;
    const track = document.createElement('div'); track.className = 'chart-track';
    const fill = document.createElement('div'); fill.className = 'chart-fill'; fill.style.width = `${region.totalCents / largest * 100}%`;
    track.append(fill); track.setAttribute('aria-hidden', 'true');
    const value = document.createElement('span'); value.className = 'chart-amount'; value.textContent = formatMoney(region.totalCents);
    row.setAttribute('aria-label', `${region.region}: ${region.count} events, ${formatMoney(region.totalCents)} CAD`);
    row.append(label, track, value); chart.append(row);
  });

  const issues = [...result.rejected.map((item) => ({ ...item, kind: 'Quarantined' })),
    ...result.duplicates.map((item) => ({ ...item, kind: 'Duplicate' }))].sort((a, b) => a.row - b.row);
  const details = select('#quality-details'); details.hidden = !issues.length;
  select('#quality-count').textContent = `(${issues.length})`;
  // Bound the displayed report; the download retains the complete result.
  select('#quality-list').replaceChildren(...issues.slice(0, 100).map((issue) => {
    const li = document.createElement('li'); li.textContent = `Row ${issue.row} · ${issue.kind}: ${issue.reason}`; return li;
  }));
  if (issues.length > 100) {
    const li = document.createElement('li'); li.textContent = `${issues.length - 100} more issues in the downloadable result.`;
    select('#quality-list').append(li);
  }
}

async function setupPlayground() {
  const input = select('#event-input');
  const runButton = select('#run-pipeline');
  const resetButton = select('#reset-input');
  const exportButton = select('#export-results');
  const runState = select('#run-state');
  const log = select('#run-log');
  const stages = selectAll('[data-stage]');
  let sampleText = '';
  let lastResult = null;

  const clearResults = () => {
    lastResult = null; exportButton.disabled = true;
    ['#accepted-count', '#rejected-count', '#duplicate-count'].forEach((id) => { select(id).textContent = '—'; });
    select('#total-value').textContent = 'CAD —';
    select('#execution-time').textContent = 'READY WHEN YOU ARE';
    select('#quality-details').hidden = true;
    select('#quality-details').open = false;
    stages.forEach((stage) => stage.classList.remove('active', 'complete'));
    const empty = document.createElement('p'); empty.className = 'mono subtle'; empty.textContent = 'Run the pipeline to see the result.';
    select('#region-chart').replaceChildren(empty);
    log.className = 'run-log'; log.textContent = 'Waiting for the next run.';
  };

  const loadSample = async () => {
    runState.textContent = 'Loading sample…';
    try {
      const response = await fetch(new URL('../../data/sample-events.json', import.meta.url));
      if (!response.ok) throw new Error(`Sample request returned ${response.status}.`);
      const sample = await response.json();
      sampleText = JSON.stringify(sample, null, 2);
      input.value = sampleText;
      runState.textContent = `${sample.length} sample events · ready`;
    } catch {
      input.placeholder = 'Paste a JSON array of events here, or choose Reset sample to retry.';
      runState.textContent = 'Sample unavailable · paste your own JSON';
      log.textContent = 'Could not load the sample. Use a local HTTP server or paste your own events.';
    } finally {
      runButton.disabled = false;
    }
  };

  resetButton.addEventListener('click', async () => {
    clearResults();
    input.setAttribute('aria-invalid', 'false');
    if (sampleText) {
      input.value = sampleText; runState.textContent = 'Sample restored · ready';
    } else await loadSample();
  });

  runButton.addEventListener('click', async () => {
    clearResults();
    runButton.disabled = true; resetButton.disabled = true;
    runState.textContent = 'Processing…';
    input.setAttribute('aria-invalid', 'false');
    try {
      let records;
      try { records = JSON.parse(input.value); } catch { throw new Error('Invalid JSON. Check brackets, quotes, and commas, then try again.'); }
      const start = performance.now();
      const result = processEvents(records);
      const elapsed = performance.now() - start;
      // The stages are a visual walkthrough. The measured time is computation only.
      const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
      for (const stage of stages) {
        stage.classList.add('active');
        await new Promise((resolve) => setTimeout(resolve, delay));
        stage.classList.add('complete');
      }
      lastResult = result;
      renderResults(result);
      select('#execution-time').textContent = `${elapsed.toFixed(2)} ms COMPUTE`;
      const passRate = result.inputCount ? Math.round(result.accepted.length / result.inputCount * 100) : 0;
      log.className = 'run-log success';
      log.textContent = `✓ ${result.inputCount} in → ${result.accepted.length} accepted · ${result.rejected.length} quarantined · ${result.duplicates.length} duplicate${result.duplicates.length === 1 ? '' : 's'}. Every event accounted for.`;
      runState.textContent = `Complete · ${passRate}% accepted`;
      exportButton.disabled = false;
    } catch (error) {
      input.setAttribute('aria-invalid', 'true');
      log.className = 'run-log error'; log.textContent = error.message;
      runState.textContent = 'Check input and try again';
      select('#execution-time').textContent = 'INPUT ERROR';
      select('#input-tab').click(); input.focus();
    } finally {
      runButton.disabled = false; resetButton.disabled = false;
    }
  });

  exportButton.addEventListener('click', () => {
    if (!lastResult) return;
    const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'pipeline-result.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  await loadSample();
}

function setupCopyEmail() {
  select('#copy-email').addEventListener('click', async () => {
    const feedback = select('#copy-feedback');
    try {
      await navigator.clipboard.writeText(profile.email);
      select('#copy-label').textContent = 'Email copied';
      feedback.textContent = 'Ready to paste into your email app.';
      setTimeout(() => { select('#copy-label').textContent = 'Copy email address'; feedback.textContent = ''; }, 3500);
    } catch {
      feedback.textContent = `Copy manually: ${profile.email}`;
    }
  });
}

connectProfile();
setupTheme();
setupNavigation();
setupCaseStudies();
setupTabs();
drawPointCloud();
setupCopyEmail();
setupRecommendations();
setupPlayground();
