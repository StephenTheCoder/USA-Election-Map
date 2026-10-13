function createMapCountryDropdownItems()
{
  $("#mapCountryDropdownContainer").html("")

  let dropdownMapCountryIDs = cloneObject(mapCountryIDs)

  for (let country of dropdownMapCountryIDs)
  {
	if (currentMapCountry.getID() == country) { continue }

	$("#mapCountryDropdownContainer").append("<div class='dropdown-separator'></div>")

	let mapCountry = mapCountries[country]

	let divStringToAppend = "<a onclick='setMapCountry(\"" + country + "\")' title='" + mapCountry.getName() + "' aria-label='Switch to " + mapCountry.getName() + "' style='display: flex; padding: 0; margin-top: 0;'>"
	divStringToAppend += "<img src='" + mapCountry.getIconURL() + "' alt='" + mapCountry.getName() + "' style='width: 43px; height: 43px; padding: 3px;'/>"
	divStringToAppend += "</a>"

	$("#mapCountryDropdownContainer").append(divStringToAppend)
  }
}

function cycleMapCountry(buttonDiv)
{
  let newMapCountryIndex = mapCountryIDs.indexOf(currentMapCountry.getID())+1
  if (newMapCountryIndex >= mapCountryIDs.length || newMapCountryIndex < 0)
  {
	newMapCountryIndex = 0
  }

  setMapCountry(mapCountryIDs[newMapCountryIndex], buttonDiv)
}

async function setMapCountry(newMapCountryID, buttonDiv, loadMapType)
{
  currentMapCountry = mapCountries[newMapCountryID]
  setCookie("currentMapCountry", currentMapCountry.getID())

  $(buttonDiv || "#cycleMapCountryButton").find("img").attr('src', currentMapCountry.getIconURL())
  $(buttonDiv || "#cycleMapCountryButton").attr('title', currentMapCountry.getName()).attr('aria-label', 'Current country: ' + currentMapCountry.getName())
  $(buttonDiv || "#cycleMapCountryButton").find("img").attr('alt', currentMapCountry.getName())

  await reloadForNewMapCountry(false, loadMapType)
}
