// India uses the same MapCountry, MapType and MapSource workflows as the UK.
const IndiaPartyDefinitions = {
  BJP: ["Bharatiya Janata Party", "BJP", "orange"], INC: ["Indian National Congress", "INC", "cyan"],
  SP: ["Samajwadi Party", "SP", "red"], AITC: ["All India Trinamool Congress", "AITC", "green"],
  DMK: ["Dravida Munnetra Kazhagam", "DMK", "red"], TDP: ["Telugu Desam", "TDP", "yellow"],
  "CPI(M)": ["Communist Party of India (Marxist)", "CPI(M)", "red"],
  CPI: ["Communist Party of India", "CPI", "scarlet"], BSP: ["Bahujan Samaj Party", "BSP", "blue"],
  AIADMK: ["All India Anna Dravida Munnetra Kazhagam", "AIADMK", "green"],
  YSRCP: ["Yuvajana Sramika Rythu Congress Party", "YSRCP", "blue"],
  "JD(U)": ["Janata Dal (United)", "JD(U)", "green"], RJD: ["Rashtriya Janata Dal", "RJD", "green"],
  BJD: ["Biju Janata Dal", "BJD", "green"], BRS: ["Bharat Rashtra Samithi (formerly TRS)", "BRS", "magenta"],
  AAP: ["Aam Aadmi Party", "AAP", "cyan"], SHS: ["Shiv Sena", "SHS", "scarlet"],
  NCP: ["Nationalist Congress Party", "NCP", "blue"], IND: ["Independent", "Ind", "gray"],
  NOTA: ["None of the Above", "NOTA", "gray"]
}
const IndiaPoliticalParties = {[TossupParty.getID()]: TossupParty, [IndependentGenericParty.getID()]: IndependentGenericParty}
for (const [code, [name, shortName, color]] of Object.entries(IndiaPartyDefinitions))
{
  const id = "IN-" + Array.from(code, c => /^[a-zA-Z0-9-]$/.test(c) ? c : `_${c.codePointAt(0).toString(16)}_`).join("")
  IndiaPoliticalParties[id] = new PoliticalParty(id, [name], shortName, name, PoliticalPartyColors[color])
}
const IndiaRegionNames = {}
const IndiaGeometryData = {}, IndiaGeometryPromises = {}

function escapeIndiaElectionText(value)
{
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;")
}

function getIndiaBoundaryYear(year)
{
  return year < 1977 ? year : year < 2009 ? 1976 : year < 2024 ? 2008 : 2024
}

async function getIndiaLokSabhaSVG(date)
{
  const boundary = getIndiaBoundaryYear(date.getFullYear())
  const path = `svg-sources/india-lok-sabha-${boundary}-map.svg`
  await loadIndiaGeometry(path, boundary)
  return getIndiaStateSVG(path, this.mapData?.[date.getTime()])
}

async function loadIndiaGeometry(path, boundary)
{
  IndiaGeometryPromises[boundary] ??= (async () => {
    const name = path.split('/').at(-1)
    let svg = await SVGDatabase.fetchFile(name)
    if (!svg)
    {
      svg = await $.ajax({url: path, dataType: "text"})
      await SVGDatabase.insertFile(name, svg)
    }
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
    IndiaGeometryData[boundary] = Object.fromEntries([...doc.querySelectorAll('#outlines > path')].map(el => {
      const id = el.id, name = escapeIndiaElectionText(el.getAttribute('data-name'))
      IndiaRegionNames[id] ??= name
      return [id, {region: id, name, state: escapeIndiaElectionText(el.getAttribute('data-state')),
        boundaryYear: boundary, margin: 0, partyID: TossupParty.getID(), voteWorth: 1}]
    }))
  })().catch(error => { delete IndiaGeometryPromises[boundary]; throw error })
  await IndiaGeometryPromises[boundary]
}

function getIndiaRegions(data)
{
  const meta = Object.values(data ?? {}).find(r => r.boundaryYear) ?? {boundaryYear: 2024}
  const year = meta.electionYear ?? (meta.boundaryYear < 1976 ? meta.boundaryYear : currentSliderDate?.getFullYear() ?? 2024)
  const base = IndiaGeometryData[meta.boundaryYear] ?? {}
  return Object.fromEntries(Object.entries(base).map(([id, geometry]) => {
    let state = geometry.state
    if (year < 2000) state = {JHARKHAND: "Bihar", CHHATTISGARH: "Madhya Pradesh", UTTARAKHAND: "Uttar Pradesh"}[getIndiaStateKey(state)] ?? state
    if (year <= 2014) state = getIndiaStateKey(state) == "TELANGANA" ? "Andhra Pradesh" : state
    if (year >= 2020 && ["DADRANAGARHAVELI", "DAMANDIU"].includes(getIndiaStateKey(state))) state = "Dadra &amp; Nagar Haveli and Daman &amp; Diu"
    return [id, {...geometry, state, ...data?.[id]}]
  }))
}

function getIndiaStateKey(state)
{
  const key = decodeIndiaElectionText(state ?? "").toUpperCase().replaceAll(/[^A-Z0-9]/g, "")
  return {ORISSA: "ODISHA", UTTARANCHAL: "UTTARAKHAND", UTTARKHAND: "UTTARAKHAND",
    PONDICHERRY: "PUDUCHERRY", MYSORE: "KARNATAKA", MADRAS: "TAMILNADU", JAMMUANDKASHMIR: "JAMMUKASHMIR"}[key] ?? key
}

function getIndiaZoomRegion(regionID, data)
{
  return getIndiaStateKey(getIndiaRegions(data)[regionID]?.state) || regionID
}

function getIndiaStateSVG(path, regions)
{
  if (currentViewingState != ViewingState.zooming) return path
  const all = getIndiaRegions(regions)
  const ids = Object.keys(all).filter(id => all[id].state && getIndiaStateKey(all[id].state) == currentMapZoomRegion)
  if (!ids.length)
  {
    // A historical state may cease to exist in the newly selected election.
    currentViewingState = ViewingState.viewing
    currentMapZoomRegion = null
    return path
  }
  return [path, {regionIDs: ids}]
}

function getIndiaStateData(data, region, checkOnly)
{
  const all = getIndiaRegions(data)
  const key = getIndiaStateKey(all[region]?.state) || region
  const rows = Object.entries(all).filter(([id, r]) => r.state && getIndiaStateKey(r.state) == key)
  if (checkOnly) return rows.length > 0
  const result = Object.fromEntries(rows)
  // Count a multi-member constituency's shared ballots only once.
  const counted = rows.map(([, r]) => r).filter(r => !r.disabled && (r.seatNumber ?? 1) == 1)
  if (counted.length && counted.every(r => !r.comparison && r.partyVotesharePercentages?.length && r.partyVotesharePercentages.every(v => Number.isFinite(v.votes))))
  {
    const votes = {}
    for (const r of counted) for (const v of r.partyVotesharePercentages) votes[v.partyID] = (votes[v.partyID] ?? 0)+v.votes
    const totalVotes = Object.values(votes).reduce((a, b) => a+b, 0)
    if (totalVotes > 0)
    {
      const id = key+subregionSeparator+statePopularVoteDistrictID
      result[id] = {region: id, partyID: TossupParty.getID(), margin: 0, totalVotes,
        partyVotesharePercentages: Object.entries(votes).map(([partyID, votes]) => ({partyID,
          candidate: escapeIndiaElectionText(politicalParties[partyID].getNames()[0]), votes, voteshare: votes/totalVotes*100}))}
      // This record supplies state popular votes; it is never an elected seat.
      result[id].partyID = result[id].partyVotesharePercentages.sort((a, b) => b.voteshare-a.voteshare)[0].partyID
    }
  }
  return result
}

function organizeIndiaGeneralElections(data)
{
  for (const [id, [name, shortName, color]] of Object.entries(data.parties))
  {
    IndiaPoliticalParties[id] ??= new PoliticalParty(id, [name], shortName, name, PoliticalPartyColors[color])
  }
  const mapData = {}, candidateNameData = {}, mapDates = []
  for (const election of data.elections)
  {
    const [year, month, day] = election.date.split("-").map(Number)
    const date = new Date(year, month-1, day).getTime()
    mapDates.push(date)
    mapData[date] = {}
    candidateNameData[date] = Object.fromEntries(Object.entries(data.parties).map(([id, p]) => [id, p[0]]))
    for (const r of election.regions)
    {
      IndiaRegionNames[r.id] = escapeIndiaElectionText(r.name)
      const shares = r.votes.map(v => ({candidate: escapeIndiaElectionText(v.label), partyID: v.party,
        votes: v.votes, voteshare: r.totalVotes ? v.votes/r.totalVotes*100 : 0, nonElectable: v.party == "IN-NOTA"}))
      mapData[date][r.id] = {
        region: r.id, name: IndiaRegionNames[r.id], state: escapeIndiaElectionText(r.state),
        partyID: r.disabled ? TossupParty.getID() : r.party, candidateName: escapeIndiaElectionText(r.winner),
        margin: r.multiMember || r.uncontested || r.marginException || !r.totalVotes ? 0 : r.majority/r.totalVotes*100,
        majority: r.majority, marginUnavailable: r.multiMember || r.uncontested || r.marginException || !r.totalVotes,
        voteCountsUnavailable: !r.totalVotes && !r.uncontested && !r.disabled,
        marginException: r.marginException,
        multiMember: r.multiMember, uncontested: r.uncontested, constituencySeats: r.constituencySeats,
        seatNumber: r.seatNumber, disabled: r.disabled ?? false, noElection: r.noElection,
        totalVotes: r.totalVotes, partyVotesharePercentages: shares, voteWorth: r.disabled ? 0 : 1,
        electionYear: election.year, boundaryYear: election.boundaryYear, flip: false,
        link: r.link, sourceNote: r.sourceNote, pollingDate: r.pollingDate, delayedPollYear: r.delayedPollYear
      }
    }
    mapData[date][nationalPopularVoteID] = {
      region: nationalPopularVoteID, totalVotes: election.totalVotes,
      electionYear: election.year, boundaryYear: election.boundaryYear,
      partyVotesharePercentages: Object.entries(election.nationalVotes).map(([partyID, votes]) => ({
        candidate: escapeIndiaElectionText(data.parties[partyID][0]), partyID, votes,
        voteshare: votes/election.totalVotes*100, nonElectable: partyID == "IN-NOTA"
      })).sort((a, b) => b.voteshare-a.voteshare)
    }
  }
  return {mapData, mapDates, candidateNameData}
}

function getIndiaFormattedRegionName(nameOrID, region)
{
  const id = region?.region ?? nameOrID
  const stored = currentMapSource?.getMapData()?.[currentSliderDate?.getTime()]?.[id] ?? region
  let name = stored?.name ?? IndiaRegionNames[id] ?? escapeIndiaElectionText(nameOrID)
  if (stored?.state) name += `<br><span class='india-region-note'>${stored.state}</span>`
  const notes = []
  if (stored?.electionYear < 1977) notes.push("Seat tile; one tile per elected MP")
  if (stored?.multiMember) notes.push(`Member ${stored.seatNumber} of ${stored.constituencySeats}; shared constituency votes`)
  if (stored?.uncontested) notes.push("Elected unopposed; no vote margin")
  if (stored?.voteCountsUnavailable) notes.push("Vote counts unavailable in this report; no margin")
  if (stored?.marginException) notes.push("Published winner and vote ranking differ; margin unavailable")
  if (stored?.pollingDate) notes.push(`Poll: ${escapeIndiaElectionText(stored.pollingDate)}`)
  if (stored?.delayedPollYear) notes.push(`Delayed poll held in ${stored.delayedPollYear}`)
  if (stored?.comparisonNote) notes.push(stored.comparisonNote)
  if (stored?.sourceNote) notes.push(escapeIndiaElectionText(stored.sourceNote))
  if ((stored?.partyVotesharePercentages?.length ?? 0)*26+140 > innerHeight-64) notes.push("Scroll to browse all candidates")
  if (notes.length) name += `<br><span class='india-region-note'>${notes.join("<br>")}</span>`
  return name
}

function decodeIndiaElectionText(value)
{
  const textarea = document.createElement("textarea")
  textarea.innerHTML = value ?? ""
  return textarea.value
}

function serializeIndiaCustomMap(mapData)
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
      region.indiaEditingMode = this.editingMode ?? EditingMode.margin
      let shares = region.partyVotesharePercentages ?? []
      shares.forEach(v => v.nonElectable ||= v.partyID == "IN-NOTA")
      const snapshot = region.indiaSharesSnapshot
      const changedShares = snapshot && (this.editingMode == EditingMode.voteshare || id == nationalPopularVoteID) &&
        (snapshot.length != shares.length || shares.some(v => !snapshot.some(old => old.candidate == v.candidate && old.partyID == v.partyID && Math.abs(old.voteshare-v.voteshare) < 1e-7)))
      if (changedShares && this.editingMode == EditingMode.voteshare && !this.isCompare())
      {
        const sorted = shares.filter(v => !v.nonElectable).sort((a, b) => b.voteshare-a.voteshare)
        region.partyID = (sorted[0]?.voteshare ?? 0) > 0 ? sorted[0].partyID : TossupParty.getID()
        region.candidateName = region.partyID == TossupParty.getID() ? null : sorted[0].candidate
        region.margin = (sorted[0]?.voteshare ?? 0)-(sorted[1]?.voteshare ?? 0)
      }
      if (id != nationalPopularVoteID && region.partyID == "IN-NOTA")
      {
        region.partyID = TossupParty.getID()
        region.candidateName = null
        region.margin = 0
      }
      if (shares.length) region.indiaSharesSnapshot = shares.map(v => ({candidate: v.candidate, partyID: v.partyID, voteshare: v.voteshare}))
      // Historical counts no longer describe a user-edited percentage scenario.
      const changedVotes = changedShares || (region.totalVotes > 0 && shares.some(v => v.votes != null && Math.abs(v.votes/region.totalVotes*100-v.voteshare) > 1e-7))
      if (changedVotes)
      {
        shares.forEach(v => delete v.votes)
        delete region.totalVotes
        delete region.majority
        region.marginUnavailable = false
        region.multiMember = false
        region.uncontested = false
        region.marginException = false
        region.voteCountsUnavailable = false
      }
      delete region.partyVotesharePercentages
      delete region.candidateMap
      region.name = decodeIndiaElectionText(region.name ?? IndiaRegionNames[id] ?? id)
      if (region.candidateName != null) region.candidateName = decodeIndiaElectionText(region.candidateName)
      const entries = shares.length ? shares : [{partyID: region.partyID, candidate: region.candidateName}]
      entries.forEach((v, i) => rows.push({
        date: dateString, region: id, name: region.name, boundary: region.boundaryYear ?? 2024,
        candidate: decodeIndiaElectionText(v.candidate ?? politicalParties[v.partyID]?.getCandidateName() ?? ""),
        party: v.partyID ?? TossupParty.getID(), voteshare: v.voteshare != null ? v.voteshare/100 : "",
        votes: v.votes ?? "", nonElectable: v.nonElectable ?? false, order: v.order ?? "", metadata: i == 0 ? JSON.stringify(region) : "",
        parties: rows.length == 0 ? JSON.stringify(definitions) : ""
      }))
    }
  }
  return rows.length ? Papa.unparse(rows) : "date\n" + getTodayString("/", false, "mdy")
}

function organizeIndiaCustomMap(rawData, dates)
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
      if (metadata.indiaEditingMode != null) this.editingMode = metadata.indiaEditingMode
      const shares = rows.filter(r => r.voteshare !== "" && Number.isFinite(Number(r.voteshare))).map(r => ({
        candidate: escapeIndiaElectionText(r.candidate ?? politicalParties[r.party]?.getCandidateName() ?? r.party), partyID: r.party, voteshare: Number(r.voteshare)*100,
        nonElectable: r.party == "IN-NOTA" || r.nonElectable === "true" || r.nonElectable === true, votes: r.votes != null && r.votes !== "" ? Number(r.votes) : undefined, order: r.order != null && r.order !== "" ? Number(r.order) : undefined
      })).sort((a, b) => b.voteshare-a.voteshare)
      for (const v of shares) politicalParties[v.partyID] ??= new PoliticalParty(v.partyID, [v.partyID], v.partyID, v.partyID, PoliticalPartyColors.gray)
      IndiaRegionNames[id] = escapeIndiaElectionText(rows[0].name || id)
      const electable = shares.filter(v => !v.nonElectable)
      const invalidWinner = metadata.partyID == "IN-NOTA" && id != nationalPopularVoteID
      const winner = (!invalidWinner ? metadata.partyID : null) ?? electable[0]?.partyID ?? TossupParty.getID()
      const candidateMap = Object.fromEntries(shares.map(v => [v.partyID, v.candidate]))
      const candidateName = !invalidWinner && Object.hasOwn(metadata, "candidateName") ? (metadata.candidateName == null ? null : escapeIndiaElectionText(metadata.candidateName)) : electable[0]?.candidate
      if (candidateName) candidateMap[winner] = candidateName
      mapData[date][id] = {
        ...metadata, name: IndiaRegionNames[id], region: id, boundaryYear: Number(rows[0].boundary || metadata.boundaryYear || 2024),
        partyID: id == nationalPopularVoteID ? metadata.partyID : winner, candidateName, candidateMap,
        margin: id == nationalPopularVoteID ? metadata.margin : (!invalidWinner ? metadata.margin : null) ?? (electable[0]?.voteshare ?? 0)-(electable[1]?.voteshare ?? 0),
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

async function getIndiaCustomSVG(date)
{
  // Comparison records use today's model date, while the shared renderer
  // requests geometry using the first comparison election's date.
  const regions = this.mapData?.[date.getTime()] ?? Object.values(this.mapData ?? {}).at(-1) ?? {}
  const boundaryYear = Object.values(regions).find(r => r.boundaryYear)?.boundaryYear ?? 2024
  const path = `svg-sources/india-lok-sabha-${boundaryYear}-map.svg`
  await loadIndiaGeometry(path, boundaryYear)
  return getIndiaStateSVG(path, regions)
}

function aggregateIndiaComparisonShares(region)
{
  const result = {}
  for (const v of region.partyVotesharePercentages ?? []) result[v.partyID] = (result[v.partyID] ?? 0)+v.voteshare
  return result
}

async function createIndiaComparisonData(original)
{
  $(".india-comparison-note").remove()
  const maps = original.map(cloneObject)
  const meta = maps.map(m => Object.values(m).find(r => r.boundaryYear) ?? {boundaryYear: 2024})
  const boundary = Math.max(...meta.map(m => m.boundaryYear))
  const geometry = maps[meta[0].boundaryYear == boundary ? 0 : 1]
  const result = {}
  let unavailable = 0
  for (const id of Object.keys(geometry))
  {
    const [a, b] = maps.map(m => m[id])
    const base = geometry[id]
    if (!a || !b || a.disabled || b.disabled)
    {
      result[id] = {...base, region: id, boundaryYear: boundary, disabled: true, comparisonUnavailable: true,
        partyID: TossupParty.getID(), margin: 0, partyVotesharePercentages: []}
      if (id != nationalPopularVoteID) unavailable++
      continue
    }
    const grouped = [a, b].map(aggregateIndiaComparisonShares)
    const parties = [...new Set(grouped.flatMap(Object.keys))]
    const changes = parties.map(partyID => ({partyID,
      candidate: escapeIndiaElectionText(politicalParties[partyID]?.getNames()[0] ?? partyID),
      voteshare: (grouped[0][partyID] ?? 0)-(grouped[1][partyID] ?? 0), nonElectable: partyID == "IN-NOTA"}))
    changes.sort((x, y) => compareSortMode == CompareSortMode.shiftMargin ? y.voteshare-x.voteshare : (grouped[0][y.partyID] ?? 0)-(grouped[0][x.partyID] ?? 0))
    changes.forEach((v, i) => v.order = i)
    const leaders = [a, b].map((r, i) => ({party: r.partyID ?? Object.entries(grouped[i]).filter(([id]) => id != "IN-NOTA").sort((x, y) => y[1]-x[1])[0]?.[0] ?? TossupParty.getID(), margin: r.margin ?? 0}))
    const movement = a.marginUnavailable || b.marginUnavailable ? 0 : leaders[0].margin+(leaders[0].party == leaders[1].party ? -leaders[1].margin : leaders[1].margin)
    const candidates = a.partyVotesharePercentages ?? a.indiaSharesSnapshot ?? []
    const winner = candidates.find(v => v.candidate == a.candidateName)
    const opponent = candidates.filter(v => v != winner && v.partyID != "IN-NOTA").sort((x, y) => y.voteshare-x.voteshare)[0]?.partyID
    result[id] = {region: id, name: base.name, state: base.state, boundaryYear: boundary, comparison: true,
      comparisonNote: (a.marginUnavailable || b.marginUnavailable) ? "No single-winner margin; party vote-share changes below" : undefined,
      partyID: Math.abs(movement) < 1e-9 ? TossupParty.getID() : movement < 0 ? (opponent ?? leaders[1].party) : leaders[0].party,
      candidateName: null, margin: Math.abs(movement),
      partyVotesharePercentages: a.partyVotesharePercentages && b.partyVotesharePercentages ? changes : undefined}
  }
  if (unavailable) $("#compareItem-0").append(`<span class='india-comparison-note'>${unavailable} seats unavailable across these boundaries or polls</span>`)
  return result
}

const IndiaLokSabhaMapType = new MapType(
  "India-LokSabha", "Lok Sabha", "LS", "assets/usa-house.png",
  "svg-sources/india-lok-sabha-2024-map.svg", 543, (decade, id, region) => region?.disabled || region?.comparisonUnavailable ? 0 : 1,
  false, 1, true, true, false, false, IndiaRegionNames, [], [
    {id: "zoomSeatTotals", emoji: "🧮", title: "Seat Totals", type: MapSettingType.optionCycle,
      options: [{id: "all", title: "All Seats", value: false}, {id: "selected", title: "Selected State", value: true}],
      defaultValue: "selected", reloadType: MapSettingReloadType.display}
  ],
  () => {
    const past = new MapSource(
      "Past-India-General-Elections", "Past Elections",
      {type: jsonSourceType, url: "./csv-sources/india-general-elections.json"},
      "https://www.eci.gov.in/statistical-reports",
      {regular: "./assets/usa-house.png", mini: "./assets/usa-house.png", getOverlayText: () => currentSliderDate?.getFullYear() == 1952 ? "<span style='font-size: .65em;'>1951–52</span>" : currentSliderDate?.getFullYear() ?? ""},
      {}, null, null, null, null, null, null, false, true,
      organizeIndiaGeneralElections, null,
      getIndiaStateData,
      null, {}, getIndiaFormattedRegionName,
      (homepage, id, links, date, shouldOpenHomepage, data) => !shouldOpenHomepage ? data?.[date?.getTime()]?.[id]?.link ?? homepage : homepage,
      null, null, false, false, true, 0, getIndiaLokSabhaSVG, true, true, true
    )
    const names = Object.fromEntries(Object.entries(IndiaPoliticalParties).map(([id, p]) => [id, p.getNames()[0]]))
    const custom = new MapSource(
      "Custom-India-LokSabha", "Custom", null, null, null,
      {date: "date", region: "region", candidateName: "candidate", partyID: "party", voteshare: "voteshare", candidateVotes: "votes", order: "order"},
      null, invertObject(names), names, {}, null, null, false, true, organizeIndiaCustomMap, null,
      getIndiaStateData, null, {}, getIndiaFormattedRegionName,
      () => null,
      function(display, saved) {
        for (const [id, region] of Object.entries(display))
        {
          if (id.endsWith(subregionSeparator+statePopularVoteDistrictID)) continue
          const marginChanged = !this.isCompare() && this.editingMode == EditingMode.margin && saved[id]?.partyID != null &&
            (saved[id].partyID != region.partyID || saved[id].margin != region.margin)
          saved[id] = {...saved[id], ...cloneObject(region), customScenario: !this.isCompare(),
            comparisonUnavailable: this.isCompare() ? region.comparisonUnavailable : false,
            indiaSharesSnapshot: saved[id]?.indiaSharesSnapshot ?? region.partyVotesharePercentages?.map(v => ({candidate: v.candidate, partyID: v.partyID, voteshare: v.voteshare}))}
          if (marginChanged)
          {
            saved[id].marginUnavailable = saved[id].multiMember = saved[id].uncontested = saved[id].marginException = saved[id].voteCountsUnavailable = false
            delete saved[id].majority
          }
        }
      },
      null, true, false, true, 0, getIndiaCustomSVG, true, true, true
    )
    custom.convertArrayToCSV = serializeIndiaCustomMap
    past.getZoomRegion = custom.getZoomRegion = getIndiaZoomRegion
    custom.createComparisonData = createIndiaComparisonData
    custom.setTextMapData("date\n" + getTodayString("/", false, "mdy"))
    return {mapSources: {[past.getID()]: past, [custom.getID()]: custom},
      mapSourceIDs: {[allYearsCycle]: [past.getID(), custom.getID()]}, mapCycles: [],
      defaultCompareSourceIDs: {1: [past.getID(), past.getID()]}, customSourceID: custom.getID()}
  }
)
IndiaLokSabhaMapType.startDefaultCompare = () => loadComparePreset(1)
IndiaLokSabhaMapType.enableNationalZoom = true
IndiaLokSabhaMapType.updateViewLabel = data => {
  const state = currentMapZoomRegion && Object.values(data ?? {}).find(r => r.state)?.state
  $("#mapViewLabel").text(state ? decodeIndiaElectionText(state) : "India").show()
  $("#mapCloseButton").attr("title", state ? "Back to India" : "Reset India view").attr("aria-label", state ? "Back to India" : "Reset India view")
}

