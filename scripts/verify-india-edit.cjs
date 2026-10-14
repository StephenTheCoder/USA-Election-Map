const{chromium}=require('../.tools/node_modules/playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const data=JSON.parse(fs.readFileSync('csv-sources/india-general-elections.json','utf8'));const sample=data.elections.at(-1).regions.find(r=>r.name==='Varanasi');
async function point(p,id){return p.locator(`[id="${id}"]`).evaluate(async el=>{
 let previous='',stable=0;while(stable<8){await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect();const next=[r.x,r.y,r.width,r.height].join(',');stable=next===previous?stable+1:0;previous=next}
 const r=el.getBoundingClientRect(),points=[];for(let y=Math.ceil(r.top);y<r.bottom;y++)for(let x=Math.ceil(r.left);x<r.right;x++)points.push({x,y});points.sort((a,b)=>(a.x-r.x-r.width/2)**2+(a.y-r.y-r.height/2)**2-((b.x-r.x-r.width/2)**2+(b.y-r.y-r.height/2)**2));
 for(const pt of points)if(document.elementFromPoint(pt.x,pt.y)===el)return pt;throw Error('No hit point')
})}
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const context=await b.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();const errors=[];p.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack)});
 await context.addCookies([{name:'currentMapCountry',value:'India',url:'http://127.0.0.1:8765'}]);await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>typeof currentSliderDate!=='undefined'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 const original=await p.evaluate(()=>JSON.stringify(mapSources['Past-India-General-Elections'].getMapData()));
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentMapSource.isCustom()&&loaderStack[0]===LoaderType.hidden);
 await p.locator('#IN-INC').click();let pt=await point(p,sample.id);await p.mouse.click(pt.x,pt.y);
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden);
 const changed=await p.evaluate(id=>({totals:getPartyTotals(false),r:currentMapSource.getMapData()[currentSliderDate.getTime()][id]}),sample.id);
 assert.equal(changed.r.partyID,'IN-INC');assert.equal(changed.r.margin,15);assert.equal(changed.totals['IN-INC'],100);assert.equal(changed.totals['IN-BJP'],239);
 const dl=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>downloadMapFile(currentMapSource,kJSONFileType))]);await dl[0].saveAs('.tools/india-edited-test.json');
 await p.evaluate(()=>setMapSource(mapSources['Past-India-General-Elections'],true));await p.locator('#uploadFileInput').setInputFiles('.tools/india-edited-test.json');
 await p.waitForFunction(id=>currentMapSource.isCustom()&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]?.[id]?.partyID==='IN-INC'&&loaderStack[0]===LoaderType.hidden,sample.id);
 console.log('PASS physical margin edit, winner, MP totals, real JSON download and upload');
 await p.evaluate(()=>setMapSource(mapSources['Past-India-General-Elections'],true));await p.locator('#editDoneButton').hover();await p.locator('#editVoteshareButton').click();await p.waitForFunction(()=>currentMapSource.getEditingMode()===EditingMode.voteshare&&loaderStack[0]===LoaderType.hidden);
 pt=await point(p,sample.id);await p.mouse.click(pt.x,pt.y);await p.waitForFunction(()=>editingRegionVotesharePercentages&&document.querySelector('#regionbox input'));
 const cells=await p.evaluate(id=>displayRegionDataArray[id].partyVotesharePercentages.map(v=>({candidate:v.candidate,party:v.partyID,share:v.voteshare,input:getRegionVoteshareInputID(v.candidate)})),sample.id);
 const target=cells.find(v=>v.party==='IN-INC');const nota=cells.find(v=>v.party==='IN-NOTA');assert.ok(target&&nota);
 for(const v of cells)await p.locator(`[id="${v.input}"]`).fill(String(v===target?60:40*v.share/(100-target.share)));
 await p.locator(`[id="${nota.input}"]`).fill('70');assert.equal(await p.evaluate(id=>displayRegionDataArray[id].partyID,sample.id),'IN-INC','NOTA cannot elect an MP');
 await p.locator(`[id="${nota.input}"]`).fill(String(40*nota.share/(100-target.share)));
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden);
 const r=await p.evaluate(id=>currentMapSource.getMapData()[currentSliderDate.getTime()][id],sample.id);
 assert.equal(r.partyID,'IN-INC');assert.equal(r.candidateName,target.candidate);assert.equal(r.totalVotes,undefined);assert.equal(r.majority,undefined);assert.ok(r.partyVotesharePercentages.every(v=>v.votes==null));assert.ok(Math.abs(r.partyVotesharePercentages.reduce((s,v)=>s+v.voteshare,0)-100)<1e-7);
 console.log('PASS real vote-share edits, correct candidate label, NOTA exclusion and removal of stale counts');
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.editing);
 const before=await p.evaluate(id=>displayRegionDataArray[id].partyVotesharePercentages.find(v=>v.partyID==='IN-BJP').voteshare,sample.id);
 await p.evaluate(()=>addConstantMarginToMap(2,politicalParties['IN-BJP'],politicalParties['IN-INC']));
 const after=await p.evaluate(id=>displayRegionDataArray[id].partyVotesharePercentages.find(v=>v.partyID==='IN-BJP').voteshare,sample.id);assert.ok(Math.abs(after-before-1)<1e-7);
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing);
 console.log('PASS uniform shift');
 // A real edit to an unopposed historical seat becomes an ordinary scenario.
 await p.evaluate(()=>setMapSource(mapSources['Past-India-General-Elections'],true));await p.locator('#editDoneButton').hover();await p.locator('#editMarginButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.editing&&currentMapSource.getEditingMode()===EditingMode.margin&&loaderStack[0]===LoaderType.hidden&&!isRunningDisplayMapQueue);
 const surat=data.elections.at(-1).regions.find(r=>r.name==='Surat');if(await p.evaluate(()=>selectedParty?.getID())!=='IN-INC')await p.locator('#IN-INC').click();pt=await point(p,surat.id);await p.mouse.click(pt.x,pt.y);await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing);
 const sr=await p.evaluate(id=>currentMapSource.getMapData()[currentSliderDate.getTime()][id],surat.id);assert.equal(sr.partyID,'IN-INC');assert.equal(sr.marginUnavailable,false);assert.equal(sr.uncontested,false);
 // Use the actual Other menu for a copied, single-date map compared with itself.
 await p.locator('#compareButton').hover();await p.locator('#comparePresetsDropdownContainer a').filter({hasText:'Other'}).click();
 for(const i of [0,1]){await p.locator(`#compareCustomItem-${i}`).click();await p.locator('#compareCustomListDropdownContainer [id="Custom-India-LokSabha"]').click()}
 await p.locator('#applyCustomCompareButton').click();await p.waitForFunction(()=>currentMapSource.isCompare()&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]&&loaderStack[0]===LoaderType.hidden);
 assert.equal(await p.evaluate(()=>Object.values(currentMapSource.getMapData()[currentSliderDate.getTime()]).filter(r=>r.margin>0).length),0);
 await p.evaluate(async id=>{
  await setMapSource(currentCustomMapSource,true);await toggleEditing(EditingState.editing);
  displayRegionDataArray[id].partyID='IN-INC';displayRegionDataArray[id].margin=15;await toggleEditing(EditingState.viewing);
  compareMapSourceIDArray=['Custom-India-LokSabha','Past-India-General-Elections'];showingCompareMap=true;
  await updateCompareMapSources([true,true],false,false,[1,18]);
 },sample.id);
 const mixed=await p.evaluate(id=>currentMapSource.getMapData()[currentSliderDate.getTime()][id],sample.id);
 assert.equal(mixed.partyID,'IN-INC');assert.ok(Math.abs(mixed.margin-(15+sample.majority/sample.totalVotes*100))<1e-7);
 // Copied pre-delimitation scenarios keep their edits across later comparisons.
 const old=data.elections.find(e=>e.year===2004).regions.find(r=>r.name==='Mumbai North');
 await p.evaluate(async id=>{
  await setMapSource(mapSources['Past-India-General-Elections'],true);await displayDataMap(14);currentEditingMode=EditingMode.margin;
  await toggleEditing(EditingState.editing);displayRegionDataArray[id].partyID='IN-INC';displayRegionDataArray[id].margin=20;await toggleEditing(EditingState.viewing);
  compareMapSourceIDArray=['Custom-India-LokSabha','Past-India-General-Elections'];showingCompareMap=true;
  await updateCompareMapSources([true,true],false,false,[1,18]);
 },old.id);
 const cross=await p.evaluate(id=>({retained:currentCustomMapSource.getMapData()[currentCustomMapSource.getMapDates()[0]][id],unavailable:Object.values(currentMapSource.getMapData()[currentSliderDate.getTime()]).filter(r=>r.comparisonUnavailable).length}),old.id);
 assert.equal(cross.retained.partyID,'IN-INC');assert.equal(cross.retained.margin,20);assert.equal(cross.unavailable,543);
 // Zero-count historical entries become ordinary percentage scenarios after editing.
 await p.evaluate(async()=>{await setMapSource(mapSources['Past-India-General-Elections'],true);await displayDataMap(2);currentEditingMode=EditingMode.voteshare;await toggleEditing(EditingState.editing)});
 const zero=data.elections[1].regions.find(r=>r.name==='Rajampet');pt=await point(p,zero.id);await p.mouse.click(pt.x,pt.y);await p.waitForFunction(()=>editingRegionVotesharePercentages&&document.querySelector('#regionbox input'));
 const inputs=await p.evaluate(id=>displayRegionDataArray[id].partyVotesharePercentages.map(v=>({party:v.partyID,input:getRegionVoteshareInputID(v.candidate)})),zero.id);
 for(const v of inputs)await p.locator(`[id="${v.input}"]`).fill(v.party==='IN-INC'?'60':'40');
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden);
 const zr=await p.evaluate(id=>currentMapSource.getMapData()[currentSliderDate.getTime()][id],zero.id);assert.equal(zr.voteCountsUnavailable,false);assert.equal(zr.marginUnavailable,false);assert.equal(zr.margin,20);assert.equal(zr.totalVotes,undefined);
 const csv=`date,region,name,boundary,candidate,party,voteshare\n6/4/2024,${sample.id},Varanasi,2024,NOTA,IN-NOTA,0.8\n6/4/2024,${sample.id},Varanasi,2024,Alice,IN-INC,0.12\n6/4/2024,${sample.id},Varanasi,2024,Bob,IN-BJP,0.08\n`;
 fs.writeFileSync('.tools/india-nota-import.csv',csv);await p.locator('#uploadFileInput').setInputFiles('.tools/india-nota-import.csv');
 await p.waitForFunction(id=>currentSliderDate?.getFullYear()===2024&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]?.[id]?.candidateName==='Alice'&&loaderStack[0]===LoaderType.hidden,sample.id);
 const imported=await p.evaluate(id=>currentMapSource.getMapData()[currentSliderDate.getTime()][id],sample.id);assert.equal(imported.partyID,'IN-INC');assert.ok(Math.abs(imported.margin-4)<1e-7);assert.equal(imported.partyVotesharePercentages[0].nonElectable,true);
 console.log('PASS plain CSV upload excludes NOTA even without a nonElectable column');
 assert.equal(await p.evaluate(()=>JSON.stringify(mapSources['Past-India-General-Elections'].getMapData())),original);assert.deepEqual(errors,[]);
 console.log('PASS unopposed-seat edit, Other-menu custom comparison, mixed numeric comparison, retained boundary-era edits, and immutable historical maps');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
