# UK Compare and Copy

Goal: Set up the UK Compare and Copy buttons to work like the US controls.

Acceptance: working compare preset and two sliders; accurate shifts without mutating historical results; official estimates for 2019/2024 and 2005/2010 boundary changes; clearly unavailable unmatched constituencies; copied maps editable by margin or vote share; Save/Edit, CSV/JSON export/import, custom-source comparisons, boundary preservation and shared US behavior verified.

New goal. Completed cycles: 0. Builder cycle 1 in progress.

Evidence: browser rendered all eight dates with 659/659/646/650/650/650/650/650 coloured constituency outlines, matching seat counts and valid-vote totals. All 650 2024 constituencies independently match the published Commons CSV's valid votes and majority. 1997/2001/2005 majorities imported from the validated Commons reports, with complete row counts. 2001 valid-vote totals independently match all 659 candidate tables. Shared CSS is unchanged.

Final verification: `python scripts/verify-uk-data.py` passes all eight published seat totals, all map joins, vote sums, party identifiers, all 659 independent 1997 vote breakdown comparisons, all 659 independent 2001 valid-vote and major-party comparisons, and all 650 independent 2024 constituency/candidate CSV comparisons. The generator verifies every 1997/2001/2005 majority, all 646 validated 2005 vote rows, and every modern candidate vote sum and majority.

`node scripts/verify-uk-ui.cjs` passes all eight rendered maps, seat/vote totals, real hover vote counts, zoom, USA/UK/Jacksonia flag cycling and dropdown navigation, country persistence, keyboard slider controls, fresh mobile rendering with no horizontal overflow, and zero runtime errors. A separate live check confirms the 27 May 2010 delayed-poll tooltip. `git diff --check` passes. `style.css` is unchanged.

Source documentation: csv-sources/UK-DATA.md and csv-sources/uk-sources.json (direct URLs and SHA-256 hashes). Raw downloads and tooling are retained only in ignored .tools/. Duplicate temporary research files were removed after verifying their cached copies.

Remaining required work: implement the UK custom source, comparison preparation, notional data import, and interaction/round-trip tests.

Local preview: http://127.0.0.1:8765 (server started in this task).

Deliverables: src/model/map-types/uk-commons-map-type.js; csv-sources/uk-general-elections.json; svg-sources/uk-commons-*-map.svg; scripts/build-uk-data.py; assets/uk-flag.svg; shared country selector integration.
