// UK elections share the site's MapCountry, MapType, MapSource and chart UI.
const UKPartyDefinitions = {
  CON: ["Conservative", "Con", "blue"], LAB: ["Labour", "Lab", "red"],
  LD: ["Liberal Democrats", "LD", "orange"], SNP: ["Scottish National Party", "SNP", "yellow"],
  PC: ["Plaid Cymru", "PC", "cyan"], DUP: ["Democratic Unionist Party", "DUP", "scarlet"],
  SF: ["Sinn Féin", "SF", "green"], SDLP: ["Social Democratic and Labour Party", "SDLP", "lime"],
  UUP: ["Ulster Unionist Party", "UUP", "blue"], APNI: ["Alliance", "APNI", "yellow"],
  GREEN: ["Green", "Green", "green"], UKIP: ["UK Independence Party", "UKIP", "purple"],
  RUK: ["Reform UK", "Reform", "cyan"], TUV: ["Traditional Unionist Voice", "TUV", "blue"],
  UKUP: ["UK Unionist Party", "UKUP", "purple"], HC: ["Health Concern", "HC", "gray"],
  RES: ["Respect", "Respect", "magenta"], SPK: ["Speaker", "Spk", "gray"],
  IND: ["Independent", "Ind", "gray"], OTH: ["Other parties and independents (combined)", "Other", "gray"]
}

const UKPoliticalParties = {[TossupParty.getID()]: TossupParty, [IndependentGenericParty.getID()]: IndependentGenericParty}
for (const [code, [name, shortName, color]] of Object.entries(UKPartyDefinitions))
{
  const id = `UK-${code}`
  UKPoliticalParties[id] = new PoliticalParty(id, [name], shortName, name, PoliticalPartyColors[color])
}

const UKRegionNames = {}
let UKNotionalDataPromise

function getUKBoundaryYear(year)
{
  return year >= 2024 ? 2024 : year >= 2010 ? 2010 : year >= 2005 ? 2005 : 1997
}

function getUKCommonsSVG(date)
{
  const year = date.getFullYear()
  const boundaryYear = getUKBoundaryYear(year)
  const path = `svg-sources/uk-commons-${boundaryYear}-map.svg`
  return currentViewingState == ViewingState.zooming ? [path, null] : path
}

function escapeUKElectionText(text)
{
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

function organizeUKGeneralElections(data)
{
  for (const [id, [name, shortName, color]] of Object.entries(data.parties))
  {
    UKPoliticalParties[id] ??= new PoliticalParty(id, [name], shortName, name, PoliticalPartyColors[color])
  }

  const mapData = {}
  const candidateNameData = {}
  const mapDates = []
  for (const election of data.elections)
  {
    // Local calendar dates match the existing slider's local date formatting.
    const [year, month, day] = election.date.split("-").map(Number)
    const date = new Date(year, month-1, day).getTime()
    mapDates.push(date)
    mapData[date] = {}
    candidateNameData[date] = Object.fromEntries(Object.entries(data.parties).map(([id, value]) => [id, value[0]]))

    for (const region of election.regions)
    {
      UKRegionNames[region.id] = escapeUKElectionText(region.name)
      const percentages = region.votes.map(vote => ({
        candidate: escapeUKElectionText(vote.label), partyID: vote.party, votes: vote.votes,
        voteshare: vote.votes / region.totalVotes * 100
      })).sort((a, b) => b.voteshare - a.voteshare)
      mapData[date][region.id] = {
        region: region.id, partyID: region.party, candidateName: escapeUKElectionText(region.winner),
        // The published winner-to-runner-up majority is independent of any
        // combined Other category in the 1997–2005 party-level breakdowns.
        margin: region.majority / region.totalVotes * 100,
        partyVotesharePercentages: percentages, totalVotes: region.totalVotes,
        voteWorth: 1, flip: false, link: region.link, pollingDate: region.pollingDate,
        name: UKRegionNames[region.id], electionYear: election.year,
        boundaryYear: election.boundaryYear ?? getUKBoundaryYear(election.year), aggregate: region.aggregate ?? false
      }
    }

    mapData[date][nationalPopularVoteID] = {
      region: nationalPopularVoteID,
      partyVotesharePercentages: Object.entries(election.nationalVotes).map(([partyID, votes]) => ({
        candidate: escapeUKElectionText(data.parties[partyID][0]), partyID, votes,
        voteshare: votes / election.totalVotes * 100
      })).sort((a, b) => b.voteshare - a.voteshare),
      totalVotes: election.totalVotes, electionYear: election.year,
      boundaryYear: election.boundaryYear ?? getUKBoundaryYear(election.year), aggregate: election.year < 2010
    }
  }
  return {mapData, mapDates, candidateNameData}
}

function getUKFormattedRegionName(nameOrID, regionData)
{
  const id = regionData?.region ?? nameOrID
  const stored = currentMapSource?.getMapData()?.[currentSliderDate?.getTime()]?.[id]
  const name = stored?.name ?? UKRegionNames[id] ?? nameOrID
  if (stored?.comparisonNote) return `${name}<br><span style='font-size: 14px; color: gray;'>${stored.comparisonNote}</span>`
  if (!stored?.pollingDate) return name
  const [year, month, day] = stored.pollingDate.split("-").map(Number)
  return `${name} (poll: ${new Date(year, month-1, day).toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric"})})`
}

function decodeUKElectionText(value)
{
  const textarea = document.createElement("textarea")
  textarea.innerHTML = value ?? ""
  return textarea.value
}

function serializeUKCustomMap(mapData)
{
  const rows = []
  const definitions = Object.fromEntries(Object.entries(politicalParties).map(([id, p]) => [id, {
    names: p.getNames(), shortName: p.getShortName(), candidateName: p.getCandidateName(), marginColors: p.getMarginColors()
  }]))
  for (const [date, regions] of Object.entries(mapData ?? {}))
  {
    const d = new Date(Number(date))
    const dateString = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`
    for (const [id, original] of Object.entries(regions))
    {
      const region = cloneObject(original)
      region.ukEditingMode = this.editingMode ?? EditingMode.margin
      let shares = region.partyVotesharePercentages ?? []
      const snapshot = region.ukSharesSnapshot
      const changedShares = snapshot && (snapshot.length != shares.length || shares.some(v => !snapshot.some(old => old.candidate == v.candidate && old.partyID == v.partyID && Math.abs(old.voteshare-v.voteshare) < 1e-7)))
      if (changedShares && this.editingMode == EditingMode.voteshare && !this.isCompare())
      {
        const sorted = [...shares].sort((a, b) => b.voteshare-a.voteshare)
        region.partyID = (sorted[0]?.voteshare ?? 0) > 0 ? sorted[0].partyID : TossupParty.getID()
        region.candidateName = region.partyID == TossupParty.getID() ? null : sorted[0].candidate
        region.margin = (sorted[0]?.voteshare ?? 0)-(sorted[1]?.voteshare ?? 0)
      }
      if (shares.length) region.ukSharesSnapshot = shares.map(v => ({candidate: v.candidate, partyID: v.partyID, voteshare: v.voteshare}))
      // Historical counts no longer describe a user-edited percentage scenario.
      const changedVotes = changedShares || (region.totalVotes > 0 && shares.some(v => v.votes != null && Math.abs(v.votes/region.totalVotes*100-v.voteshare) > 1e-7))
      if (changedVotes)
      {
        shares.forEach(v => delete v.votes)
        delete region.totalVotes
      }
      delete region.partyVotesharePercentages
      delete region.candidateMap
      region.name = decodeUKElectionText(region.name ?? UKRegionNames[id] ?? id)
      if (region.candidateName != null) region.candidateName = decodeUKElectionText(region.candidateName)
      const entries = shares.length ? shares : [{partyID: region.partyID, candidate: region.candidateName}]
      entries.forEach((v, i) => rows.push({
        date: dateString, region: id, name: region.name, boundary: region.boundaryYear ?? 2024,
        candidate: decodeUKElectionText(v.candidate ?? politicalParties[v.partyID]?.getCandidateName() ?? ""),
        party: v.partyID ?? TossupParty.getID(), voteshare: v.voteshare != null ? v.voteshare/100 : "",
        votes: v.votes ?? "", order: v.order ?? "", metadata: i == 0 ? JSON.stringify(region) : "",
        parties: rows.length == 0 ? JSON.stringify(definitions) : ""
      }))
    }
  }
  return rows.length ? Papa.unparse(rows) : "date\n" + getTodayString("/", false, "mdy")
}

function organizeUKCustomMap(rawData, dates)
{
  const mapData = {}
  const candidateNameData = {}
  for (const date of dates)
  {
    const groups = {}
    for (const row of rawData[date])
    {
      if (row.parties)
      {
        for (const [id, p] of Object.entries(JSON.parse(row.parties)))
        {
          politicalParties[id] ??= new PoliticalParty(id, p.names, p.shortName, p.candidateName, p.marginColors)
          politicalParties[id].setMarginColors(p.marginColors)
          politicalParties[id].setCandidateName(p.candidateName)
        }
      }
      if (!row.region) continue
      (groups[row.region] ??= []).push(row)
    }
    mapData[date] = {}
    for (const [id, rows] of Object.entries(groups))
    {
      const header = rows.find(r => r.metadata)
      const metadata = header ? JSON.parse(header.metadata) : {}
      if (metadata.ukEditingMode != null) this.editingMode = metadata.ukEditingMode
      const shares = rows.filter(r => r.voteshare !== "" && Number.isFinite(Number(r.voteshare))).map(r => ({
        candidate: escapeUKElectionText(r.candidate ?? politicalParties[r.party]?.getCandidateName() ?? r.party), partyID: r.party, voteshare: Number(r.voteshare)*100,
        votes: r.votes != null && r.votes !== "" ? Number(r.votes) : undefined, order: r.order != null && r.order !== "" ? Number(r.order) : undefined
      })).sort((a, b) => b.voteshare-a.voteshare)
      for (const v of shares) politicalParties[v.partyID] ??= new PoliticalParty(v.partyID, [v.partyID], v.partyID, v.partyID, PoliticalPartyColors.gray)
      UKRegionNames[id] = escapeUKElectionText(rows[0].name || id)
      const winner = metadata.partyID ?? shares[0]?.partyID ?? TossupParty.getID()
      const candidateMap = Object.fromEntries(shares.map(v => [v.partyID, v.candidate]))
      const candidateName = Object.hasOwn(metadata, "candidateName") ? (metadata.candidateName == null ? null : escapeUKElectionText(metadata.candidateName)) : shares[0]?.candidate
      if (candidateName) candidateMap[winner] = candidateName
      mapData[date][id] = {
        ...metadata, name: UKRegionNames[id], region: id, boundaryYear: Number(rows[0].boundary || metadata.boundaryYear || 2024),
        partyID: id == nationalPopularVoteID ? metadata.partyID : winner, candidateName, candidateMap,
        margin: id == nationalPopularVoteID ? metadata.margin : metadata.margin ?? (shares[0]?.voteshare ?? 0)-(shares[1]?.voteshare ?? 0),
        partyVotesharePercentages: (this.editingMode == EditingMode.voteshare || this.isCompare() || id == nationalPopularVoteID) ? shares : undefined
      }
    }
    candidateNameData[date] = Object.fromEntries(Object.entries(politicalParties).map(([id, p]) => [id, p.getCandidateName()]))
  }
  if (this == currentMapSource && !this.isCompare())
  {
    currentEditingMode = this.editingMode ?? EditingMode.margin
    updateSelectedEditMode()
  }
  return {mapData, mapDates: dates, candidateNameData}
}

function getUKCustomSVG(date)
{
  // Comparison records use today's model date, while the shared renderer
  // requests geometry using the first comparison election's date.
  const regions = this.mapData?.[date.getTime()] ?? Object.values(this.mapData ?? {}).at(-1) ?? {}
  const boundaryYear = Object.values(regions).find(r => r.boundaryYear)?.boundaryYear ?? 2024
  const path = `svg-sources/uk-commons-${boundaryYear}-map.svg`
  return currentViewingState == ViewingState.zooming ? [path, null] : path
}

async function loadUKNotionalMaps()
{
  UKNotionalDataPromise ??= $.getJSON("./csv-sources/uk-notional-elections.json").then(data => {
    const formatted = organizeUKGeneralElections(data)
    return Object.fromEntries(data.elections.map(e => {
      const [y, m, d] = e.date.split("-").map(Number)
      return [`${e.year}-${e.boundaryYear}`, formatted.mapData[new Date(y, m-1, d).getTime()]]
    }))
  }).catch(error => { UKNotionalDataPromise = null; throw error })
  return await UKNotionalDataPromise
}

function aggregateUKComparisonShares(region, combineUnreported)
{
  const reported = new Set(["UK-CON", "UK-LAB", "UK-LD", "UK-SNP", "UK-PC", "UK-DUP", "UK-SF", "UK-SDLP", "UK-UUP", "UK-SPK"])
  const result = {}
  for (const v of region.partyVotesharePercentages ?? [])
  {
    // Brexit Party became Reform UK; both records refer to the same party lineage.
    let party = v.partyID == "UK-P153" ? "UK-RUK" : v.partyID
    if (combineUnreported && !reported.has(party)) party = "UK-OTH"
    result[party] = (result[party] ?? 0)+v.voteshare
  }
  return result
}

async function createUKComparisonData(original)
{
  $(".uk-comparison-note").remove()
  const maps = original.map(cloneObject)
  const meta = maps.map(m => Object.values(m).find(r => r.boundaryYear) ?? {boundaryYear: 2024})
  const boundary = Math.max(...meta.map(m => m.boundaryYear))
  const needsNotional = meta.some(m => !m.customScenario && m.boundaryYear != boundary && ((m.electionYear == 2019 && boundary == 2024) || (m.electionYear == 2005 && boundary == 2010)))
  const notionals = needsNotional ? await loadUKNotionalMaps() : {}
  const notes = []
  for (let i = 0; i < 2; i++)
  {
    if (!meta[i].customScenario && meta[i].boundaryYear != boundary && notionals[`${meta[i].electionYear}-${boundary}`])
    {
      const national = maps[i][nationalPopularVoteID]
      maps[i] = cloneObject(notionals[`${meta[i].electionYear}-${boundary}`])
      maps[i][nationalPopularVoteID] = national
      notes.push(`${meta[i].electionYear} estimated on ${boundary} boundaries`)
      $(`#compareItem-${i}`).append(`<span class='uk-comparison-note' style='display: block; color: gray; font-size: 14px;'>${notes.at(-1)}</span>`)
      $(i == 0 ? "#firstCompareDateDisplay" : "#secondCompareDateDisplay").append("<span class='uk-comparison-note' style='font-size: .75em;'> (est.)</span>")
    }
  }
  const geometry = maps[meta[0].boundaryYear == boundary && Object.keys(maps[0]).length ? 0 : 1]
  const result = {}
  let unavailable = 0
  for (const id of Object.keys(geometry))
  {
    const a = maps[0][id]
    const b = maps[1][id]
    const base = geometry[id]
    if (!a || !b || a.disabled || b.disabled)
    {
      result[id] = {...base, region: id, boundaryYear: boundary, disabled: true, comparisonUnavailable: true,
        partyID: TossupParty.getID(), margin: 0, partyVotesharePercentages: []}
      if (id != nationalPopularVoteID) unavailable++
      continue
    }
    const grouped = [a, b].map(r => aggregateUKComparisonShares(r, a.aggregate || b.aggregate))
    const parties = [...new Set(grouped.flatMap(Object.keys))]
    const changes = parties.map(partyID => ({partyID, candidate: escapeUKElectionText(politicalParties[partyID]?.getNames()[0] ?? partyID),
      voteshare: (grouped[0][partyID] ?? 0)-(grouped[1][partyID] ?? 0)}))
    changes.sort((x, y) => compareSortMode == CompareSortMode.shiftMargin ? y.voteshare-x.voteshare : (grouped[0][y.partyID] ?? 0)-(grouped[0][x.partyID] ?? 0))
    changes.forEach((v, i) => v.order = i)
    const normalizeLeader = (region, shares) => {
      const sorted = Object.entries(shares).sort((x, y) => y[1]-x[1])
      return {party: region.partyID == "UK-P153" ? "UK-RUK" : region.partyID ?? sorted[0]?.[0] ?? TossupParty.getID(),
        margin: region.margin ?? (sorted[0]?.[1] ?? 0)-(sorted[1]?.[1] ?? 0)}
    }
    const leaders = [normalizeLeader(a, grouped[0]), normalizeLeader(b, grouped[1])]
    const movement = leaders[0].margin+(leaders[0].party == leaders[1].party ? -leaders[1].margin : leaders[1].margin)
    const candidates = a.partyVotesharePercentages ?? a.ukSharesSnapshot ?? []
    const winner = candidates.find(v => v.candidate == a.candidateName) ?? candidates.find(v => (v.partyID == "UK-P153" ? "UK-RUK" : v.partyID) == leaders[0].party)
    const runnerShare = (winner?.voteshare ?? NaN)-leaders[0].margin
    // Match the published runner-up share before considering a combined Other
    // row, which may contain more than one candidate in the early datasets.
    const runner = candidates.find(v => v != winner && Math.abs(v.voteshare-runnerShare) < 1e-7)
    const opponent = runner?.partyID ?? (a.aggregate && a.partyVotesharePercentages ? "UK-OTH" : candidates.find(v => v.partyID != leaders[0].party)?.partyID)
    result[id] = {region: id, name: base.name, boundaryYear: boundary, comparison: true,
      comparisonNote: notes.join("; "), partyID: Math.abs(movement) < 1e-9 ? TossupParty.getID() : movement < 0 ? (opponent ?? leaders[1].party) : leaders[0].party,
      candidateName: null, margin: Math.abs(movement), partyVotesharePercentages: a.partyVotesharePercentages && b.partyVotesharePercentages ? changes : undefined}
  }
  if (unavailable) $("#compareItem-0").append(`<span class='uk-comparison-note' style='display: block; color: gray; font-size: 14px;'>${unavailable} constituencies unavailable across these boundaries</span>`)
  return result
}

const UKCommonsMapType = new MapType(
  "UK-Commons", "General Election", "GE", "assets/usa-house.png",
  "svg-sources/uk-commons-2024-map.svg", 650, (decade, id, region) => region?.comparisonUnavailable ? 0 : 1,
  false, 1, true, true, false, false, UKRegionNames, [], [],
  () => {
    const past = new MapSource(
      "Past-UK-General-Elections", "Past Elections",
      {type: jsonSourceType, url: "./csv-sources/uk-general-elections.json"},
      "https://commonslibrary.parliament.uk/research-briefings/cbp-8647/",
      {regular: "./assets/usa-house.png", mini: "./assets/usa-house.png", getOverlayText: () => currentSliderDate?.getFullYear() ?? ""},
      {}, null, null, null, null, null, null, false, true,
      organizeUKGeneralElections, null,
      (data, region, checkOnly) => checkOnly ? true : data,
      null, {}, getUKFormattedRegionName,
      (homepage, regionID, links, date, shouldOpenHomepage, data) => {
        const region = data?.[date?.getTime()]?.[regionID]
        if (!shouldOpenHomepage && region?.link) return region.link
        const year = date?.getFullYear()
        const briefing = {1997: "rp01-38", 2001: "rp01-54", 2005: "rp05-33", 2010: "rp10-36",
          2015: "cbp-7186", 2017: "cbp-7979", 2019: "cbp-8749", 2024: "cbp-10009"}[year]
        return briefing ? `https://commonslibrary.parliament.uk/research-briefings/${briefing}/` : homepage
      },
      null, null, false, true, true, 0, getUKCommonsSVG, null, true, true
    )

    const names = Object.fromEntries(Object.entries(UKPoliticalParties).map(([id, p]) => [id, p.getNames()[0]]))
    const custom = new MapSource(
      "Custom-UK-Commons", "Custom", null, null, null,
      {date: "date", region: "region", candidateName: "candidate", partyID: "party", voteshare: "voteshare", candidateVotes: "votes", order: "order"},
      null, invertObject(names), names, {}, null, null, false, true, organizeUKCustomMap, null,
      (data, region, checkOnly) => checkOnly ? true : data, null, {}, getUKFormattedRegionName,
      () => null,
      function(display, saved) {
        for (const [id, region] of Object.entries(display)) saved[id] = {...saved[id], ...cloneObject(region), customScenario: !this.isCompare(),
          comparisonUnavailable: this.isCompare() ? region.comparisonUnavailable : false,
          ukSharesSnapshot: saved[id]?.ukSharesSnapshot ?? region.partyVotesharePercentages?.map(v => ({candidate: v.candidate, partyID: v.partyID, voteshare: v.voteshare}))}
      },
      null, true, false, true, 0, getUKCustomSVG, null, true, true
    )
    custom.convertArrayToCSV = serializeUKCustomMap
    custom.createComparisonData = createUKComparisonData
    custom.setTextMapData("date\n" + getTodayString("/", false, "mdy"))
    return {
      mapSources: {[past.getID()]: past, [custom.getID()]: custom},
      mapSourceIDs: {[allYearsCycle]: [past.getID(), custom.getID()]}, mapCycles: [],
      defaultCompareSourceIDs: {1: [past.getID(), past.getID()]}, customSourceID: custom.getID()
    }
  }
)

UKCommonsMapType.startDefaultCompare = () => loadComparePreset(1)
