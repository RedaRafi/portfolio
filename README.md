# Reda Rafi — Python & Data Engineering

A personal portfolio built with HTML, CSS, and small JavaScript modules. It includes résumé-based case studies, an editable data pipeline playground, the matching Python example, and eight attributed LinkedIn recommendations. No framework, build step, database, tracking service, or paid account is required.

## Preview locally

With Node.js 20+ installed, run:

```sh
npm run preview
```

Open **http://127.0.0.1:4173**. Keep the terminal running while you preview. There are no npm dependencies to install.

Alternatively, with Python installed:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Use an HTTP server rather than opening `index.html` directly: browsers restrict JavaScript modules and sample-data requests from `file://` pages.

## Make it yours

- **Profile links:** edit `assets/js/profile.js`. LinkedIn and email come from the supplied résumé. GitHub points to the account you provided: `https://github.com/RedaRafi`. An empty profile value hides the corresponding link.
- **Page content and career history:** edit `index.html`.
- **Expanded case studies:** edit `caseStudies` in `assets/js/app.js`.
- **LinkedIn recommendations:** edit `data/recommendations.json`, then run `python scripts/import_linkedin.py --snapshot-only` to regenerate the HTML fallback. Seven full recommendations, dates, roles, and working relationships were supplied by Reda. Luc Barthel's recommendation remains a short public excerpt with a source link; a complete text or date was not supplied. Original wording is retained, including the authors' spelling and punctuation.
- **Colors, layout, and typography:** edit `assets/css/style.css`. The light and dark palettes are defined at the top.
- **Downloadable résumé:** replace `assets/reda-rafi-resume.pdf` with your updated PDF.
- **Demo input:** edit `data/sample-events.json`.

## Deploy on free GitHub Pages

1. Create a **public repository** in the GitHub account you want to use for free GitHub Pages, and push these files yourself. Keep `index.html`, `.nojekyll`, `assets/`, `data/`, and `examples/` at the repository root. Do not push `.venv/`, `.idea/`, or `.cache/`; `.gitignore` excludes them.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose your branch (usually `main`) and **/ (root)**, then save.
5. Open the address GitHub reports after deployment. A repository named `portfolio` normally uses `https://YOUR-USERNAME.github.io/portfolio/`; a repository named `YOUR-USERNAME.github.io` normally uses the root address.

The site uses relative URLs and works in a project subdirectory. No custom domain or custom GitHub Actions workflow is necessary. See GitHub's official [publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) for the branch publishing workflow and free-plan availability.

### Redirect the account root to this portfolio

To send `https://redarafi.github.io/` to `https://redarafi.github.io/portfolio/`, the redirect page must be published from the separate public repository named `RedaRafi.github.io`. This portfolio repository publishes at `/portfolio/` and its `index.html` must stay as the portfolio homepage. Copy `github-pages-root/index.html` from this project into the root of `RedaRafi.github.io`, then publish that repository with GitHub Pages from its `main` branch and root folder. The redirect page includes a fallback link for visitors whose browser does not follow the automatic redirect.

## Run the Python example

Python 3.10+ is sufficient; only the standard library is used.

```sh
python examples/pipeline.py --input data/sample-events.json
python examples/pipeline.py --input data/sample-events.json --output pipeline-output.json
```

The input is a JSON array. Each event has `event_id`, `occurred_at` (a calendar date in `YYYY-MM-DD` format), `region` (`CA`, `EU`, or `US`), and `amount` (nonnegative CAD, at most two decimal places, maximum `9999999.99`). String amounts are recommended for money. The demo accepts up to 5,000 events per run.

The pipeline normalizes strings, validates records, quarantines invalid rows, keeps the first valid event for each ID, and computes regional and daily totals in integer cents. Validation happens before deduplication, so an invalid record does not block a later valid retry. Every input record is accounted for as accepted, quarantined, or duplicate. Empty inputs are valid.

The sample contains **12 events: 8 accepted, 3 quarantined, and 1 duplicate**, totaling **CAD 836.50**. These are illustrative orders, not production metrics. All sample regions use the same currency; no exchange-rate conversion is implied.

The browser runs JavaScript. The separate Python implementation can be downloaded or run locally; GitHub Pages does not execute Python. This example is an in-memory batch pipeline, not a claim of distributed processing, durable idempotency, schema registry integration, or production orchestration. At larger scale, partitioning, durable deduplication, observability, and schema evolution need explicit design.

## Check the logic

```sh
npm test
python -m unittest discover -s tests -p "test_*.py" -v
```

The two suites cover money arithmetic, normalization, duplicate handling, invalid records and dates, leap days, empty data, size limits, chronological aggregation, shared sample totals, recommendation validation, CSV import, merge behavior, and escaped HTML generation.

## Keep recommendations up to date

The recommendations section loads `data/recommendations.json` on page load. **Refresh recommendations** requests that published collection again without using the browser cache. The page also checks every five minutes while visible and when you return to the tab after at least a minute. New records appear without a full page reload. Failed requests retain the last good cards, and refreshes preserve expanded full-text recommendations.

This is **not a live LinkedIn sync**. It picks up changes after you update the collection and publish them through GitHub Pages. The available LinkedIn connection cannot read recommendations, and standard LinkedIn sign-in permissions provide basic identity data rather than recommendations. A direct integration requires suitable LinkedIn API access, which was not supplied. LinkedIn also has a geographically limited [member portability API program](https://www.linkedin.com/help/lms/answer/a6214075); availability depends on the member's profile location and the application's authorization. See the official [API access documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access).

For an easy update workflow:

1. In LinkedIn, request your **Recommendations Received** data export. LinkedIn documents the steps under [Download your data](https://www.linkedin.com/help/linkedin/answer/a1339364).
2. Import the downloaded CSV from the project root:

   ```sh
   python scripts/import_linkedin.py "path/to/Recommendations_Received.csv"
   ```

3. Review the changed `data/recommendations.json` and `index.html`, then push them to your repository yourself. GitHub Pages publishes the changes, and the refresh control can pick them up.

The importer uses only Python's standard library. It accepts common text headers (`Description`, `Recommendation`, `Text`, or `Body`), first/last-name columns, job title/company, and creation date. It merges by author, updates existing text, retains missing metadata, and keeps authors absent from a partial export. Explicit hidden/private/off/pending rows remove that author's previously published recommendation. Accents, name case, and credentials after a comma do not create duplicate cards; duplicate identifiers are rejected before publishing a snapshot. Dates support ISO and US month/day/year formats; normalize ambiguous locale dates to `YYYY-MM-DD` before importing.

Alternatively, add a record directly to `data/recommendations.json` with a unique ID, name, headline, date, relationship, language, excerpt, paragraph array, and LinkedIn source URL. Run `--snapshot-only` afterward. The static snapshot keeps all recommendations readable when JavaScript is unavailable. There are no LinkedIn credentials, cookies, or scraping services in this project.

## Project map

```text
index.html                  Page content and semantic structure
assets/css/style.css        Responsive layout and theme tokens
assets/js/app.js            Navigation, dialogs, tabs, and playground UI
assets/js/pipeline.js       Browser pipeline; independent of the DOM
assets/js/profile.js        Personal links in one place
assets/js/recommendations.js  Validation for published recommendation data
assets/js/recommendations-ui.js  Cards, refresh, and automatic collection checks
assets/reda-rafi-resume.pdf  Original supplied résumé
data/sample-events.json     Deliberately imperfect sample data
data/recommendations.json   Recommendation text, authors, roles, and dates
examples/pipeline.py        Runnable Python implementation
scripts/serve.mjs           Dependency-free development server
scripts/import_linkedin.py  Import owner-downloaded CSV and update HTML fallback
tests/                      Node and Python behavior tests
docs/plans/                 Design rationale and implementation plan
```

Keyboard users can navigate the page, open and close native case-study dialogs, use arrow keys between demo tabs, and operate the mobile menu. The theme preference is stored locally when available. The page respects reduced-motion preferences. Input edits remain in memory in the current tab; running the demo does not upload records or call an external service.
