# UK Compare and Copy

Goal: Set up the UK Compare and Copy buttons to work like the US controls.

Completed cycles: 1. Latest Checker score: 9.5/10. All mandatory acceptance criteria verified. No required fixes remain.

Implemented: default comparison preset and two date sliders; party share and lead-margin shifts; official 2005-on-2010 and 2019-on-2024 estimates; explicit unavailable seats across unsupported boundary changes; editable copies in margin and vote-share modes; preserved boundaries, candidate names, editing modes and party definitions in CSV/JSON; custom-source comparisons and shared rendering/import fixes.

Evidence: node scripts/verify-uk-compare.cjs passes all 64 election pairs, geometry/count joins, self-comparison neutrality, reversed estimates, exact published numeric shifts, finite values, national share conservation and immutable historical data. node scripts/verify-uk-copy.cjs passes both modes for all eight elections, published-margin preservation, candidate shares, geometry, map identity, Save, JSON reload and cold CSV restoration. node scripts/verify-uk-mixed.cjs passes the actual Other menu, single-date custom self-comparison, numeric edited-versus-historical comparison and retention of custom cross-boundary edits.

node scripts/verify-uk-edit.cjs passes real pointer edits, an apostrophe-containing candidate input, changed winner/name, valid vote-share sums, removal of stale votes, Save, actual download/upload and uniform shift. A final repeat exposed a tooltip fade/hide timer race, which was fixed; three consecutive pointer-edit runs and a further final run passed.

node scripts/verify-uk-ui.cjs passes all eight rendered years, totals, hover vote counts, zoom, flag routes, persistence, keyboard controls and mobile overflow checks. Final country-switch repeats exposed stale asynchronous rendering; source/type checks were added and two final full UI runs passed with no runtime errors. .tools/verify-us-controls.cjs passes US Copy, editing, Save, map identity and Compare, with no runtime errors. JavaScript syntax checks and git diff --check pass. The independently verified historical dataset is unchanged.

Known coverage: official boundary estimates are available for 2005/2010 and 2019/2024. Other unmatched constituency IDs are grey and excluded from comparison seat totals; the dropdown reports unavailable counts. Early minor-party categories retain source aggregation.

Deliverables: src/model/map-types/uk-commons-map-type.js; csv-sources/uk-notional-elections.json; scripts/build-uk-notional-data.py; shared compare, renderer, region editor and import changes; scripts/verify-uk-{compare,copy,edit,mixed}.cjs; csv-sources/UK-DATA.md.

Local preview: http://127.0.0.1:8765

User committed earlier progress as 6966416 UK part 1 during this goal. Later final fixes and verification scripts remain workspace changes. No publication or commit was performed by the agent.
