"""Import Parliament's official estimates used to compare changed boundaries."""
import collections
import json
import runpy
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
helpers = runpy.run_path(str(root / 'scripts/build-uk-data.py'))
actual = json.loads((root / 'csv-sources/uk-general-elections.json').read_text(encoding='utf8'))
helpers['PARTIES'].update(actual['parties'])
db_path = helpers['download']('psephology.db', 'https://raw.githubusercontent.com/ukparliament/psephology-datasette/main/psephology.db')
db = sqlite3.connect(db_path)
db.row_factory = sqlite3.Row
elections = []
for year, boundary, eid in [(2005, 2010, 7), (2019, 2024, 5)]:
    regions = helpers['contemporary'](db, eid, year, notional=True, boundary_year=boundary)
    if year == 2005:
        # The 2005 estimates group unreported minor candidates into Other.
        for region in regions: region['aggregate'] = True
    expected = 591 if year == 2005 else 650
    assert len(regions) == expected
    if year == 2005:
        # Scotland used the same boundaries in 2005 and 2010; Parliament's
        # notional dataset covers England, Wales and NI only.
        scotland = [r for e in actual['elections'] if e['year'] == 2005 for r in e['regions'] if r['country'] == 'Scotland']
        assert len(scotland) == 59
        regions += scotland
    assert len(regions) == 650 and len({r['id'] for r in regions}) == 650
    shares = collections.Counter()
    seats = collections.Counter()
    for r in regions:
        assert sum(v['votes'] for v in r['votes']) == r['totalVotes']
        seats[r['party']] += 1
        for v in r['votes']: shares[v['party']] += v['votes']
    elections.append({'year': year, 'date': helpers['DATES'][year], 'boundaryYear': boundary,
                      'regions': regions, 'nationalVotes': dict(shares), 'totalVotes': sum(shares.values()),
                      'source': f'https://electionresults.parliament.uk/general-elections/{eid}'})
    print(year, f'on {boundary} boundaries:', len(regions), 'seats', dict(seats))
output = root / 'csv-sources/uk-notional-elections.json'
output.write_text(json.dumps({'parties': helpers['PARTIES'], 'elections': elections}, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
manifest = root / 'csv-sources/uk-notional-sources.json'
manifest.write_text(json.dumps({'database': helpers['INPUTS']['psephology.db'], 'sources': [e['source'] for e in elections]}, indent=2) + '\n')
