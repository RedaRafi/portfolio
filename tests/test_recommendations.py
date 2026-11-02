"""Import the owner's LinkedIn CSV export without a browser login or dependencies."""
import csv
import io
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from import_linkedin import read_recommendations, merge_recommendations, render_cards


class RecommendationImportTests(unittest.TestCase):
    def test_reads_linkedin_export_columns_and_keeps_paragraphs(self):
        source = io.StringIO()
        writer = csv.DictWriter(source, fieldnames=['First Name', 'Last Name', 'Company', 'Job Title', 'Description', 'Creation Date'])
        writer.writeheader()
        writer.writerow({'First Name': 'Alice', 'Last Name': 'Smith', 'Company': 'Example',
                         'Job Title': 'Manager', 'Description': 'First paragraph.\n\nSecond paragraph.', 'Creation Date': '8/7/24'})
        entries = read_recommendations(source.getvalue())
        self.assertEqual(entries[0]['name'], 'Alice Smith')
        self.assertEqual(entries[0]['date'], '2024-08-07')
        self.assertEqual(entries[0]['paragraphs'], ['First paragraph.', 'Second paragraph.'])

    def test_missing_text_is_reported_instead_of_silently_importing_nothing(self):
        with self.assertRaisesRegex(ValueError, 'text|Description'):
            read_recommendations('First Name,Last Name\nAlice,Smith\n')

    def test_merge_updates_an_author_without_erasing_other_recommendations(self):
        existing = [{'id': 'alice', 'name': 'Alice Smith', 'excerpt': 'Old'}, {'id': 'bob', 'name': 'Bob Jones'}]
        incoming = [{'id': 'new-id', 'name': 'ALICE SMITH', 'excerpt': 'Updated'}]
        merged = merge_recommendations(existing, incoming)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]['excerpt'], 'Updated')
        self.assertEqual(merged[0]['id'], 'alice')
        self.assertEqual(merged[1]['name'], 'Bob Jones')

    def test_snapshot_escapes_content_instead_of_interpreting_it_as_html(self):
        cards = render_cards([{'id': 'a', 'name': '<script>alert(1)</script>', 'headline': '',
                              'excerpt': '<img src=x>', 'paragraphs': ['Text & detail'],
                              'date': '', 'relationship': '', 'language': 'en',
                              'sourceUrl': 'https://www.linkedin.com/in/redarafi/'}])
        self.assertNotIn('<script>', cards)
        self.assertIn('&lt;img src=x&gt;', cards)
        self.assertIn('Text &amp; detail', cards)

    def test_export_name_without_accents_updates_the_existing_author(self):
        existing = [{'id': 'mohammed-reda-ouassini', 'name': 'Mohammed Réda OUASSINI',
                     'headline': 'Engagement Manager', 'relationship': 'Managed Reda directly'}]
        incoming = [{'id': 'mohammed-reda-ouassini', 'name': 'Mohammed Reda OUASSINI', 'excerpt': 'Updated'}]
        merged = merge_recommendations(existing, incoming)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]['headline'], 'Engagement Manager')
        self.assertEqual(merged[0]['relationship'], 'Managed Reda directly')

    def test_explicit_hidden_export_record_removes_its_published_card(self):
        incoming = read_recommendations('First Name,Last Name,Description,Status\nAlice,Smith,,Hidden\n')
        existing = [{'id': 'alice-smith', 'name': 'Alice Smith'}, {'id': 'bob-jones', 'name': 'Bob Jones'}]
        merged = merge_recommendations(existing, incoming)
        self.assertEqual([item['name'] for item in merged], ['Bob Jones'])

    def test_duplicate_identifiers_are_rejected_before_generating_a_snapshot(self):
        entry = {'id': 'same', 'name': 'Person', 'excerpt': 'Original words.', 'paragraphs': [],
                 'sourceUrl': 'https://www.linkedin.com/in/redarafi/'}
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            render_cards([entry, {**entry, 'name': 'Another person'}])


if __name__ == '__main__':
    unittest.main()
