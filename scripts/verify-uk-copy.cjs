const{chromium}=require('../.tools/node_modules/playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const context=await b.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>typeof currentMapType!=='undefined'&&currentMapType&&document.querySelector('#outlines'));await p.locator('#cycleMapCountryButton').click();await p.waitForFunction(()=>currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 let exported;
 for(const mode of [0,1])for(let i=0;i<8;i++){
  await p.evaluate(async i=>{await setMapSource(mapSources['Past-UK-General-Elections'],true);await displayDataMap(i+1)},i);
  const snapshot=await p.evaluate(()=>Object.fromEntries(Object.entries(currentMapSource.getMapData()[currentSliderDate.getTime()]).map(([id,r])=>[id,{party:r.partyID,margin:r.margin,votes:r.partyVotesharePercentages}])));
  await p.locator('#editDoneButton').hover();await p.locator(mode===0?'#editMarginButton':'#editVoteshareButton').click();await p.waitForFunction(()=>currentMapSource.isCustom()&&!currentMapSource.isCompare()&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]&&loaderStack[0]===LoaderType.hidden);
  const copied=await p.evaluate(()=>({data:currentMapSource.getMapData()[currentSliderDate.getTime()],svg:currentMapType.getSVGPath(),mode:currentMapSource.getEditingMode(),outlines:document.querySelector('#outlines').children.length,uuid:currentMapSource.getMapUUID()}));assert.equal(copied.mode,mode);assert.equal(Object.keys(copied.data).length,Object.keys(snapshot).length);
  const year=[1997,2001,2005,2010,2015,2017,2019,2024][i];const boundary=year>=2024?2024:year>=2010?2010:year>=2005?2005:1997;
  assert.equal(copied.svg,`svg-sources/uk-commons-${boundary}-map.svg`);assert.equal(copied.outlines,Object.keys(snapshot).length-1);assert.match(copied.uuid,/^[0-9a-f-]{36}$/);
  for(const[id,r]of Object.entries(snapshot)){assert.equal(copied.data[id].partyID,r.party);assert.equal(copied.data[id].margin,r.margin);if(mode===1){assert.equal(copied.data[id].partyVotesharePercentages.length,r.votes.length);for(let j=0;j<r.votes.length;j++)assert.ok(Math.abs(copied.data[id].partyVotesharePercentages[j].voteshare-r.votes[j].voteshare)<1e-7)}}
  await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden);
  exported=await p.evaluate(()=>getMapFileDataString(currentMapSource.getTextMapData(),kJSONFileType,currentMapSource.getDropdownPartyIDs()));
  await p.evaluate(async text=>{jsonFileLoaded({target:{result:text}});await new Promise(resolve=>setTimeout(resolve,100))},exported);await p.waitForFunction(()=>loaderStack[0]===LoaderType.hidden);
  const restored=await p.evaluate(()=>({data:currentMapSource.getMapData()[currentSliderDate.getTime()],svg:currentMapType.getSVGPath()}));
  assert.equal(restored.svg,copied.svg);for(const[id,r]of Object.entries(snapshot)){assert.equal(restored.data[id].partyID,r.party);assert.equal(restored.data[id].margin,r.margin)}
  console.log('PASS copy/save/JSON',mode?'voteshare':'margin',year);
 }
 const cold=await context.newPage();cold.on('pageerror',e=>errors.push(e.stack));await cold.goto('http://127.0.0.1:8765');await cold.waitForFunction(()=>currentMapCountry?.getID()==='UK'&&currentMapSource?.isCustom()&&loaderStack[0]===LoaderType.hidden);
 await cold.evaluate(async text=>{currentCustomMapSource.setTextMapData(JSON.parse(text).mapData);await setMapSource(currentCustomMapSource,true)},exported);
 assert.equal(await cold.evaluate(()=>currentMapSource.getEditingMode()),1);assert.equal(await cold.evaluate(()=>Object.keys(currentMapSource.getMapData()[currentSliderDate.getTime()]).length),651);
 await cold.close();
 assert.deepEqual(errors,[]);console.log('PASS fresh-context CSV restores vote mode, candidates, parties and boundaries');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
