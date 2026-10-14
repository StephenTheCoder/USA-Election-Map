# USA Election Map

An interactive USA presidential, senate, house, and governor election map. Created with HTML/CSS/JS, map svg outlines from [YAPms](https://www.yapms.com) & [US District Shapefiles](https://cdmaps.polisci.ucla.edu), and map data from [MIT Election Lab](https://electionlab.mit.edu/data) & [Dave Leip's Atlas](https://uselectionatlas.org).

## Features

* Interactive and detailed map sources
  * Past results for presidential (1788-2024, counties for 1892-2024), senatorial (1960-2024), house (1976-2024), and gubernatorial (1980-2024) elections, with victory margin and voteshare breakdowns for each state & district
  * UK general election results for every election from 1997 to 2024, accessible through the flag selector, with historical constituency boundaries, seat totals and vote breakdowns. See [UK data sources and methodology](csv-sources/UK-DATA.md).
  * All 18 Indian Lok Sabha elections from 1951–52 to 2024, through the India flag: state-grouped seat tiles for 1951–1971, constituency outlines thereafter, zoom/pan, click-through state views, candidate votes, MP totals, comparisons, editable copies and CSV/JSON import/export. See [India data sources and methodology](csv-sources/INDIA-DATA.md).
  * Pie chart for electoral vote counts by party and margin, national popular vote totals for past elections
  * Flip states and counties between election cycles
  * Fully editable custom maps that can be downloaded and uploaded as JSON or CSV files
* Comparisons between different map sources
  * Can show shift between elections for states and counties
  * Can show margins of error between projections and election results
* Countdown timer to upcoming elections and important events
* Keyboard controls for advanced usage

## Development

Running a fork locally is simple since this code only uses the base HTML/CSS/JS stack. Just clone the repo and open index.html in your browser to run.

If you run into CORS issues, run a local http server. On Mac (via [Homebrew](https://brew.sh)) you can use:
```
brew install http-server
cd USA-Election-Map
http-server
```
Then, open the address provided in the Terminal window (by default, it seems to be http://localhost:8080).

## GitHub Pages deployment

Before the first deployment of a fork, open the repository's **Settings > Pages**.
Under **Build and deployment**, set **Source** to **GitHub Actions**. The existing
`.github/workflows/pages.yml` publishes the default branch; you do not need to
create another workflow. See [GitHub's publishing-source setup instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

Then open **Actions > Deploy to Pages** and run the workflow on the default branch,
or rerun the failed deployment. Subsequent pushes to the default branch deploy
automatically.

If **Setup Pages** reports `Get Pages site failed` with HTTP 404, check the Pages
source setting above. Creating a `github-pages` environment or granting
`pages: write` to the workflow does not enable the Pages site. The action's
`enablement: true` option requires a separate token with the appropriate Pages
permissions; it cannot use the default `GITHUB_TOKEN` for initial enablement.
See the [configure-pages input documentation](https://github.com/actions/configure-pages/blob/v6/action.yml).

The deployment uses `ubuntu-24.04` to keep the runner version stable during the
`ubuntu-latest` migration. That migration notice is separate from the Pages 404.

## TODO List

See the [project issue board](https://github.com/users/jacksonjude/projects/2) for upcoming features.

If you have any questions, suggestions, or feature ideas, feel free to open an issue here on GitHub. Alternatively, you can email **jjcooley0@gmail.com**.
