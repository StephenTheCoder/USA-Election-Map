"""Audit all elections, constituency geometry, multi-member votes and provenance."""
import collections
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'csv-sources/india-general-elections.json').read_text(encoding='utf-8'))
expected = {
    1952: (489, 'IN-INC', 364), 1957: (494, 'IN-INC', 371), 1962: (494, 'IN-INC', 361),
    1967: (520, 'IN-INC', 283), 1971: (518, 'IN-INC', 352), 1977: (542, 'IN-BLD', 295),
    1980: (529, 'IN-INC', 353), 1984: (541, 'IN-INC', 414), 1989: (529, 'IN-INC', 197),
    1991: (534, 'IN-INC', 244), 1996: (543, 'IN-BJP', 161), 1998: (543, 'IN-BJP', 182),
    1999: (543, 'IN-BJP', 182), 2004: (543, 'IN-INC', 145), 2009: (543, 'IN-INC', 206),
    2014: (543, 'IN-BJP', 282), 2019: (543, 'IN-BJP', 303), 2024: (543, 'IN-BJP', 240)
}
assert [e['year'] for e in data['elections']] == list(expected)
csv_versions = json.loads((ROOT / 'csv-sources/source-updated-times.json').read_text())
svg_versions = json.loads((ROOT / 'svg-sources/source-updated-times.json').read_text())
assert csv_versions['Past-India-General-Elections'] > 0
for e in data['elections']:
    year = e['year']
    count, leader, seats = expected[year]
    elected = [r for r in e['regions'] if not r.get('disabled')]
    assert len(elected) == count
    assert collections.Counter(r['party'] for r in elected) == e['seats']
    assert e['seats'][leader] == seats
    tree = ET.parse(ROOT / f"svg-sources/india-lok-sabha-{e['boundaryYear']}-map.svg")
    assert svg_versions[f"india-lok-sabha-{e['boundaryYear']}-map.svg"] > 0
    assert tree.getroot().get('id') == 'svgdata'
    group = tree.find(".//{http://www.w3.org/2000/svg}g[@id='outlines']")
    ids = [p.get('id') for p in group]
    assert all(p.get('data-state') and p.get('data-name') for p in group)
    assert len(ids) == len(set(ids))
    assert set(ids) == {r['id'] for r in e['regions']}
    assert tree.find(".//{http://www.w3.org/2000/svg}defs[@id='svgdefinitions']") is not None
    national = collections.Counter()
    for r in elected:
        assert r['party'] in data['parties'] and r['party'] != 'IN-NOTA'
        assert r['totalVotes'] == sum(v['votes'] for v in r['votes'])
        assert all(isinstance(v['votes'], int) and v['votes'] >= 0 and v['party'] in data['parties'] for v in r['votes'])
        assert any(v['label'] == r['winner'] and v['party'] == r['party'] for v in r['votes'])
        if r['seatNumber'] == 1:
            national.update({})
            for v in r['votes']:
                national[v['party']] += v['votes']
        if r['totalVotes'] == 0:
            assert r['majority'] == 0
        elif not r['multiMember'] and not r['uncontested']:
            candidates = sorted([v for v in r['votes'] if v['party'] != 'IN-NOTA'], key=lambda v: -v['votes'])
            assert r['majority'] == candidates[0]['votes']-candidates[1]['votes']
            assert math.isfinite(r['majority']/r['totalVotes']*100)
    assert dict(national) == e['nationalVotes'], (year, 'multi-member double count')
    assert sum(national.values()) == e['totalVotes']
    print(f'PASS {year}: {count} MPs; every constituency, candidate, margin and national vote sum')

latest = data['elections'][-1]
bargarh = next(r for r in data['elections'][0]['regions'] if r['name'] == 'Bargarh')
assert bargarh['party'] == 'IN-IND' and bargarh['winner'] == 'GHANSHYAM DAS THIRANI' and bargarh['majority'] == 4784
assert bargarh['sourceNote'] and 'eparlib.sansad.in' in bargarh['link']
assert latest['seats']['IN-INC'] == 99
assert latest['seats']['IN-SP'] == 37
assert latest['seats']['IN-AITC'] == 29
assert latest['seats']['IN-NCP_28_SP_29_'] == 8 and latest['seats']['IN-SHS_28_UBT_29_'] == 9
assert 'IN-NOTA' not in latest['seats']
surat = next(r for r in latest['regions'] if r['name'] == 'Surat')
assert surat['uncontested'] and surat['totalVotes'] == 0 and surat['party'] == 'IN-BJP'
vellore = next(r for r in data['elections'][-2]['regions'] if r['name'] == 'Vellore')
assert vellore['pollingDate'] == '2019-08-05' and vellore['majority'] == 8141
assert next(v for v in vellore['votes'] if v['party'] == 'IN-NOTA')['votes'] == 9417
assert vellore['totalVotes'] == 1026055 and data['elections'][-2]['totalVotes'] == 614172823
old_ids = {r['id'] for r in data['elections'][-2]['regions']}
assert len(old_ids & {r['id'] for r in latest['regions']}) == 523
for name, source in json.loads((ROOT / 'csv-sources/india-sources.json').read_text())['inputs'].items():
    path = ROOT / '.tools/india' / name
    if path.exists():
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256'], name
print('PASS unopposed Surat, delayed Vellore, distinct party splits, boundary continuity and source checksums')
