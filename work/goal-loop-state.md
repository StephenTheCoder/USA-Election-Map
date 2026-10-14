# India map zoom and state views

Completed goal: Allow zooming into the map; clicking a constituency opens its
state and all constituencies in that state. User asks for careful verification.

Completed cycles: 1. Latest Checker score: 9.5/10. All mandatory acceptance
criteria verified; no required fixes remain. Previous India elections goal
was completed separately.

Acceptance criteria: national zoom buttons, wheel zoom and panning; a physical
constituency click opens the complete historical state; state zoom and return;
all 18 elections preserve their state membership, seat totals and shared ballots;
historical date navigation; custom maps and zoomed edits preserve other states;
comparisons remain available without corrupting custom maps; mobile controls;
UK/US shared-renderer regressions; no runtime errors.

Implemented: geometry state metadata and cache revisions for eight SVGs;
state selection/data/labels and complete geometry for partial custom CSVs;
national pan/zoom controller with drag/click separation and editing protection;
selected-state seat totals and vote aggregation; transient state vote records
excluded from saved maps; awaited return redraw and comparison-save guard;
tooltip display sorting copies candidate arrays instead of mutating sources.

Evidence: scripts/verify-india-zoom.cjs passes national physical controls,
all 548 state views in 18 elections, seat totals, deduplicated multi-member votes,
finite bounds, historical state navigation, zoomed editing, cold partial CSVs
and mobile zoom/reset/back, with no runtime errors. Actual JSON and CSV downloads
from a state view restore the whole country, preserving national votes and edits.
Comparison state clicks, unavailable Assam boundaries and return preserve
comparison records and the user's saved custom map. Source verifier passes
all 18 years and confirms every SVG path has state/name metadata.
India editing, UK editing and US controls pass after the final tooltip fix.
India UI and UK UI passed after the main zoom changes. Syntax checks and
git diff --check pass. Desktop and mobile state screenshots were inspected.
Physical click audits wait for transforms to settle and target interior pixels.

Remaining: none. Documentation includes zoom/state behavior and audit commands.

Deliverables: src/model/map-types/india-lok-sabha-map-type.js;
src/display/map-display.js; src/display/control-events.js; src/model/map-source.js;
index.html; style.css; scripts/build-india-data.py; eight India SVGs;
scripts/verify-india-zoom.cjs; csv-sources/INDIA-DATA.md.

Preview: http://127.0.0.1:8765. Changes remain in the worktree; no commit or deploy.
Pre-existing deployment and prior India-feature work are preserved.
