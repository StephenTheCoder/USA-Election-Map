function createMapCycleDropdownItems()
{
  const cycleToString = (cycle) => {
    if (cycle == allYearsCycle || cycle.toString().length < 4) return "'XX"
    return `'${cycle.toString().slice(2)}`
  }
  
  $("#cycleMapCycleButton").html(cycleToString(currentMapType.getCurrentMapCycle()))
  
  $("#mapCyclesDropdownContainer").html("")

  const dropdownMapCycleIDs = [...cloneObject(currentMapType.getMapCycles()), allYearsCycle]

  for (let cycleIndex in dropdownMapCycleIDs)
  {
    const cycle = dropdownMapCycleIDs[cycleIndex]
    if (currentMapType.getCurrentMapCycle() == cycle) { continue }
    
    $("#mapCyclesDropdownContainer").append("<div class='dropdown-separator'></div>")
    
    let divStringToAppend = "<a onclick='setMapCycle(\"" + cycle + "\")' style='min-width: 50rem; font-size: 25rem; padding: 0; height: 51rem; display: flex; justify-content: center; align-items: center;'>"
    divStringToAppend += `<span>${cycleToString(cycle)}</span>`
    divStringToAppend += "</a>"
    
    $("#mapCyclesDropdownContainer").append(divStringToAppend)
  }
}

function cycleMapCycle()
{
  const cycles = currentMapType.getMapCycles()
  
  let newMapCycleIndex = cycles.indexOf(currentMapType.getCurrentMapCycle())+1
  if (newMapCycleIndex >= cycles.length || newMapCycleIndex < 0)
  {
    newMapCycleIndex = 0
  }

  setMapCycle(cycles[newMapCycleIndex])
}
