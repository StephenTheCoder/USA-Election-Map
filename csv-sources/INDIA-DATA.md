# India Lok Sabha elections, 1951–52 to 2024

The India flag opens all 18 Lok Sabha general elections. This country uses the
same map, chart, date-slider, zoom, tooltip, Compare, Copy, editing, download,
upload and user-map infrastructure as the UK feature. Results represent general
election outcomes, including delayed polls included in those reports, rather
than current parliamentary membership or subsequent by-elections. Rajya Sabha
elections are not included.

## Results and sources

| Elections | Results input |
| --- | --- |
| 1951–52, 1957 | [TCPD Indian Elections Dataset 1951–1962](https://github.com/tcpd/IndianElectionsDataset_1951-to-1962), compiled from ECI reports, with explicit elected-member flags and constituency seat counts |
| 1962–2019 | TCPD candidate-level Lok Sabha table, archived by [OpenCity](https://data.opencity.in/dataset/parliamentary-elections-2019); only general-election records (`Poll_No = 0`) are used |
| Party names | [TCPD party-statistics archive](https://github.com/tcpd/tcpd-ld-data-archive/tree/main/ld_files_db/GE/derived/lokdhaba) |
| 2024 | [Archived ECI candidate results](https://github.com/thecont1/india-votes-data/blob/main/archive/2024%20Parliamentary%20Elections%20India.csv), including unopposed Surat |
| Cross-checks | [ECI election time series](https://www.eci.gov.in/about-eci/) and [ECI electoral history](https://www.eci.gov.in/EBooks/Leap_of_faith_Second_Edition/files/basic-html/page93.html) |

The historical file includes individual candidates, including losing
independents. It is not the TCPD derived party-summary table, which omits some
individual candidates. National totals sum candidate votes once per
constituency, including NOTA where present. Rejected ballots are excluded.
Percentages are computed from integer counts without a display cutoff; they
use the sum of candidate and NOTA votes, rather than rounded source percentages.

| General election | Elected seats in the included results |
| --- | ---: |
| 1951–52 | 489, from 401 constituencies |
| 1957 | 494, from 403 constituencies |
| 1962 | 494 |
| 1967 | 520 |
| 1971 | 518 |
| 1977 | 542 |
| 1980 | 529 |
| 1984–85 | 541 |
| 1989 | 529 |
| 1991–92 | 534 |
| 1996, 1998, 1999, 2004, 2009, 2014, 2019, 2024 | 543 each |

Some historical ECI summaries give the number of seats scheduled or allocated,
rather than the number with reported general-election results. The table above
counts the actual included results. Seats without a result are grey and excluded
from MP totals. The 1984 and 1991 cycles include the delayed 1985 and 1992 polls;
the affected constituency tooltips identify the later year. Slider dates are
representative dates for each election; they are not the polling dates of every
constituency. The first election's chart label is 1951–52.

### Early elections and special records

As requested, the five elections from 1951–1971 use **seat tiles grouped by
state**, not geographic constituency outlines. Each tile represents one elected
MP and retains the constituency's name and full candidate breakdown. In a
multi-member constituency, each member's tile has the same shared vote table,
but those votes enter the national total only once. Explicit elected-member
flags are used: reserved-seat winners must not be replaced with an arbitrary
ranking of all candidates.

Multi-member constituencies have no single-winner victory margin. Their tooltips
say “elected,” identify the member and shared votes, and do not invent a lead
margin. Unopposed seats also say “elected” and “no vote margin.” Two 1957 records
have multiple listed candidates but zero recorded votes; these are labelled
“Vote counts unavailable in this report” rather than given a fictitious result
margin. The seat is still counted for its reported elected member.

NOTA is shown as a ballot option, contributes to the vote denominator and
national totals, and can never elect an MP. It is excluded when selecting the
winner or runner-up, including in edited percentage scenarios.
Plain CSV imports recognise `IN-NOTA` even without the optional `nonElectable`
column, so an imported ballot-option row cannot become a constituency winner.

Duplicate candidate names in a constituency receive a party and candidate-number
qualifier. This keeps the displayed candidates distinct and gives each one a
separate edit field. Margins use candidate identity, not name alone.

Two source corrections are recorded in [india-corrections.json](../scripts/india-corrections.json):

* **Bargarh, 1951–52:** the ECI summary/TCPD flag names a lower-polling candidate.
  The original [Lok Sabha Members Sworn record, 13 May 1952](https://eparlib.sansad.in/bitstream/123456789/894287/1/01_I_13-05-1952_p13_p21_PII.pdf)
  confirms G. D. Thirani for Bargarh. The map uses Ghanshyam Das Thirani (IND),
  27,461 votes, and a 4,784 lead over Gananath Gautia, while retaining all candidate
  counts. The tooltip notes the correction and links to the parliamentary record.
* **Vellore, 2019:** the archived candidate table omits NOTA's **9,417** votes.
  [ECI's detailed report](https://www.eci.gov.in/statistical-report/ge/2019/1551),
  page 396 in this [report copy](https://devgatha.in/en/wp-content/uploads/2025/07/constituency-wise-detailed-result-2019.pdf),
  records 9,398 general votes plus 19 postal votes. Adding that row gives
  1,026,055 constituency votes and 614,172,823 nationally. The winner and 8,141
  majority are unchanged. The tooltip identifies the delayed 5 August poll.

Historical national vote tables retain distinct parties and splits. The 1951
Socialist Party is separate from the modern Samajwadi Party. NCP and NCP (SP),
and Shiv Sena and Shiv Sena (UBT), remain separate. Explicit aliases reconcile
AIADMK abbreviations, CPI(M), AAP and the TRS/BRS name change. Party display names
retain punctuation, while identifiers are escaped for the shared CSS-based UI.
Minor parties remain individually listed; they are not combined into a
single candidate or omitted.
Long tooltips stay within the viewport and scroll with the mouse wheel while
hovering the constituency, including Nalgonda's 480 candidates in 1996.

## Constituency outlines from 1977

The outlines are converted from [Karthik Shashidhar's pre/post-2008 boundary
collection](https://github.com/skthewimp/india-constituency-maps). The earlier
collection covers the 1976 delimitation used for 1977–2004, and the later
collection covers the 2008 boundaries used for 2009–2019. State reorganisations
and names are matched to the historical results without changing the reported
state labels.

For 2024, the unchanged outlines retain their 2008 identifiers. Assam and
Jammu & Kashmir/Ladakh use the separate updated boundaries from
[Shijith P. K.'s map supplement](https://github.com/shijithpk/2024_maps_supplement),
whose source maps are linked to ECI and state election authorities. The two
non-electoral “rest of” features numbered 999 are not parliamentary seats.

Coordinates are projected for display, simplified with a 0.002-degree tolerance
while preserving polygon topology, and rounded to 0.01 SVG unit. These are web
display outlines, not survey-quality GIS. Every rendered constituency ID must
match a result or an explicitly disabled record. Joins use exact names and
reviewed spelling aliases within the correct era; fuzzy guesses are rejected.

## Zoom and state views

The national map supports the zoom buttons, mouse wheel and dragging to pan.
Click a constituency (or an early seat tile) to open its state with every
constituency in that election's state. The state name appears above the map;
the close button returns to India. State views also support zoom and pan.
Dragging does not select a constituency, and editing clicks retain their
painting behavior.

State membership follows the selected election's reported historical labels.
Changing dates updates the state's seats; when a historical state disappears,
the map returns to India. The Seat Totals setting defaults to the selected
state and can be changed to All Seats. State vote totals count multi-member
ballots once; edited scenarios without complete vote counts do not invent
state totals. Comparison state views count only comparable seats and do not
infer state vote-share changes across unavailable boundaries.

Copied maps and imported partial CSVs use the complete boundary set for state
views. Saving or exporting while viewing a state preserves the national map
and never stores the temporary state vote-total record.

## Compare and Copy

Compare defaults to 2024 versus 2019. Map colors show the change in the winning
lead, following the UK workflow: subtract the earlier lead when the same party
wins, and add the two leads when the winner changes. A declining lead uses the
first result's runner-up party color. Tooltip rows show each party's vote-share
change in percentage points; independent candidates are grouped for those rows.

Comparisons use matching constituency identifiers only. The default pair has
523 comparable seats; 20 seats in Assam and Jammu & Kashmir/Ladakh are unavailable
across the updated boundary sets. Different historical tile sets and the
1976/2008 redraw are not matched by similar names. No unverified notional result
is substituted. Unavailable seats are grey, excluded from compared-seat totals,
and counted in the Compare dropdown. National comparisons still use actual
national totals. For multi-member or unopposed records, party-share differences
remain available while a single-winner margin movement is omitted.

Both **Edit by margin** and **Edit by voteshare** support Save/Edit, party
selection, uniform shifts, downloads/uploads and the existing user-map model.
Copies preserve the correct boundary set or historical seat tiles. CSVs retain
editing mode, candidate labels, party definitions, NOTA flags and record metadata,
with proper quoting. JSON uses the site's existing CSV wrapper. Percentage edits
discard stale historical counts; edits to unopposed seats become ordinary
scenarios. Historical result arrays remain unchanged by editing or comparison.

## Attribution and reuse

Please retain these source credits with the data and derived maps:

* “TCPD Indian Elections dataset (TCPD-IED), 1951–1962.” Trivedi Centre for Political
  Data, Ashoka University. The publisher's [terms](https://github.com/tcpd/IndianElectionsDataset_1951-to-1962#terms-and-conditions)
  allow non-commercial use with attribution and do not imply endorsement.
* TCPD Lok Dhaba candidate data, derived from Election Commission of India
  reports, archived by OpenCity; the respective provider terms apply.
* Karthik Shashidhar, India constituency maps. The collection's standardisation
  code/documentation is MIT; its README identifies geometry as derived from
  third-party reference data. Geometry attribution is retained separately from
  the application code.
* Shijith P. K., 2024 map supplement, [Unlicense](https://github.com/shijithpk/2024_maps_supplement/blob/main/LICENSE),
  based on ECI/state election maps, as described by the provider.
* Election Commission of India candidate results, through the cited archives,
  and the Lok Sabha's original parliamentary record for the Bargarh correction.

Each downloaded input's URL and SHA-256 checksum is recorded in
[india-sources.json](india-sources.json), together with the reviewed corrections.
Runtime uses committed JSON/SVG files and adds no application dependency or
build step.

## Rebuild and verify

```powershell
python -m pip install --target .tools/python -r scripts/requirements-india.txt
python scripts/build-india-data.py
python scripts/verify-india-data.py
```

Raw inputs are cached in ignored `.tools/india`. `--refresh` downloads new
snapshots; a refresh is a data revision and should be reviewed. The importer
rejects missing joins, duplicate constituency IDs, wrong elected-seat counts,
inconsistent vote sums and corrections that conflict with revised inputs.

Browser audits use the same local Edge/Playwright setup as the UK feature:

```powershell
npm install --prefix .tools playwright
python -m http.server 8765 --bind 127.0.0.1
# In another terminal:
node scripts/verify-india-ui.cjs
node scripts/verify-india-compare.cjs
node scripts/verify-india-copy.cjs
node scripts/verify-india-edit.cjs
node scripts/verify-india-zoom.cjs
```

These check all 18 elections, complete SVG coverage, MP totals, candidate votes,
all 324 comparison pairs, both Copy modes and CSV/JSON round trips, physical
pointer/keyboard controls, percentage edits, NOTA exclusion, real file downloads
and uploads, uniform shifts, custom comparisons, country persistence, mobile
rendering and runtime errors. The zoom audit checks every state's complete
geometry, seat totals and shared ballots in every election, physical zoom/pan
controls, historical state changes, zoomed edits, transfers and comparisons.
Screenshots and temporary downloads live in
`.tools`. The UK/US control audits cover the small shared renderer/tooltip changes.
Source reloads also handle empty candidate-name entries when switching countries.
