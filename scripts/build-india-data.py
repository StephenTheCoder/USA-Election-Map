"""Build all 18 Lok Sabha elections; source snapshots live in .tools/india.

Early elections use one state-grouped tile per elected MP. From 1977 the map
uses constituency polygons, with boundary-era identifiers and checked aliases.
"""
import collections
import csv
import hashlib
import json
import math
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
import shapefile
from shapely.geometry import shape

CACHE = ROOT / '.tools/india'
CACHE.mkdir(parents=True, exist_ok=True)
INPUTS = {}
BASE = 'https://raw.githubusercontent.com/'
MAPS = BASE + 'skthewimp/india-constituency-maps/HEAD/'
YEARS = [1952, 1957, 1962, 1967, 1971, 1977, 1980, 1984, 1989, 1991,
         1996, 1998, 1999, 2004, 2009, 2014, 2019, 2024]
# Slider dates are the main result dates, not a claim that every seat polled that day.
DATES = ['1952-03-27', '1957-03-14', '1962-02-25', '1967-02-21', '1971-03-10',
         '1977-03-20', '1980-01-06', '1984-12-28', '1989-11-26', '1991-06-15',
         '1996-05-08', '1998-03-02', '1999-10-06', '2004-05-13', '2009-05-16',
         '2014-05-16', '2019-05-23', '2024-06-04']
EXPECTED = [489, 494, 494, 520, 518, 542, 529, 541, 529, 534,
            543, 543, 543, 543, 543, 543, 543, 543]


def download(name, url):
    path = CACHE / name
    if not path.exists() or '--refresh' in sys.argv:
        path.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    INPUTS[name] = {'url': url, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    return path


def norm(value):
    return re.sub('[^A-Z0-9]', '', value.upper())


def state(value):
    n = norm(value)
    return {'UTTARANCHAL': 'UTTARAKHAND', 'UTTARKHAND': 'UTTARAKHAND',
            'ORISSA': 'ODISHA', 'PONDICHERRY': 'PUDUCHERRY', 'NCTOFDELHI': 'DELHI',
            'NATIONALCAPITALTERRITORYOFDELHI': 'DELHI', 'JAMMUANDKASHMIR': 'JAMMUKASHMIR'}.get(n, n)


def successors(value):
    n = state(value)
    return {'BIHAR': ['BIHAR', 'JHARKHAND'], 'MADHYAPRADESH': ['MADHYAPRADESH', 'CHHATTISGARH'],
            'UTTARPRADESH': ['UTTARPRADESH', 'UTTARAKHAND'],
            'ANDHRAPRADESH': ['ANDHRAPRADESH', 'TELANGANA'],
            'GOADAMANDIU': ['GOA', 'DAMANDIU'],
            'DADRANAGARHAVELIANDDAMANDIU': ['DADRANAGARHAVELI', 'DAMANDIU']}.get(n, [n])


# Exact spelling/rename joins only, reviewed within their own boundary era.
ALIASES = {}
for boundary, pairs in {
    1976: {'MONGER': 'MONGHYR', 'PALAMAU': 'PALAMU', 'DHULIA': 'DHULE',
           'SHOLAPUR': 'SOLAPUR', 'YEOTMAL': 'YAVATMAL', 'WANDIWASH': 'VANDAVASI',
           'BADAUN': 'BUDAUN', 'MACHHALISHAHR': 'MACHHLISHAHR'},
    2008: {'ANDAMAN & NICOBAR ISLANDS': 'ANDAMAN NICOBAR', 'ANAKAPALLI': 'ANAKAPALLE',
           'ARUKU': 'ARAKU', 'CHELVELLA': 'CHEVELLA', 'SECUNDRABAD': 'SECUNDERABAD',
           'SARGUJA': 'SURGUJA', 'DADAR & NAGAR HAVELI': 'DADRA NAGAR HAVELI',
           'DADRA AND NAGAR HAVELI': 'DADRA NAGAR HAVELI', 'PALAMAU': 'PALAMU',
           'AHMADNAGAR': 'AHMEDNAGAR', 'PUDUCHERRY': 'PONDICHERRY', 'FEROZPUR': 'FIROZPUR',
           'THIRUVALLUR': 'TIRUVALLUR', 'GAUTAM BUDDH NAGAR': 'GAUTAM BUDDHA NAGAR',
           'ARAMBAGH': 'ARAMBAG', 'BARRACKPORE': 'BARRACKPUR',
           'BURDWAN - DURGAPUR': 'BARDHAMAN DURGAPUR', 'JOYNAGAR': 'JAYNAGAR',
           'SRERAMPUR': 'SREERAMPUR'}
}.items():
    for old, new in pairs.items():
        ALIASES[boundary, norm(old)] = norm(new)
for side in ['NORTH', 'NORTH CENTRAL', 'NORTH EAST', 'NORTH WEST', 'SOUTH', 'SOUTH CENTRAL']:
    ALIASES[1976, norm('BOMBAY ' + side)] = norm('MUMBAI ' + side)
for old, new in {'NARSARAOPET': 'NARASARAOPET', 'KURNOOLU': 'KURNOOL',
                 'ANANTHAPUR': 'ANANTAPUR', 'THIRUPATHI': 'TIRUPATI',
                 'GUWAHATI': 'GAUHATI', 'PATLIPUTRA': 'PATALIPUTRA',
                 'HATKANANGALE': 'HATKANANGLE', 'BAHARAICH': 'BAHRAICH',
                 'HARIDWAR': 'HARDWAR'}.items():
    ALIASES[2024, norm(old)] = norm(new)
PARTY_ALIASES = {'ADK': 'AIADMK', 'ADMK': 'AIADMK', 'AAAP': 'AAP',
                 'INC(I)': 'INC', 'CPM': 'CPI(M)', 'TRS': 'BRS', 'TDP': 'TDP'}
MAJOR = {
    'BJP': ['Bharatiya Janata Party', 'BJP', 'orange'],
    'INC': ['Indian National Congress', 'INC', 'cyan'],
    'CPI(M)': ['Communist Party of India (Marxist)', 'CPI(M)', 'red'],
    'CPI': ['Communist Party of India', 'CPI', 'scarlet'],
    'SP': ['Samajwadi Party', 'SP', 'red'], 'BSP': ['Bahujan Samaj Party', 'BSP', 'blue'],
    'AITC': ['All India Trinamool Congress', 'AITC', 'green'],
    'DMK': ['Dravida Munnetra Kazhagam', 'DMK', 'red'],
    'AIADMK': ['All India Anna Dravida Munnetra Kazhagam', 'AIADMK', 'green'],
    'TDP': ['Telugu Desam', 'TDP', 'yellow'],
    'YSRCP': ['Yuvajana Sramika Rythu Congress Party', 'YSRCP', 'blue'],
    'JD(U)': ['Janata Dal (United)', 'JD(U)', 'green'],
    'RJD': ['Rashtriya Janata Dal', 'RJD', 'green'],
    'BJD': ['Biju Janata Dal', 'BJD', 'green'],
    'BRS': ['Bharat Rashtra Samithi (formerly TRS)', 'BRS', 'magenta'],
    'AAP': ['Aam Aadmi Party', 'AAP', 'cyan'],
    'SHS': ['Shiv Sena', 'SHS', 'scarlet'],
    'NCP': ['Nationalist Congress Party', 'NCP', 'blue'],
    'IND': ['Independent', 'Ind', 'gray'],
    'NOTA': ['None of the Above', 'NOTA', 'gray'],
    'BLD': ['Bharatiya Lok Dal (Janata alliance, 1977)', 'BLD', 'blue'],
    'JNP': ['Janata Party', 'JNP', 'blue'],
    'JD': ['Janata Dal', 'JD', 'green'],
    'JD(S)': ['Janata Dal (Secular)', 'JD(S)', 'green'],
    'JSP': ['Janasena Party', 'JSP', 'red'],
    'LJP(RV)': ['Lok Janshakti Party (Ram Vilas)', 'LJP(RV)', 'purple'],
    'CPI(ML)(L)': ['Communist Party of India (Marxist-Leninist) (Liberation)', 'CPI(ML)L', 'scarlet'],
    'NCP(SP)': ['Nationalist Congress Party – Sharadchandra Pawar', 'NCP(SP)', 'blue'],
    'SHS(UBT)': ['Shiv Sena (Uddhav Balasaheb Thackeray)', 'SHS(UBT)', 'scarlet'],
    'VPP': ['Voice of the People Party', 'VPP', 'purple'],
    'ZPM': ["Zoram People's Movement", 'ZPM', 'yellow'],
    'RLP': ['Rashtriya Loktantrik Party', 'RLP', 'green'],
    'BAP': ['Bharat Adivasi Party', 'BAP', 'yellow'],
    'VCK': ['Viduthalai Chiruthaigal Katchi', 'VCK', 'blue'],
    'ASP(KR)': ['Aazad Samaj Party (Kanshi Ram)', 'ASP(KR)', 'blue'],
    'AIMIM': ['All India Majlis-E-Ittehadul Muslimeen', 'AIMIM', 'green'],
    'IUML': ['Indian Union Muslim League', 'IUML', 'green'],
    'JMM': ['Jharkhand Mukti Morcha', 'JMM', 'green'],
    'SAD': ['Shiromani Akali Dal', 'SAD', 'blue'],
    'JKN': ['Jammu & Kashmir National Conference', 'JKN', 'red'],
    'RLD': ['Rashtriya Lok Dal', 'RLD', 'green'],
    'ADAL': ['Apna Dal (Soneylal)', 'ADAL', 'orange'],
    'SKM': ['Sikkim Krantikari Morcha', 'SKM', 'scarlet'],
    'AGP': ['Asom Gana Parishad', 'AGP', 'cyan'],
    'UPPL': ["United People's Party, Liberal", 'UPPL', 'yellow'],
    'AJSUP': ['AJSU Party', 'AJSU', 'green'],
    'HAMS': ['Hindustani Awam Morcha (Secular)', 'HAMS', 'green'],
    'KEC': ['Kerala Congress', 'KEC', 'green'],
    'RSP': ['Revolutionary Socialist Party', 'RSP', 'scarlet'],
    'MDMK': ['Marumalarchi Dravida Munnetra Kazhagam', 'MDMK', 'red'],
    'BJS': ['Bharatiya Jana Sangh', 'BJS', 'orange'],
    'SWA': ['Swatantra Party', 'SWA', 'blue'],
    'PSP': ['Praja Socialist Party', 'PSP', 'green'],
    'JNP(S)': ['Janata Party (Secular)', 'JNP(S)', 'green'],
}
PARTIES = {}
EXPANDED = {}


def party_id(code):
    # The shared UI interpolates IDs into CSS selectors; party punctuation must
    # remain in display names, never in the identifier. Escape without collisions.
    return 'IN-' + ''.join(c if c.isascii() and (c.isalnum() or c == '-') else f'_{ord(c):x}_' for c in code)


def party(code, expanded=None, year=None):
    # The 1951 Socialist Party and modern Samajwadi Party are distinct parties.
    if code == 'SP' and year == 1952:
        code = 'SOC1952'
        expanded = 'Socialist Party (1951–52)'
    code = PARTY_ALIASES.get(code, code)
    pid = party_id(code)
    name = expanded or EXPANDED.get(code) or code
    PARTIES[pid] = MAJOR.get(code, [name.title() if name.isupper() else name, code, 'gray'])
    return pid


def load_geometry(era):
    for ext in ['shp', 'shx', 'dbf', 'prj']:
        download(era + '.' + ext, MAPS + era + '/parliamentary/india_parliamentary.' + ext)
    result = []
    for item in shapefile.Reader(str(CACHE / era)).iterShapeRecords():
        r = item.record.as_dict()
        result.append({'state': r['ST_NAME'], 'code': r['ST_CODE'], 'number': r['PC_NO'],
                       'name': r['PC_NAME'], 'geometry': shape(item.shape.__geo_interface__)})
    return result


def geometry_id(item, era):
    # State reorganisation alone does not imply a boundary change.
    if era == 2024 and item['code'] not in ['S03', 'U08', 'U09']:
        era = 2008
    return f"IN{era}-{item['code']}-{item['number']:02d}"


def path_data(geometry):
    if geometry.geom_type == 'GeometryCollection':
        return ''.join(path_data(g) for g in geometry.geoms)
    polygons = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
    paths = []
    for poly in polygons:
        for ring in [poly.exterior, *poly.interiors]:
            points = [(round((x - 67) * 28 * math.cos(math.radians(23)), 2),
                       round((38 - y) * 28, 2)) for x, y in ring.coords]
            paths.append('M' + 'L'.join(f'{x},{y}' for x, y in points) + 'Z')
    return ''.join(paths)


def svg_file(year, outlines, labels=()):
    # Geometry is web-display precision; simplification never changes identities.
    root = ET.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', 'viewBox': '0 0 950 920',
                              'id': 'svgdata', 'width': '100%', 'height': '100%', 'style': 'overflow: visible'})
    ET.SubElement(root, 'title').text = f'India Lok Sabha {year}'
    ET.SubElement(root, 'desc').text = 'See csv-sources/INDIA-DATA.md for sources and methodology.'
    ET.SubElement(root, 'defs', {'id': 'svgdefinitions'})
    group = ET.SubElement(root, 'g', {'id': 'outlines', 'stroke': '#777', 'stroke-width': '.45',
                                    'fill': '#999', 'fill-rule': 'evenodd'})
    for rid, name, d, state_name in outlines:
        ET.SubElement(group, 'path', {'id': rid, 'data-name': name, 'data-state': state_name, 'd': d})
    text_group = ET.SubElement(root, 'g', {'id': 'text'})
    for x, y, label in labels:
        ET.SubElement(text_group, 'text', {'x': str(x), 'y': str(y), 'fill': '#bbb', 'font-size': '11',
                                   'font-family': 'sans-serif', 'pointer-events': 'none'}).text = label
    ET.ElementTree(root).write(ROOT / f'svg-sources/india-lok-sabha-{year}-map.svg', encoding='utf-8')


def make_tiles(election):
    groups = collections.defaultdict(list)
    for region in election['regions']:
        groups[region['state']].append(region)
    outlines, labels = [], []
    # Alphabetical state panels give every constituency a visible, equal-size seat.
    x, y = 15, 28
    for name, regions in sorted(groups.items()):
        height = 28 + math.ceil(len(regions) / 12) * 16
        if y + height > 890:
            x += 235
            y = 28
        labels.append((x, y, name.replace('_', ' ')))
        for i, r in enumerate(regions):
            tx, ty = x + (i % 12) * 17, y + 9 + (i // 12) * 16
            outlines.append((r['id'], r['name'], f'M{tx},{ty}h14v13h-14Z', r['state']))
        y += height + 12
    svg_file(election['year'], outlines, labels)


def main():
    artifact_sources = {ROOT / 'csv-sources/india-general-elections.json': ('csv-sources/source-updated-times.json', 'Past-India-General-Elections')}
    for year in [1952, 1957, 1962, 1967, 1971, 1976, 2008, 2024]:
        name = f'india-lok-sabha-{year}-map.svg'
        artifact_sources[ROOT / 'svg-sources' / name] = ('svg-sources/source-updated-times.json', name)
    previous = {p: hashlib.sha256(p.read_bytes()).digest() if p.exists() else None for p in artifact_sources}
    early = download('TCPD_IED_1951-62.csv', BASE + 'tcpd/IndianElectionsDataset_1951-to-1962/HEAD/TCPD_IED_1951-62.csv')
    history = download('2019-official.csv', 'https://data.opencity.in/dataset/1874a140-a8c4-4d5d-80cd-cbbd400c21e5/resource/ed40f56f-3d97-41a4-8b5d-14b204b6f320/download/81842470-a23e-4785-a22b-ba81284101de.csv')
    latest = download('2024.csv', BASE + 'thecont1/india-votes-data/HEAD/archive/2024%20Parliamentary%20Elections%20India.csv')
    expanded = download('ge_party_statistics.csv', BASE + 'tcpd/tcpd-ld-data-archive/HEAD/ld_files_db/GE/derived/lokdhaba/ge_party_statistics.csv')
    for row in csv.DictReader(expanded.open(encoding='utf-8-sig')):
        if row['Expanded_Party_Name']:
            EXPANDED.setdefault(row['Party'], row['Expanded_Party_Name'])
    early_rows = [r for r in csv.DictReader(early.open(encoding='utf-8-sig')) if r['Election_Type'] == 'GE']
    rows = [r for r in csv.DictReader(history.open(encoding='utf-8-sig')) if r['Poll_No'] == '0']
    modern_rows = list(csv.DictReader(latest.open(encoding='utf-8-sig'), delimiter=';'))
    corrections = json.loads((ROOT / 'scripts/india-corrections.json').read_text())
    geometries = {1976: load_geometry('pre2008'), 2008: load_geometry('post2008')}
    geometries[2024] = [g.copy() for g in geometries[2008] if g['code'] not in ['S03', 'S09']]
    for name in ['assam', 'j_and_k', 'ladakh']:
        geo = download(name + '.geojson', MAPS + 'redelimited/source/' + name + '_ls_new_borders.geojson')
        for feature in json.loads(geo.read_text())['features']:
            p = feature['properties']
            if int(p['ls_seat_code']) == 999:
                continue
            geometries[2024].append({'state': p['state_ut_name'], 'code': p['state_ut_code'],
                                    'number': int(p['ls_seat_code']), 'name': p['ls_seat_name'],
                                    'geometry': shape(feature['geometry'])})
    elections, errors = [], []
    for index, year in enumerate(YEARS):
        boundary = year if year < 1977 else 1976 if year < 2009 else 2008 if year < 2024 else 2024
        election = {'year': year, 'date': DATES[index], 'boundaryYear': boundary,
                    'regions': [], 'nationalVotes': {}, 'seats': {}}
        groups = collections.defaultdict(list)
        source = early_rows if year < 1962 else modern_rows if year == 2024 else rows
        for r in source:
            if year < 1962:
                if int(r['Year']) != year:
                    continue
                key = (r['State_Name'], r['Constituency_No'])
            elif year == 2024:
                key = (r['State'].strip(), r['Constituency'].strip())
            else:
                if int(r['Assembly_No']) != index + 1:
                    continue
                key = (r['State_Name'], r['Constituency_No'])
            groups[key].append(r)
        for (st, number), candidates in groups.items():
            first = candidates[0]
            name = first['Constituency_Name'].strip() if year != 2024 else first['Constituency'].strip()
            votes = []
            duplicate_names = collections.Counter(c['Candidate'].strip() for c in candidates)
            for ci, c in enumerate(candidates):
                pname = c['Party']
                code = pname
                if year == 2024:
                    code = {norm('Shiv Sena (Uddhav Balasaheb Thackrey)'): 'SHS(UBT)'}.get(norm(pname))
                    code = code or next((k for k, v in MAJOR.items() if norm(v[0]) == norm(pname)), None)
                    if code is None:
                        code = next((k for k, v in EXPANDED.items() if norm(v) == norm(pname)), None)
                    code = code or ('P' + hashlib.sha256(pname.encode()).hexdigest()[:10])
                pid = party(code, pname if year == 2024 else c.get('Party_Expanded'), year)
                if code.startswith('P') and year == 2024 and code not in MAJOR:
                    PARTIES[pid][1] = ''.join(word[0] for word in re.findall(r'[A-Za-z]+', pname) if word.lower() not in ['of', 'the', 'and'])[:12] or 'Other'
                v = 0 if c['Votes'].lower().startswith('uncontest') else int(float(c['Votes'] or 0))
                label = c['Candidate'].strip()
                if duplicate_names[label] > 1:
                    label += f" ({PARTIES[pid][1]}, candidate {ci+1})"
                votes.append({'party': pid, 'label': label, 'votes': v, 'candidateNumber': ci+1})
            source_votes = votes.copy()
            votes.sort(key=lambda v: -v['votes'])
            total = sum(v['votes'] for v in votes)
            if year >= 1962 and year != 2024:
                assert all(int(float(c['Valid_Votes'])) == total for c in candidates), (year, st, name, 'vote sum')
            for correction in corrections.values():
                if not correction.get('winner') and year == correction['year'] and st == correction['state'] and name == correction['constituency']:
                    existing = next((v for v in votes if v['party'] == party(correction['party'])), None)
                    if existing:
                        assert existing['votes'] == correction['votes'], (year, name, 'revised correction')
                    else:
                        votes.append({'party': party(correction['party']), 'label': correction['candidate'],
                                      'votes': correction['votes'], 'candidateNumber': len(votes)+1})
                        votes.sort(key=lambda v: -v['votes'])
                        total += correction['votes']
            for v in votes:
                election['nationalVotes'][v['party']] = election['nationalVotes'].get(v['party'], 0) + v['votes']
            if year < 1962:
                winners = [v for v, c in zip(source_votes, candidates) if c['Winner'] == 'True']
                assert len(winners) == int(first['NumberOfSeats']), (year, name, 'winner count')
            else:
                winners = [next(v for v in votes if v['party'] != 'IN-NOTA')]
            source_note = None
            source_link = 'https://www.eci.gov.in/statistical-reports'
            for correction in corrections.values():
                if correction.get('winner') and year == correction['year'] and st == correction['state'] and name == correction['constituency']:
                    winners = [v for v in votes if v['label'] == correction['candidate'] and v['party'] == party(correction['party'])]
                    assert len(winners) == 1 and winners[0]['votes'] == correction['votes']
                    source_note = 'Winner corrected against the original Lok Sabha swearing-in record; ECI summary has a conflicting winner.'
                    source_link = correction['source']
            matched = None
            if year >= 1977:
                clean_name = re.sub(r'\s*\((?:SC|ST)\)\s*$', '', name, flags=re.I)
                target = ALIASES.get((boundary, norm(clean_name)),
                    ALIASES.get((2008 if boundary == 2024 else boundary, norm(clean_name)), norm(clean_name)))
                options = [g for g in geometries[boundary] if state(g['state']) in successors(st)]
                matches = [g for g in options if norm(re.sub(r'\s*\(ex .*?\)', '', g['name'], flags=re.I)) == target]
                if len(matches) != 1:
                    errors.append((year, st, name, [g['name'] for g in options]))
                    continue
                matched = matches[0]
            for wi, winner in enumerate(winners):
                rid = geometry_id(matched, boundary) if matched else f'IN{boundary}-{norm(st)}-{int(number):03d}-{wi+1}'
                nonwinners = [v for v in votes if v['party'] != 'IN-NOTA' and v['candidateNumber'] not in [w['candidateNumber'] for w in winners]]
                uncontested = not nonwinners
                majority = winner['votes'] - nonwinners[0]['votes'] if nonwinners else 0
                r = {'id': rid, 'name': name.title() if name.isupper() else name,
                     'state': st.replace('_', ' '), 'party': winner['party'], 'winner': winner['label'],
                     'votes': votes, 'totalVotes': total, 'majority': majority,
                     'multiMember': len(winners) > 1, 'uncontested': uncontested,
                     'marginException': majority < 0 and len(winners) == 1,
                     'seatNumber': wi + 1, 'constituencySeats': len(winners),
                     'link': source_link, 'sourceNote': source_note}
                if year == 2019 and norm(name) == 'VELLORE':
                    r['pollingDate'] = '2019-08-05'
                if year not in [1952, 1957, 2024] and int(first['Year']) != year:
                    r['delayedPollYear'] = int(first['Year'])
                election['regions'].append(r)
                election['seats'][winner['party']] = election['seats'].get(winner['party'], 0) + 1
        if year >= 1977:
            used = {r['id'] for r in election['regions']}
            for g in geometries[boundary]:
                rid = geometry_id(g, boundary)
                if rid not in used:
                    election['regions'].append({'id': rid, 'name': g['name'], 'state': g['state'],
                        'party': 'Tossup', 'winner': '', 'votes': [], 'totalVotes': 0, 'majority': 0,
                        'disabled': True, 'noElection': True})
        election['regions'].sort(key=lambda r: r['id'])
        election['totalVotes'] = sum(election['nationalVotes'].values())
        elections.append(election)
    if errors:
        (CACHE / 'unmatched.json').write_text(json.dumps(errors, indent=2))
        raise ValueError(f'{len(errors)} unmatched constituencies; see .tools/india/unmatched.json')
    for e, count in zip(elections, EXPECTED):
        assert sum(not r.get('disabled') for r in e['regions']) == count, (e['year'], count)
        assert len({r['id'] for r in e['regions']}) == len(e['regions']), (e['year'], 'duplicate map ID')
        if e['year'] < 1977:
            make_tiles(e)
    for boundary, geo in geometries.items():
        assert len(geo) == 543
        # Stable 1976/2008 IDs also identify unchanged constituencies across 2024.
        svg_file(boundary, [(geometry_id(g, boundary), g['name'], path_data(g['geometry'].simplify(.002, preserve_topology=True)), g['state']) for g in geo])
    (ROOT / 'csv-sources/india-general-elections.json').write_text(json.dumps({'parties': PARTIES, 'elections': elections}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (ROOT / 'csv-sources/india-sources.json').write_text(json.dumps({'retrieved': '2026-10-13', 'inputs': INPUTS,
        'corrections': json.loads((ROOT / 'scripts/india-corrections.json').read_text())}, indent=2), encoding='utf-8')
    revision = int(time.time()*1000)
    for manifest in {v[0] for v in artifact_sources.values()}:
        path = ROOT / manifest
        versions = json.loads(path.read_text())
        for artifact, (target, key) in artifact_sources.items():
            if target == manifest and (key not in versions or previous[artifact] != hashlib.sha256(artifact.read_bytes()).digest()):
                versions[key] = revision
        path.write_text(json.dumps(versions, indent=2) + '\n')
    print('Built all 18 elections:', [(e['year'], len(e['regions'])) for e in elections])


if __name__ == '__main__':
    main()
