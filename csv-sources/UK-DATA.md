# UK general elections, 1997–2024

The flag selector opens a UK General Election tab with all eight elections from
1997 through 2024. It uses the existing MapCountry/MapType/MapSource model,
stylesheet, fonts, party palettes, House icon, charts, tooltips, date slider,
zoom controls and download/cache infrastructure. Only the Union Flag and UK
boundary outlines are new country-specific assets.

## Results sources

Election results are historical election outcomes, including the Speaker and
all Northern Ireland constituencies. They are not current parliamentary party
strengths, by-election results or notional results on later boundaries.

| Elections | Primary source |
| --- | --- |
| 1997 | [Commons RP01-38, validated results](https://commonslibrary.parliament.uk/research-briefings/rp01-38/) and [CBP-8647 historical workbook](https://commonslibrary.parliament.uk/research-briefings/cbp-8647/) |
| 2001 | [Commons RP01-54, full candidate results](https://commonslibrary.parliament.uk/research-briefings/rp01-54/) and the CBP-8647 workbook |
| 2005 | [Commons RP05-33, revised official results](https://commonslibrary.parliament.uk/research-briefings/rp05-33/), with constituency identifiers from CBP-8647 |
| 2010–2024 | [Commons verified election results](https://electionresults.parliament.uk/), downloaded from [Parliament's database](https://github.com/ukparliament/psephology-datasette) |
| 2024 cross-check | [Commons CBP-10009 constituency and candidate CSVs](https://commonslibrary.parliament.uk/research-briefings/cbp-10009/) |

The 1997–2005 constituency breakdowns are **votes by party**. Their source groups
some minor parties and independent candidates; these are explicitly labelled
“Other parties and independents (combined)”. Elected minor candidates are
separated locally, using the reports' exact vote counts. National totals retain
the combined minor-party category, so an elected candidate's votes are never
presented as their party's complete national total. The Speaker is separate.
The 2010–2024 breakdowns show every individual candidate, including small parties
and multiple independent candidates. Labour/Co-operative joint candidacies are
counted with Labour through their primary certification.

All margins come from the published winner-to-runner-up majority divided by
valid votes. A combined Other category is never treated as a single runner-up.
Vote shares are computed from integer vote counts without a display cutoff.
Seat totals count one MP per constituency: 659 in 1997/2001, 646 in 2005, and
650 from 2010 onward. No cross-boundary flips or shifts are inferred; Compare
and Copy are disabled on this historical UK tab.

The 2005 workbook note mistypes George Galloway's vote count as 15,891.
The revised RP05-33 table gives **15,801** and an **823** majority; those validated
figures are used. The 1997 Winchester result uses the general election's
two-vote majority, rather than the subsequent rerun. The 2010 result includes
the delayed Thirsk and Malton poll, with its **27 May 2010** date in the tooltip,
as confirmed by [Parliament's Weekly Information Bulletin](https://publications.parliament.uk/pa/cm201011/cmwib/wb100529/notifi.htm).

## Maps and attribution

Four boundary assets cover 1997/2001, 2005, 2010–2019 and 2024. Constituency IDs
include their boundary era; labels are matched to the results with checked,
explicit spelling aliases. Every map must match the election's entire set of
constituency IDs, including Northern Ireland.

Outlines are adapted from [YAPms](https://github.com/yapms/yapms), the same map
provider used by the existing site. The source SVG metadata attributes the
historical boundaries to [parlconst.org](https://www.parlconst.org/) and 2024
boundaries to [ONS](https://www.data.gov.uk/dataset/78e0c4f0-237f-41be-a81e-9888a8d93f28/westminster-parliamentary-constituencies-july-2024-boundaries-uk-bfc).
YAPms is licensed under [AGPL-3.0](https://github.com/yapms/yapms/blob/main/license).

The older YAPms maps refer to 2010 Northern Ireland outlines. Those 18 shapes
are replaced with the actual [1997 Northern Ireland boundaries by
parlconst.org](https://www.parlconst.org/constituency-maps/northern-ireland/1997),
downloaded from the author's linked uMap layer. The historical outlines are
reused under the author's [CC BY 4.0 licence](https://creativecommons.org/licenses/by/4.0/).
Those 18 outlines replace the later boundaries in both older SVGs. They are
fitted to the map's existing Northern Ireland extent. Coordinates are rounded
to 0.01 SVG unit; the detailed Northern Ireland polygons are simplified with a
maximum displacement of 0.02 SVG unit for web rendering.

Contains House of Commons Library data, reused under the
[Open Parliament Licence](https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/).
Map source attribution and upstream licensing remain applicable to the adapted
UK SVG assets. Direct source URLs and SHA-256 hashes for each downloaded input
are recorded in [uk-sources.json](uk-sources.json), retrieved 13 October 2026.

## Rebuild and verification

No new application dependencies or build step are required. To regenerate data:

```powershell
python -m pip install --target .tools/python -r scripts/requirements-uk.txt
python scripts/build-uk-data.py
python scripts/verify-uk-data.py
```

Raw inputs are cached in the ignored `.tools/uk` directory. `--refresh` downloads
new snapshots. The generator rejects incomplete map joins, missing historical
majorities, inconsistent vote sums, incorrect constituency counts and modern
majorities that disagree with the top two candidates. Source updates are an
intentional data revision and should be reviewed before committing.

Browser verification uses Edge and a local HTTP server:

```powershell
npm install --prefix .tools playwright
python -m http.server 8765 --bind 127.0.0.1
# In another terminal:
node scripts/verify-uk-ui.cjs
```

The browser audit checks all eight years, every rendered constituency, party
seat totals, national votes, real tooltip pointer interactions, vote counts,
zoom, both flag navigation routes, country persistence, keyboard date controls,
mobile rendering and runtime errors. Screenshots are saved in `.tools`.
