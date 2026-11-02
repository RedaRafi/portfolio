"""Import your LinkedIn Recommendations Received CSV into the portfolio.

This reads an export you download yourself. It does not sign in to LinkedIn,
scrape a profile, or imply that the portfolio has LinkedIn API access.
"""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime
from html import escape
import io
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://www.linkedin.com/in/redarafi/details/recommendations/"


def column_key(value: str) -> str:
    return re.sub(r"[^a-z]", "", value.casefold())


def parse_date(value: str) -> str:
    if not value.strip():
        return ""
    for pattern in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y", "%d %B %Y"):
        try:
            return datetime.strptime(value.strip(), pattern).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date {value!r}. Use YYYY-MM-DD or US month/day/year dates.")


def read_recommendations(content: str) -> list[dict]:
    """Read common LinkedIn export headers while preserving the author's text."""
    reader = csv.DictReader(io.StringIO(content.lstrip("\ufeff")))
    headers = {column_key(header) for header in (reader.fieldnames or [])}
    text_headers = {"description", "recommendation", "text", "body"}
    if not headers.intersection(text_headers):
        raise ValueError("The CSV needs recommendation text in a Description, Recommendation, Text, or Body column.")

    recommendations = []
    for number, raw in enumerate(reader, start=2):
        row = {column_key(key): (value or "").strip() for key, value in raw.items() if key}

        def get(*names):
            return next((row[name] for name in names if row.get(name)), "")

        name = get("name", "author", "recommender") or " ".join(filter(None, [
            get("firstname", "recommenderfirstname"), get("lastname", "recommenderlastname"),
        ]))
        if not name:
            raise ValueError(f"CSV row {number} needs an author name.")
        if get("status").casefold() in {"hidden", "off", "private", "pending"}:
            recommendations.append({"name": name, "hidden": True})
            continue
        text = get("description", "recommendation", "text", "body")
        if not name or not text:
            raise ValueError(f"CSV row {number} needs an author name and recommendation text.")

        identifier = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        identifier = re.sub(r"[^a-z0-9]+", "-", identifier.casefold()).strip("-")
        if not identifier:
            raise ValueError(f"CSV row {number} needs a usable author identifier.")

        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text.replace("\r\n", "\n")) if part.strip()]
        excerpt = paragraphs[0]
        if len(excerpt) > 240:
            excerpt = excerpt[:237].rsplit(" ", 1)[0] + "…"
        title = get("jobtitle", "title", "headline")
        company = get("company", "associatedcompany")
        headline = f"{title} · {company}" if title and company else title or company
        recommendations.append({
            "id": identifier,
            "name": name,
            "headline": headline,
            "date": parse_date(get("creationdate", "date", "publisheddate", "datecreated")),
            "relationship": get("relationship"),
            "language": get("language"),
            "excerpt": excerpt,
            "paragraphs": paragraphs,
            "sourceUrl": SOURCE_URL,
        })
    if not recommendations:
        raise ValueError("No recommendations or explicit visibility updates were found in this CSV.")
    return recommendations


def merge_recommendations(existing: list[dict], incoming: list[dict]) -> list[dict]:
    """Merge authors, honor explicit hidden rows, and retain authors absent from an export."""
    merged = [dict(item) for item in existing]
    def author_key(name):
        # Credentials after a comma are often omitted from the CSV's name fields.
        plain = unicodedata.normalize("NFKD", name.split(",", 1)[0].casefold())
        return "".join(character for character in plain if character.isalnum() and not unicodedata.combining(character))

    for item in incoming:
        key = author_key(item["name"])
        matches = [position for position, previous in enumerate(merged)
                   if author_key(previous["name"]) == key
                   or (item.get("id") and previous["id"] == item["id"])]
        if len(matches) > 1:
            raise ValueError(f"Ambiguous author {item['name']!r}; resolve existing duplicates before importing.")
        if item.get("hidden"):
            if matches:
                merged.pop(matches[0])
            continue
        if matches:
            position = matches[0]
            # Stable IDs preserve the identity of a card when its text changes.
            previous = merged[position]
            updated = {**previous, **item, "id": previous["id"]}
            for field in ("headline", "date", "relationship", "language"):
                updated[field] = item.get(field) or previous.get(field, "")
            merged[position] = updated
        else:
            merged.append(dict(item))
    return merged


def render_cards(recommendations: list[dict]) -> str:
    """Generate a no-JavaScript snapshot using escaped text, never raw source HTML."""
    cards = []
    identifiers = set()
    for item in sorted(recommendations, key=lambda entry: entry.get("date", ""), reverse=True):
        for field in ("id", "name", "excerpt"):
            if not isinstance(item.get(field), str) or not item[field].strip():
                raise ValueError(f"A recommendation needs a nonempty {field}.")
        if item["id"] in identifiers:
            raise ValueError("Duplicate recommendation identifier; nothing was written.")
        identifiers.add(item["id"])
        if not isinstance(item.get("paragraphs"), list) or any(not isinstance(part, str) for part in item["paragraphs"]):
            raise ValueError("Recommendation paragraphs must be an array of text.")
        source = urlparse(item["sourceUrl"])
        if source.scheme != "https" or not (source.hostname == "linkedin.com" or (source.hostname or "").endswith(".linkedin.com")):
            raise ValueError("Every recommendation needs a secure LinkedIn source URL.")
        name = escape(item["name"])
        initials = escape("".join(word[0] for word in item["name"].split()[:2]))
        language = "fr" if item.get("language") == "fr" else "en"
        paragraphs = "".join(f"<p>{escape(paragraph)}</p>" for paragraph in item["paragraphs"])
        full_text = f'<details class="recommendation-full"><summary>Read full recommendation</summary><div lang="{language}">{paragraphs}</div></details>' if paragraphs else '<p class="recommendation-excerpt-note">Short public excerpt · full text on LinkedIn</p>'
        published = ""
        if item.get("date"):
            label = date.fromisoformat(item["date"]).strftime("%b %d, %Y")
            published = f'<time datetime="{escape(item["date"])}">{label}</time>'
        cards.append(f'''<figure class="recommendation-card" data-recommendation-id="{escape(item['id'])}">
  <span class="recommendation-mark" aria-hidden="true">“</span>
  <blockquote lang="{language}"><p>{escape(item['excerpt'])}</p></blockquote>
  {full_text}
  <div class="recommendation-meta">{published}<span>{escape(item.get('relationship', ''))}</span></div>
  <figcaption>
    <span class="recommendation-avatar" aria-hidden="true">{initials}</span>
    <span><strong>{name}</strong><small>{escape(item.get('headline', ''))}</small></span>
    <a href="{escape(item['sourceUrl'])}" target="_blank" rel="noopener noreferrer" aria-label="Read {name}’s recommendation on LinkedIn">↗</a>
  </figcaption>
</figure>''')
    return "\n".join(cards)


def update_snapshot(html_path: Path, recommendations: list[dict]) -> None:
    source = html_path.read_text(encoding="utf-8")
    start, end = "<!-- recommendations:start -->", "<!-- recommendations:end -->"
    if source.count(start) != 1 or source.count(end) != 1:
        raise ValueError("The HTML needs exactly one pair of recommendation snapshot markers.")
    before, remainder = source.split(start, 1)
    _, after = remainder.split(end, 1)
    updated = before + start + "\n" + render_cards(recommendations) + "\n" + end + after
    html_path.write_text(updated, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", nargs="?", type=Path, help="LinkedIn Recommendations Received CSV")
    parser.add_argument("--snapshot-only", action="store_true", help="Regenerate HTML from the existing JSON collection")
    args = parser.parse_args()
    if not args.csv and not args.snapshot_only:
        parser.error("Supply a Recommendations Received CSV, or use --snapshot-only.")
    data_path = ROOT / "data" / "recommendations.json"
    try:
        payload = json.loads(data_path.read_text(encoding="utf-8"))
        if args.csv:
            incoming = read_recommendations(args.csv.read_text(encoding="utf-8-sig"))
            payload["recommendations"] = merge_recommendations(payload["recommendations"], incoming)
            payload["updatedAt"] = date.today().isoformat()
        # Validate and render first; invalid data should not overwrite the saved collection.
        render_cards(payload["recommendations"])
        update_snapshot(ROOT / "index.html", payload["recommendations"])
        data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {len(payload['recommendations'])} recommendations in JSON and the HTML snapshot.")
    except (OSError, ValueError, KeyError) as error:
        parser.exit(2, f"Import failed: {error}\n")


if __name__ == "__main__":
    main()
