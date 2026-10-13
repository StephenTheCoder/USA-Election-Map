"""Audit committed UK assets, including independent published-data checks.

Run build-uk-data.py first to populate .tools/uk with the recorded raw sources.
"""
import collections
import csv
import hashlib
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
from pypdf import PdfReader

def key(name):
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', name.lower().replace('&', 'and'))

data = json.loads((ROOT / 'csv-sources/uk-general-elections.json').read_text(encoding='utf8'))
manifest = json.loads((ROOT / 'csv-sources/uk-sources.json').read_text())
for name, source in manifest['inputs'].items():
    assert hashlib.sha256((ROOT / '.tools/uk' / name).read_bytes()).hexdigest() == source['sha256'], name

# Published final seat totals, including the Speaker, rather than current party
# strengths. The report/database sources for each year are listed in UK-DATA.md.
expected = {
 1997: {'LAB':418,'CON':165,'LD':46,'SNP':6,'PC':4,'UUP':10,'SDLP':3,'SF':2,'DUP':2,'UKUP':1,'IND':1,'SPK':1},
 2001: {'LAB':412,'CON':166,'LD':52,'SNP':5,'PC':4,'UUP':6,'SDLP':3,'SF':4,'DUP':5,'HC':1,'SPK':1},
 2005: {'LAB':355,'CON':198,'LD':62,'SNP':6,'PC':3,'UUP':1,'SDLP':3,'SF':5,'DUP':9,'HC':1,'RES':1,'IND':1,'SPK':1},
 2010: {'LAB':258,'CON':306,'LD':57,'SNP':6,'PC':3,'SDLP':3,'SF':5,'DUP':8,'APNI':1,'GREEN':1,'IND':1,'SPK':1},
 2015: {'LAB':232,'CON':330,'LD':8,'SNP':56,'PC':3,'UUP':2,'SDLP':3,'SF':4,'DUP':8,'GREEN':1,'UKIP':1,'IND':1,'SPK':1},
 2017: {'LAB':262,'CON':317,'LD':12,'SNP':35,'PC':4,'SF':7,'DUP':10,'GREEN':1,'IND':1,'SPK':1},
 2019: {'LAB':202,'CON':365,'LD':11,'SNP':48,'PC':4,'SDLP':2,'SF':7,'DUP':8,'APNI':1,'GREEN':1,'SPK':1},
 2024: {'LAB':411,'CON':121,'LD':72,'SNP':9,'PC':4,'UUP':1,'SDLP':2,'SF':7,'DUP':5,'APNI':1,'GREEN':4,'RUK':5,'TUV':1,'IND':6,'SPK':1},
}
assert [e['year'] for e in data['elections']] == list(expected)
for election in data['elections']:
    year = election['year']
    regions = election['regions']
    seats = collections.Counter(r['party'] for r in regions)
    assert seats == {'UK-'+p: n for p, n in expected[year].items()}, year
    outlines = ET.parse(ROOT / election['svgPath']).find('{http://www.w3.org/2000/svg}g')
    assert {p.get('id') for p in outlines} == {r['id'] for r in regions}, year
    assert len(outlines) == len(regions)
    assert sum(r['totalVotes'] for r in regions) == election['totalVotes'] == sum(election['nationalVotes'].values())
    for region in regions:
        assert sum(v['votes'] for v in region['votes']) == region['totalVotes']
        assert all(v['votes'] >= 0 and v['party'] in data['parties'] for v in region['votes'])
        assert 0 < region['majority'] <= region['totalVotes']
    print(f'PASS {year}: published seat totals, complete map joins, vote sums and party IDs')

# An independent 1997 report table verifies the workbook's entire vote matrix.
election = data['elections'][0]
names = {key(r['name']): r for r in election['regions']}
verified = set()
for page in PdfReader(ROOT / '.tools/uk/commons-1997.pdf').pages[36:50]:
    for line in page.extract_text(extraction_mode='layout').splitlines():
        columns = re.split(r'\s{2,}', line.strip())
        if not columns or key(columns[0]) not in names: continue
        values = [int(v.replace(',', '')) for v in columns[1:] if re.fullmatch(r'[\d,]+', v)]
        region = names[key(columns[0])]
        main = ['UK-CON','UK-LAB','UK-LD','UK-SNP','UK-PC'] if region['country'] != 'Northern Ireland' else ['UK-CON','UK-UUP','UK-DUP','UK-SDLP','UK-SF','UK-APNI','UK-UKUP']
        groups = collections.Counter()
        for vote in region['votes']: groups[vote['party'] if vote['party'] in main else 'Other'] += vote['votes']
        assert sorted(values) == sorted(list(groups.values()) + [region['totalVotes']]), region['name']
        verified.add(region['id'])
assert len(verified) == 659
print('PASS all 659 1997 vote breakdowns independently match RP01-38')

# Every 2001 major-party count plus the total is independently checked against
# the full candidate tables. Their remainder proves the combined Other count.
election = data['elections'][1]
names = {key(r['name']): r for r in election['regions']}
major = {'Con':'UK-CON','Lab':'UK-LAB','LDem':'UK-LD','SNP':'UK-SNP','PC':'UK-PC','DUP':'UK-DUP','SF':'UK-SF','SDLP':'UK-SDLP','UUP':'UK-UUP'}
actual = collections.defaultdict(collections.Counter)
totals = {}
for page in PdfReader(ROOT / '.tools/uk/commons-2001.pdf').pages[41:]:
    current = [None, None]
    def visit(text, cm, tm, font, size):
        col = int(tm[4]*cm[0]+tm[5]*cm[2]+cm[4] > float(page.mediabox.width)/2)
        text = text.strip().removeprefix('xx')
        k = key(text)
        if k in names: current[col] = k
        match = re.match(r'Turnout\s+([\d,]+)', text)
        if match and current[col]: totals[current[col]] = int(match[1].replace(',', ''))
        match = re.search(r'\s(\S+)\s+([\d,]+)\s+(\d+\.\d)%', text)
        if match and current[col] and match[1] in major:
            actual[current[col]][major[match[1]]] += int(match[2].replace(',', ''))
    page.extract_text(visitor_text=visit)
assert len(totals) == 659
for k, region in names.items():
    assert totals[k] == region['totalVotes'], region['name']
    wanted = {v['party']: v['votes'] for v in region['votes'] if v['party'] in major.values()}
    assert actual[k] == wanted, region['name']
print('PASS all 659 2001 totals and major-party counts independently match RP01-54')

# 2024 is checked against the separately published CSVs as well as the database.
constituencies = {r['ONS ID']: r for r in csv.DictReader((ROOT / '.tools/uk/commons-2024-constituencies.csv').open(encoding='utf-8-sig'))}
candidates = collections.defaultdict(list)
for row in csv.DictReader((ROOT / '.tools/uk/commons-2024-candidates.csv').open(encoding='utf-8-sig')):
    candidates[row['ONS ID']].append(int(row['Votes']))
assert len(constituencies) == 650
for region in data['elections'][-1]['regions']:
    ons = region['id'].split('-', 1)[1]
    source = constituencies[ons]
    assert int(source['Valid votes']) == region['totalVotes'] and int(source['Majority']) == region['majority'], region['name']
    assert sorted(candidates[ons]) == sorted(v['votes'] for v in region['votes']), region['name']
print('PASS all 650 2024 constituencies and every candidate vote count match CBP-10009 CSVs')
