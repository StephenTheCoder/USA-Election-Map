"""Rebuild the UK results and SVGs from the cited Commons/YAPms sources.

Requires openpyxl, pypdf, fonttools, and curl_cffi (downloads only).
Raw downloaded inputs are cached in .tools/uk; generated assets are committed.
Run: python scripts/build-uk-data.py
"""
import collections
import hashlib
import html
import json
import math
import re
import sqlite3
import sys
import urllib.request
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
import openpyxl
from pypdf import PdfReader
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.misc.transform import Transform

CACHE = ROOT / '.tools/uk'
CACHE.mkdir(parents=True, exist_ok=True)
INPUTS = {}
DATES = {1997: '1997-05-01', 2001: '2001-06-07', 2005: '2005-05-05',
         2010: '2010-05-06', 2015: '2015-05-07', 2017: '2017-06-08',
         2019: '2019-12-12', 2024: '2024-07-04'}

def download(name, url):
    path = CACHE / name
    if not path.exists() or '--refresh' in sys.argv:
        if 'researchbriefings.files.parliament.uk' in url:
            from curl_cffi import requests
            response = requests.get(url, impersonate='chrome')
            response.raise_for_status()
            data = response.content
        else:
            data = urllib.request.urlopen(url, timeout=60).read()
        path.write_bytes(data)
    INPUTS[name] = {'url': url, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    return path

def key(name):
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', name.lower().replace('&', 'and'))

# Party colours use this project's existing palettes in the browser.
PARTIES = {
    'UK-CON': ['Conservative', 'Con', 'blue'],
    'UK-LAB': ['Labour', 'Lab', 'red'],
    'UK-LD': ['Liberal Democrats', 'LD', 'orange'],
    'UK-SNP': ['Scottish National Party', 'SNP', 'yellow'],
    'UK-PC': ['Plaid Cymru', 'PC', 'cyan'],
    'UK-DUP': ['Democratic Unionist Party', 'DUP', 'scarlet'],
    'UK-SF': ['Sinn Féin', 'SF', 'green'],
    'UK-SDLP': ['Social Democratic and Labour Party', 'SDLP', 'lime'],
    'UK-UUP': ['Ulster Unionist Party', 'UUP', 'blue'],
    'UK-APNI': ['Alliance', 'APNI', 'yellow'],
    'UK-GREEN': ['Green', 'Green', 'green'],
    'UK-UKIP': ['UK Independence Party', 'UKIP', 'purple'],
    'UK-RUK': ['Reform UK', 'Reform', 'cyan'],
    'UK-TUV': ['Traditional Unionist Voice', 'TUV', 'blue'],
    'UK-UKUP': ['UK Unionist Party', 'UKUP', 'purple'],
    'UK-HC': ['Health Concern', 'HC', 'gray'],
    'UK-RES': ['Respect', 'Respect', 'magenta'],
    'UK-SPK': ['Speaker', 'Spk', 'gray'],
    'UK-IND': ['Independent', 'Ind', 'gray'],
    'UK-OTH': ['Other parties and independents (combined)', 'Other', 'gray'],
}
DB_PARTIES = {1: 'UK-CON', 3: 'UK-LAB', 4: 'UK-LD', 11: 'UK-SNP', 5: 'UK-PC',
              20: 'UK-DUP', 21: 'UK-SF', 22: 'UK-SDLP', 24: 'UK-UUP', 19: 'UK-APNI',
              2: 'UK-GREEN', 8: 'UK-UKIP', 257: 'UK-RUK', 69: 'UK-TUV'}
EARLY_PARTIES = {'conservative': 'UK-CON', 'labour': 'UK-LAB', 'liberaldemocrat': 'UK-LD',
                 'liberaldemocrats': 'UK-LD', 'snp': 'UK-SNP', 'plaidcymru': 'UK-PC',
                 'alliance': 'UK-APNI', 'dup': 'UK-DUP', 'sinnfein': 'UK-SF',
                 'sf': 'UK-SF', 'sdlp': 'UK-SDLP', 'uu': 'UK-UUP', 'uup': 'UK-UUP',
                 'ukup': 'UK-UKUP', 'other': 'UK-OTH'}
EXCEPTIONS = {
    1997: {'tatton': ('UK-IND', 29354), 'westbromwichwest': ('UK-SPK', 23969)},
    2001: {'glasgowspringburn': ('UK-SPK', 16053), 'wyreforest': ('UK-HC', 28487)},
    # RP05-33's validated table gives Galloway 15,801; the workbook note has a typo.
    2005: {'glasgownortheast': ('UK-SPK', 15153), 'bethnalgreenandbow': ('UK-RES', 15801),
           'blaenaugwent': ('UK-IND', 20505), 'wyreforest': ('UK-HC', 18739)},
}

def majorities(year, rows, reader):
    names = {key(r[2]): r[2] for r in rows}
    found = {}
    if year == 2001:
        for page in reader.pages[41:]:
            current = [None, None]
            def visit(text, cm, tm, font, size):
                x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
                col = int(x > float(page.mediabox.width) / 2)
                clean = text.strip().removeprefix('xx')
                k = key(clean)
                if k in names: current[col] = k
                match = re.match(r'Majority\s+([\d,]+)', clean)
                if match and current[col]: found[current[col]] = int(match[1].replace(',', ''))
            page.extract_text(visitor_text=visit)
    else:
        for page in reader.pages:
            for line in page.extract_text(extraction_mode='layout').splitlines():
                cols = re.split(r'\s{2,}', line.strip())
                if not cols or key(cols[0]) not in names: continue
                if year == 1997:
                    match = re.search(r'(?:hold|gain from \w+)\s+([\d,]+)\s+\d+\.\d%\s+\d+\.\d%', line)
                else:
                    match = re.search(r'\b(?:LAB|CON|LD|SNP|PC|DUP|SDLP|SF|UUP|SPK|IKHH|RES|IND)\s+([\d,]+)\s+\d+\s+\d+\.\d%\s+\d+\s*$', line)
                if match: found[key(cols[0])] = int(match[1].replace(',', ''))
    assert set(found) == set(names), (year, 'missing majority', set(names) - set(found))
    return found

def historical(workbook, year):
    sheet = list(workbook[str(year)].values)
    rows = [r for r in sheet if r[1] and isinstance(r[6], (int, float))]
    brief = {1997: 'RP01-38', 2001: 'RP01-54', 2005: 'RP05-33'}[year]
    reader = PdfReader(download(f'commons-{year}.pdf', f'https://researchbriefings.files.parliament.uk/documents/{brief}/{brief}.pdf'))
    majority = majorities(year, rows, reader)
    result = []
    # Validated 2005 tables supersede the earlier workbook, including electorates.
    validated_2005 = {}
    if year == 2005:
        countries = {key(r[2]): r[5] for r in rows}
        for page in reader.pages[106:122]:
            for line in page.extract_text().splitlines():
                match = re.match(r'(.+?)\s+(?:[A-Z]+)\s+(?:hold|gain from [A-Z]+)\s+(.+)', line)
                if not match: continue
                k = key(match[1])
                count = 5 if countries[k] == 'England' else 6
                nums = match[2].split()[:count]
                validated_2005[k] = [0 if n == '-' else int(n.replace(',', '')) for n in nums]
        assert len(validated_2005) == 646, ('2005 vote rows', len(validated_2005))
    for r in rows:
        k = key(r[2])
        era = 2010 if year == 2005 and r[5] == 'Scotland' else 1997
        region_id = f'UK{era}-{r[1]}'
        votes = []
        for i, title in enumerate(sheet[2]):
            if i < 8 or title is None: continue
            party = ('UK-PC' if r[5] == 'Wales' else 'UK-SNP') if title == 'PC/SNP' else EARLY_PARTIES[key(title)]
            count = round(r[i] or 0)
            if count: votes.append({'party': party, 'label': PARTIES[party][0], 'votes': count})
        if year == 2005:
            values = validated_2005[k]
            parties = (['UK-DUP', 'UK-SF', 'UK-SDLP', 'UK-UUP', 'UK-OTH'] if r[5] == 'Northern Ireland'
                       else ['UK-CON', 'UK-LAB', 'UK-LD'] + (['UK-PC'] if r[5] == 'Wales' else ['UK-SNP'] if r[5] == 'Scotland' else []) + ['UK-OTH'])
            assert len(values) == len(parties) + 1, (r[2], values)
            votes = [{'party': p, 'label': PARTIES[p][0], 'votes': n} for p, n in zip(parties, values) if n]
            assert sum(v['votes'] for v in votes) == values[-1], (r[2], values)
        total = sum(v['votes'] for v in votes)
        # Separate an elected minor candidate from the combined Other category.
        if k in EXCEPTIONS[year]:
            p, n = EXCEPTIONS[year][k]
            other = next(v for v in votes if v['party'] == 'UK-OTH')
            other['votes'] -= n
            votes.append({'party': p, 'label': PARTIES[p][0], 'votes': n})
            winner = p
        else:
            winner = max(votes, key=lambda v: v['votes'])['party']
            assert winner != 'UK-OTH', (year, r[2])
        votes = [v for v in votes if v['votes']]
        assert sum(v['votes'] for v in votes) == total
        result.append({'id': region_id, 'name': r[2].title(), 'country': r[5], 'party': winner,
                       'winner': PARTIES[winner][0], 'majority': majority[k], 'totalVotes': total,
                       'votes': votes, 'aggregate': True})
    return result

def contemporary(db, election_id, year, notional=False, boundary_year=None):
    query = '''SELECT e.id AS contest_id, e.polling_on, ca.name, ca.geographic_code, co.name AS country,
                      e.valid_vote_count, e.majority, c.*
               FROM elections e JOIN constituency_groups cg ON cg.id=e.constituency_group_id
               JOIN constituency_areas ca ON ca.id=cg.constituency_area_id
               JOIN countries co ON co.id=ca.country_id
               JOIN candidacies c ON c.election_id=e.id
               WHERE e.general_election_id=? AND e.is_notional=? ORDER BY e.id,c.result_position'''
    groups = collections.defaultdict(list)
    for row in db.execute(query, (election_id, int(notional))): groups[row['election_id']].append(row)
    result = []
    for rows in groups.values():
        votes = []
        for r in rows:
            if r['is_standing_as_commons_speaker']: party = 'UK-SPK'
            elif r['is_standing_as_independent']: party = 'UK-IND'
            else:
                certs = db.execute('''SELECT p.* FROM certifications c JOIN political_parties p ON p.id=c.political_party_id
                                      WHERE c.candidacy_id=? AND c.adjunct_to_certification_id IS NULL''', (r['id'],)).fetchall()
                if notional and not certs and r['is_notional_political_party_aggregate']:
                    party = 'UK-OTH'
                else:
                    assert len(certs) == 1, (year, r['name'], len(certs))
                    cert = certs[0]
                    party = DB_PARTIES.get(cert['id'], f'UK-P{cert["id"]}')
                    if notional: party = {35: 'UK-RES', 127: 'UK-HC'}.get(cert['id'], party)
                    PARTIES.setdefault(party, [cert['name'], cert['abbreviation'] or cert['name'], 'gray'])
            candidate = ' '.join(n for n in [r['candidate_given_name'], r['candidate_family_name']] if n)
            if notional: candidate = PARTIES[party][0]
            votes.append({'party': party, 'label': candidate, 'votes': r['vote_count']})
            if r['is_winning_candidacy']: winner, winner_name = party, candidate
        r = rows[0]
        assert sum(v['votes'] for v in votes) == r['valid_vote_count'], (year, r['name'])
        assert sorted((v['votes'] for v in votes), reverse=True)[0] - sorted((v['votes'] for v in votes), reverse=True)[1] == r['majority']
        result.append({'id': f'UK{boundary_year or (2024 if year == 2024 else 2010)}-{r["geographic_code"]}',
                       'name': r['name'], 'country': r['country'], 'party': winner, 'winner': winner_name,
                       'majority': r['majority'], 'totalVotes': r['valid_vote_count'], 'votes': votes})
        result[-1]['link'] = f'https://electionresults.parliament.uk/elections/{r["contest_id"]}'
        if r['polling_on'] != DATES[year]: result[-1]['pollingDate'] = r['polling_on']
        # The database records the general election's date here. Parliament's
        # Weekly Information Bulletin confirms this constituency's delayed poll.
        if year == 2010 and r['name'] == 'Thirsk and Malton': result[-1]['pollingDate'] = '2010-05-27'
    return result

def transform_attr(value):
    transform = Transform()
    for command, args in re.findall(r'(matrix|translate|scale)\(([^)]+)\)', value or ''):
        a = [float(n) for n in re.split(r'[\s,]+', args.strip())]
        if command == 'matrix': transform = transform.transform(a)
        elif command == 'translate': transform = transform.translate(a[0], a[1] if len(a) > 1 else 0)
        elif command == 'scale': transform = transform.scale(a[0], a[1] if len(a) > 1 else a[0])
    return transform

def outline(element):
    pen = SVGPathPen(None, ntos=lambda v: format(v, '.2f').rstrip('0').rstrip('.'))
    def walk(el, transform):
        transform = transform.transform(transform_attr(el.get('transform')))
        if el.tag.endswith('path'): parse_path(el.get('d'), TransformPen(pen, transform))
        for child in el: walk(child, transform)
    walk(element, Transform())
    return pen.getCommands()

def simplify(points, tolerance=0.02):
    """Ramer-Douglas-Peucker at less than 1/40 pixel at native map size."""
    keep = {0, len(points)-1}
    stack = [(0, len(points)-1)]
    while stack:
        start, end = stack.pop()
        ax, ay = points[start]
        bx, by = points[end]
        dx, dy = bx-ax, by-ay
        length = dx*dx + dy*dy
        best, distance = None, tolerance*tolerance
        for i in range(start+1, end):
            x, y = points[i]
            t = max(0, min(1, ((x-ax)*dx+(y-ay)*dy)/length)) if length else 0
            d = (x-ax-t*dx)**2 + (y-ay-t*dy)**2
            if d > distance: best, distance = i, d
        if best is not None:
            keep.add(best)
            stack.extend([(start, best), (best, end)])
    return [points[i] for i in sorted(keep)]

def svg(year, regions):
    filename = {1997: 'gbr-commons-1997121-results.svg', 2005: 'gbr-commons-2005125-results.svg',
                2010: 'gbr-commons-2010126-results.svg', 2024: 'gbr-commons-2024-blank.svg'}[year]
    source = ET.parse(download(f'map-{year}.svg', f'https://raw.githubusercontent.com/yapms/yapms/main/apps/yapms/src/lib/assets/maps/gbr/{filename}')).getroot()
    group = next(g for g in source if g.get('map-type') == 'regions')
    names = {key(r['name']): r for r in regions}
    # Official spelling variants; every join is checked for uniqueness and completeness.
    aliases = {'thecotswolds': 'cotswold', 'greatgrimsbby': 'greatgrimsby',
               'southendwestandleigh': 'southendwest', 'southhamptonitchin': 'southamptonitchen',
               'cityofyork': 'yorkcityof', 'thewrekin': 'wrekinthe', 'cityofchester': 'chestercityof',
               'sheffiledheeley': 'sheffieldheeley', 'sheffiledcentral': 'sheffieldcentral',
               'sheffiledbrightside': 'sheffieldbrightside', 'cityofdurham': 'durhamcityof',
               'kilmarnockandloudon': 'kilmarnockandloudoun', 'richmond': 'richmondyorks',
               'ayrshirecentral': 'centralayrshire', 'aidrieandshotts': 'airdrieandshotts'}
    paths = {}
    for el in group:
        if not el.get('long-name'): continue
        k = key(el.get('long-name'))
        if k not in names: k = aliases.get(k, k)
        if k not in names:
            replacements = {'westernisles': 'nah eileanananiar', 'nah eileanananiar': 'westernisles',
                            'orkneyandshetland': 'orkneyandshetland'}
            k = key(replacements.get(k, k))
        assert k in names, (year, 'map name', el.get('long-name'))
        r = names[k]
        assert r['id'] not in paths
        paths[r['id']] = outline(el)
    assert set(paths) == {r['id'] for r in regions}
    if year in [1997, 2005]:
        # The YAPms source uses 2010 Northern Ireland geography for its older
        # maps. Replace those 18 shapes with the original 1997 boundary layer.
        ni = json.loads(download('ni1997.geojson', 'https://umap.openstreetmap.fr/en/datalayer/919580/e0482a2c-76f0-40a5-8ce8-a4648d50e7d5/').read_text())
        ni_regions = [r for r in regions if r['country'] == 'Northern Ireland']
        bounds = BoundsPen(None)
        for r in ni_regions: parse_path(paths[r['id']], bounds)
        x0, y0, x1, y1 = bounds.bounds
        coordinates = [pt for f in ni['features'] for poly in f['geometry']['coordinates'] for ring in poly for pt in ring]
        def project(lon, lat): return lon, -math.degrees(math.log(math.tan(math.pi/4 + math.radians(lat)/2)))
        projected = [project(*p[:2]) for p in coordinates]
        a0, b0 = min(p[0] for p in projected), min(p[1] for p in projected)
        a1, b1 = max(p[0] for p in projected), max(p[1] for p in projected)
        ni_names = {'Antrim E': 'East Antrim', 'Antrim N': 'North Antrim', 'Antrim S': 'South Antrim',
                    'Belfast E': 'Belfast East', 'Belfast N': 'Belfast North', 'Belfast S': 'Belfast South',
                    'Belfast W': 'Belfast West', 'Down N': 'North Down', 'Down S': 'South Down',
                    'Fermanagh & S Tyrone': 'Fermanagh and South Tyrone', 'Ulster Mid': 'Mid Ulster',
                    'Tyrone W': 'West Tyrone', 'Londonderry E': 'East Londonderry'}
        for feature in ni['features']:
            name = feature['properties']['Name']
            r = names[key(ni_names.get(name, name))]
            commands = []
            for poly in feature['geometry']['coordinates']:
                for ring in poly:
                    points = []
                    for point in ring:
                        a, b = project(*point[:2])
                        points.append((x0+(a-a0)/(a1-a0)*(x1-x0), y0+(b-b0)/(b1-b0)*(y1-y0)))
                    commands.append('M' + 'L'.join(f'{x:.2f},{y:.2f}' for x, y in simplify(points)) + 'Z')
            paths[r['id']] = ''.join(commands)
    output = ['<svg id="svgdata" width="100%" height="100%" style="overflow: visible" xmlns="http://www.w3.org/2000/svg">',
              '<defs id="svgdefinitions"></defs>', '<g id="outlines" stroke="#181922" stroke-width="0.3" stroke-linejoin="round" fill-rule="evenodd"' +
              (f' transform="{group.get("transform")}"' if group.get('transform') else '') + '>']
    for rid, d in paths.items(): output.append(f'<path id="{rid}" d="{d}"/>')
    output += ['</g><g id="text"></g></svg>']
    path = ROOT / f'svg-sources/uk-commons-{year}-map.svg'
    path.write_text('\n'.join(output), encoding='utf8')
    return f'svg-sources/{path.name}'

def main():
    # Separate published CSVs provide an independent check of the database's
    # 2024 constituency totals, majorities and individual candidate votes.
    for label in ['constituencies', 'candidates']:
        filename = 'HoC-GE2024-results-by-' + ('constituency' if label == 'constituencies' else 'candidate') + '.csv'
        download(f'commons-2024-{label}.csv', f'https://researchbriefings.files.parliament.uk/documents/CBP-10009/{filename}')
    workbook = openpyxl.load_workbook(download('commons-1918-2019.xlsx', 'https://researchbriefings.files.parliament.uk/documents/CBP-8647/1918-2019election_results_by_pcon.xlsx'), data_only=True, read_only=True)
    db = sqlite3.connect(download('psephology.db', 'https://raw.githubusercontent.com/ukparliament/psephology-datasette/main/psephology.db'))
    db.row_factory = sqlite3.Row
    elections = []
    maps = {}
    for year in DATES:
        regions = historical(workbook, year) if year < 2010 else contemporary(db, {2010: 1, 2015: 2, 2017: 3, 2019: 4, 2024: 6}[year], year)
        assert len(regions) == (659 if year < 2005 else 646 if year == 2005 else 650)
        map_year = 1997 if year < 2005 else 2005 if year == 2005 else 2010 if year < 2024 else 2024
        if map_year not in maps: maps[map_year] = svg(map_year, regions)
        if year == 2001:
            # Use the official map spelling already matched to the same IDs.
            names = {r['id']: r['name'] for r in elections[0]['regions']}
            for r in regions: r['name'] = names[r['id']]
        national = collections.Counter()
        for r in regions:
            for v in r['votes']:
                # The early source groups minor parties and independents.
                # Separating an elected candidate locally must not make their
                # votes look like that party's full UK-wide vote total.
                p = 'UK-OTH' if year < 2010 and v['party'] in ['UK-IND', 'UK-HC', 'UK-RES'] else v['party']
                national[p] += v['votes']
        seats = collections.Counter(r['party'] for r in regions)
        elections.append({'date': DATES[year], 'year': year, 'svgPath': maps[map_year], 'regions': regions,
                          'nationalVotes': dict(national), 'seats': dict(seats), 'totalVotes': sum(national.values())})
        print(year, len(regions), dict(seats), sum(national.values()))
    output = ROOT / 'csv-sources/uk-general-elections.json'
    output.write_text(json.dumps({'parties': PARTIES, 'elections': elections}, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    (ROOT / 'csv-sources/uk-sources.json').write_text(json.dumps({
        'retrieved': '2026-10-13', 'inputs': INPUTS,
        'pollDateCorrectionSource': 'https://publications.parliament.uk/pa/cm201011/cmwib/wb100529/notifi.htm'
    }, indent=2) + '\n')
    for directory, entries in [('csv-sources', ['Past-UK-General-Elections']), ('svg-sources', [Path(p).name for p in maps.values()])]:
        path = ROOT / directory / 'source-updated-times.json'
        updates = json.loads(path.read_text())
        for name in entries: updates[name] = 1791849600000
        path.write_text(json.dumps(updates, indent=2) + '\n')

if __name__ == '__main__': main()
