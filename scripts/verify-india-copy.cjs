const{chromium}=require('../.tools/node_modules/playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const elections=JSON.parse(fs.readFileSync('csv-sources/india-general-elections.json','utf8')).elections;
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const context=await b.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack)});
 await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>typeof currentSliderDate!=='undefined'&&currentSliderDate&&!isRunningDisplayMapQueue&&loaderStack[0]===LoaderType.hidden);await p.locator('#cycleMapCountryButton').hover();await p.locator('[aria-label="Switch to India"]').click();await p.waitForFunction(()=>currentMapCountry.getID()==='India'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 let exported;
 for(const mode of [0,1])for(let i=0;i<elections.length;i++){
  await p.evaluate(async i=>{await setMapSource(mapSources['Past-India-General-Elections'],true);await displayDataMap(i+1)},i);
  const snapshot=await p.evaluate(()=>Object.fromEntries(Object.entries(currentMapSource.getMapData()[currentSliderDate.getTime()]).map(([id,r])=>[id,{party:r.partyID,margin:r.margin,votes:r.partyVotesharePercentages}])));
  await p.locator('#editDoneButton').hover();await p.locator(mode===0?'#editMarginButton':'#editVoteshareButton').click();await p.waitForFunction(()=>currentMapSource.isCustom()&&!currentMapSource.isCompare()&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]&&loaderStack[0]===LoaderType.hidden);
  const copied=await p.evaluate(()=>({data:currentMapSource.getMapData()[currentSliderDate.getTime()],svg:currentMapType.getSVGPath(),mode:currentMapSource.getEditingMode(),outlines:document.querySelector('#outlines').children.length,uuid:currentMapSource.getMapUUID()}));assert.equal(copied.mode,mode);assert.equal(Object.keys(copied.data).length,Object.keys(snapshot).length);
  const year=elections[i].year;const boundary=elections[i].boundaryYear;
  assert.equal(copied.svg,`svg-sources/india-lok-sabha-${boundary}-map.svg`);assert.equal(copied.outlines,Object.keys(snapshot).length-1);assert.match(copied.uuid,/^[0-9a-f-]{36}$/);
  for(const[id,r]of Object.entries(snapshot)){assert.equal(copied.data[id].partyID,r.party);assert.equal(copied.data[id].margin,r.margin);if(mode===1){assert.equal(copied.data[id].partyVotesharePercentages.length,r.votes.length);for(let j=0;j<r.votes.length;j++)assert.ok(Math.abs(copied.data[id].partyVotesharePercentages[j].voteshare-r.votes[j].voteshare)<1e-7)}}
  await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden);
  exported=await p.evaluate(()=>getMapFileDataString(currentMapSource.getTextMapData(),kJSONFileType,currentMapSource.getDropdownPartyIDs()));
  await p.evaluate(async text=>{jsonFileLoaded({target:{result:text}});await new Promise(resolve=>setTimeout(resolve,100))},exported);await p.waitForFunction(()=>loaderStack[0]===LoaderType.hidden);
  const restored=await p.evaluate(()=>({data:currentMapSource.getMapData()[currentSliderDate.getTime()],svg:currentMapType.getSVGPath()}));
  assert.equal(restored.svg,copied.svg);for(const[id,r]of Object.entries(snapshot)){assert.equal(restored.data[id].partyID,r.party);assert.equal(restored.data[id].margin,r.margin);for(const key of ['candidateName','boundaryYear','disabled','multiMember','uncontested','marginUnavailable','sourceNote'])assert.equal(restored.data[id][key],copied.data[id][key],key);if(mode===1){const a=restored.data[id].partyVotesharePercentages,c=copied.data[id].partyVotesharePercentages;assert.equal(a.length,c.length);for(let k=0;k<a.length;k++){for(const key of ['candidate','partyID','votes','nonElectable'])assert.equal(a[k][key],c[k][key]);assert.ok(Math.abs(a[k].voteshare-c[k].voteshare)<1e-7)}}}
  console.log('PASS copy/save/JSON',mode?'voteshare':'margin',year);
 }
 const cold=await context.newPage();cold.on('pageerror',e=>errors.push(e.stack));await cold.goto('http://127.0.0.1:8765');await cold.waitForFunction(()=>currentMapCountry?.getID()==='India'&&currentMapSource?.isCustom()&&loaderStack[0]===LoaderType.hidden);
 await cold.evaluate(async text=>{currentCustomMapSource.setTextMapData(JSON.parse(text).mapData);await setMapSource(currentCustomMapSource,true)},exported);
 assert.equal(await cold.evaluate(()=>currentMapSource.getEditingMode()),1);assert.equal(await cold.evaluate(()=>Object.keys(currentMapSource.getMapData()[currentSliderDate.getTime()]).length),544);
 await cold.close();
 assert.deepEqual(errors,[]);console.log('PASS fresh-context CSV restores vote mode, candidates, parties and boundaries');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
