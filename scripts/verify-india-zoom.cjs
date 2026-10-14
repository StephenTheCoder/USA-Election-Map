const {chromium}=require('../.tools/node_modules/playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const elections=JSON.parse(fs.readFileSync('csv-sources/india-general-elections.json','utf8')).elections;
async function point(p,id){return p.locator(`[id="${id}"]`).evaluate(async el=>{
 // Wait for the view's transform to settle, then click an interior pixel.
 let previous='',stable=0;while(stable<8){await new Promise(requestAnimationFrame);const r=el.getBoundingClientRect();const next=[r.x,r.y,r.width,r.height].join(',');stable=next===previous?stable+1:0;previous=next}
 const r=el.getBoundingClientRect(),points=[];for(let y=Math.ceil(r.top);y<r.bottom;y++)for(let x=Math.ceil(r.left);x<r.right;x++)points.push({x,y});points.sort((a,b)=>(a.x-r.x-r.width/2)**2+(a.y-r.y-r.height/2)**2-((b.x-r.x-r.width/2)**2+(b.y-r.y-r.height/2)**2));
 for(const pt of points)if(document.elementFromPoint(pt.x,pt.y)===el)return pt;throw Error('No visible constituency point')
})}
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const c=await b.newContext({viewport:{width:1440,height:1000}});const p=await c.newPage();const errors=[];p.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack)});
 await c.addCookies([{name:'currentMapCountry',value:'India',url:'http://127.0.0.1:8765'}]);await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>typeof currentSliderDate!=='undefined'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 const before=await p.evaluate(()=>JSON.stringify(currentMapSource.getMapData()));
 await p.locator('#mapZoomInButton').click();assert.ok(await p.evaluate(()=>svgPanZoomController.getZoom()>1));
 await p.locator('#mapResetZoomButton').click();assert.ok(Math.abs(await p.evaluate(()=>svgPanZoomController.getZoom())-1)<1e-6);
 let pt=await point(p,elections.at(-1).regions.find(r=>r.name==='Varanasi').id);await p.mouse.move(pt.x,pt.y);await p.mouse.wheel(0,-500);await p.waitForFunction(()=>svgPanZoomController.getZoom()>1);await p.locator('#mapResetZoomButton').click();
 // Panning the national map must not trigger a constituency click.
 pt=await point(p,elections.at(-1).regions.find(r=>r.name==='Varanasi').id);await p.mouse.move(pt.x,pt.y);await p.mouse.down();await p.mouse.move(pt.x+40,pt.y+40,{steps:5});await p.mouse.up();
 assert.equal(await p.evaluate(()=>currentViewingState),0);await p.locator('#mapResetZoomButton').click();
 pt=await point(p,elections.at(-1).regions.find(r=>r.name==='Varanasi').id);await p.mouse.click(pt.x,pt.y);await p.waitForFunction(()=>currentViewingState===ViewingState.zooming&&currentMapZoomRegion==='UTTARPRADESH'&&document.querySelector('#outlines').children.length===80&&svgPanZoomController);
 assert.equal(await p.locator('#mapViewLabel').textContent(),'Uttar Pradesh');await p.locator('#mapZoomInButton').click();assert.ok(await p.evaluate(()=>svgPanZoomController.getZoom()>1));await p.screenshot({path:'.tools/india-up-state.png'});
 await p.locator('#mapCloseButton').click();await p.waitForFunction(()=>currentViewingState===ViewingState.viewing&&document.querySelector('#outlines').children.length===543);
 console.log('PASS national buttons/wheel/pan, physical constituency click, complete state, state zoom and back');
 // Render every state of every election, including the early seat tiles.
 for(let i=0;i<elections.length;i++){
  const e=elections[i];await p.evaluate(async i=>{await zoomOutMap(false);$('#dataMapDateSlider').val(i+1);await displayDataMap(i+1)},i);
  const groups=Object.groupBy(e.regions,r=>r.state);
  for(const [state,rows]of Object.entries(groups)){
   const r=await p.evaluate(async id=>{const data=currentMapSource.getMapData()[currentSliderDate.getTime()];currentMapZoomRegion=currentMapSource.getZoomRegion(id,data);currentViewingState=ViewingState.zooming;await displayDataMap();return{ids:[...document.querySelector('#outlines').children].map(el=>el.id).sort(),data:Object.keys(displayRegionDataArray).filter(id=>!id.endsWith('__PV')).sort(),total:Object.values(getPartyTotals(false)).reduce((a,b)=>a+b,0),popular:getPopularVotePartyVoteshareData(),finite:Object.values(displayRegionDataArray).every(r=>Number.isFinite(r.margin)),box:document.querySelector('#svgdata').getAttribute('data-viewBox')}},rows[0].id);
   assert.deepEqual(r.ids,rows.map(r=>r.id).sort(),`${e.year} ${state} geometry`);assert.deepEqual(r.data,r.ids,`${e.year} ${state} data`);assert.equal(r.total,rows.filter(r=>!r.disabled).length);assert.equal(r.finite,true);assert.ok(r.box.split(' ').map(Number).every(Number.isFinite));
   const votes=rows.filter(r=>!r.disabled&&r.seatNumber===1).reduce((s,r)=>s+r.totalVotes,0);
   if(votes>0){assert.equal(r.popular.reduce((s,v)=>s+v.votes,0),votes,`${e.year} ${state} ballots counted once`)}
  }
  await p.evaluate(()=>zoomOutMap());await p.waitForFunction(n=>document.querySelector('#outlines').children.length===n&&currentViewingState===ViewingState.viewing,e.regions.length);
  console.log('PASS',e.year,Object.keys(groups).length,'complete state views, seat totals, vote sums, finite bounds and return');
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(mapSources['Past-India-General-Elections'].getMapData())),before);
 // State choice follows dates, and disappears safely when the historical state ends.
 await p.evaluate(async()=>{$('#dataMapDateSlider').val(1);await displayDataMap(1);const d=currentMapSource.getMapData()[currentSliderDate.getTime()];currentMapZoomRegion='AJMER';currentViewingState=ViewingState.zooming;await displayDataMap();$('#dataMapDateSlider').val(2);await displayDataMap(2)});
 assert.equal(await p.evaluate(()=>currentViewingState),0);assert.equal(await p.locator('#mapViewLabel').textContent(),'India');
 await p.evaluate(async()=>{$('#dataMapDateSlider').val(15);await displayDataMap(15);currentMapZoomRegion='ANDHRAPRADESH';currentViewingState=ViewingState.zooming;await displayDataMap()});assert.equal(await p.locator('#outlines > path').count(),42);
 await p.evaluate(async()=>{$('#dataMapDateSlider').val(18);await displayDataMap(18)});assert.equal(await p.locator('#outlines > path').count(),25);
 await p.evaluate(()=>zoomOutMap());await p.waitForFunction(()=>document.querySelector('#outlines').children.length===543);
 // Save an edit while zoomed; other states and the national popular votes survive.
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentMapSource.isCustom()&&loaderStack[0]===LoaderType.hidden);await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden&&svgPanZoomController?.isPanEnabled());
 const initial=await p.evaluate(()=>JSON.stringify(currentMapSource.getMapData()[currentSliderDate.getTime()].NPV));
 pt=await point(p,elections.at(-1).regions.find(r=>r.name==='Varanasi').id);await p.mouse.click(pt.x,pt.y);try{await p.waitForFunction(()=>currentMapZoomRegion==='UTTARPRADESH'&&svgPanZoomController&&document.querySelector('#outlines').children.length===80)}catch(e){console.error('STATE CLICK DIAGNOSTIC',await p.evaluate(pt=>({pt,hit:document.elementFromPoint(pt.x,pt.y)?.id,source:currentMapSource.getID(),view:currentViewingState,editing:currentEditingState,zoomRegion:currentMapZoomRegion,hover:currentRegionID,panned:pannedDuringClick,loader:loaderStack,paths:document.querySelector('#outlines').children.length}),pt));await p.screenshot({path:'.tools/india-state-click-failure.png'});throw e}
 await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.editing);await p.locator('#IN-INC').click();pt=await point(p,elections.at(-1).regions.find(r=>r.name==='Varanasi').id);await p.mouse.click(pt.x,pt.y);await p.locator('#editDoneButton').click();await p.waitForFunction(()=>currentEditingState===EditingState.viewing&&loaderStack[0]===LoaderType.hidden);
 const saved=await p.evaluate(()=>({data:currentMapSource.getMapData()[currentSliderDate.getTime()],npv:JSON.stringify(currentMapSource.getMapData()[currentSliderDate.getTime()].NPV)}));assert.equal(Object.keys(saved.data).length,544);assert.equal(saved.npv,initial);assert.equal(saved.data['IN2008-S24-77'].partyID,'IN-INC');assert.ok(!Object.keys(saved.data).some(id=>id.endsWith('__PV')));
 // Download the whole saved country while a state is selected, in both formats.
 for(const type of ['json','csv']){
  const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(type=>downloadMapFile(currentMapSource,type==='json'?kJSONFileType:kCSVFileType),type)]);
  await dl.saveAs(`.tools/india-state-export.${type}`);
 }
 await p.locator('#mapCloseButton').click();await p.waitForFunction(()=>document.querySelector('#outlines').children.length===543);
 for(const type of ['json','csv']){
  await p.evaluate(()=>setMapSource(mapSources['Past-India-General-Elections'],true));await p.locator('#uploadFileInput').setInputFiles(`.tools/india-state-export.${type}`);
  await p.waitForFunction(()=>currentMapSource.isCustom()&&loaderStack[0]===LoaderType.hidden&&document.querySelector('#outlines').children.length===543);
  const restored=await p.evaluate(()=>({data:currentMapSource.getMapData()[currentSliderDate.getTime()],npv:JSON.stringify(currentMapSource.getMapData()[currentSliderDate.getTime()].NPV)}));
  assert.equal(Object.keys(restored.data).length,544);assert.equal(restored.data['IN2008-S24-77'].partyID,'IN-INC');assert.equal(restored.npv,initial);assert.ok(!Object.keys(restored.data).some(id=>id.endsWith('__PV')));
 }
 console.log('PASS historical state changes, zoomed edits and actual JSON/CSV transfers preserve all country records');
 // Comparison state views must not overwrite the user's saved custom scenario.
 const customBefore=await p.evaluate(()=>currentCustomMapSource.getTextMapData());
 await p.evaluate(()=>setMapSource(mapSources['Past-India-General-Elections'],true));await p.locator('#compareButton').click();
 await p.waitForFunction(()=>currentMapSource.isCompare()&&loaderStack[0]===LoaderType.hidden&&document.querySelector('#secondCompareDataMapDateSlider').value==='17'&&svgPanZoomController);
 const comparedBefore=await p.evaluate(()=>JSON.parse(JSON.stringify(currentMapSource.getMapData())));
 pt=await point(p,elections.at(-1).regions.find(r=>r.name==='Varanasi').id);await p.mouse.click(pt.x,pt.y);await p.waitForFunction(()=>currentMapZoomRegion==='UTTARPRADESH'&&document.querySelector('#outlines').children.length===80&&svgPanZoomController);
 assert.equal(await p.evaluate(()=>Object.values(getPartyTotals(false)).reduce((a,b)=>a+b,0)),80);assert.equal(await p.evaluate(()=>getPopularVotePartyVoteshareData()),undefined);
 await p.locator('#mapCloseButton').click();await p.waitForFunction(()=>currentViewingState===ViewingState.viewing&&document.querySelector('#outlines').children.length===543&&svgPanZoomController);
 await p.evaluate(async id=>{currentMapZoomRegion=currentMapSource.getZoomRegion(id,currentMapSource.getMapData()[currentSliderDate.getTime()]);currentViewingState=ViewingState.zooming;await displayDataMap()},elections.at(-1).regions.find(r=>r.state==='Assam').id);
 assert.equal(await p.locator('#outlines > path').count(),14);assert.equal(await p.evaluate(()=>Object.values(getPartyTotals(false)).reduce((a,b)=>a+b,0)),0);
 await p.locator('#mapCloseButton').click();await p.waitForFunction(()=>currentViewingState===ViewingState.viewing&&document.querySelector('#outlines').children.length===543&&svgPanZoomController);
 assert.equal(await p.evaluate(()=>currentMapSource.isCompare()),true);const comparedAfter=await p.evaluate(()=>JSON.parse(JSON.stringify(currentMapSource.getMapData())));
 assert.deepEqual(comparedAfter,comparedBefore);assert.equal(await p.evaluate(()=>currentCustomMapSource.getTextMapData()),customBefore);
 console.log('PASS physical comparison state click, unavailable Assam boundaries, back, and unchanged saved custom maps');
 // Cold partial CSVs still expose every district of the state's complete SVG.
 const cold=await b.newPage({viewport:{width:390,height:844}});cold.on('pageerror',e=>errors.push(e.stack));await cold.context().addCookies([{name:'currentMapCountry',value:'India',url:'http://127.0.0.1:8765'},{name:'India-LokSabha-currentMapSource',value:'Custom-India-LokSabha',url:'http://127.0.0.1:8765'}]);await cold.goto('http://127.0.0.1:8765');await cold.waitForFunction(()=>typeof currentMapSource!=='undefined'&&currentSliderDate&&!isRunningDisplayMapQueue);
 await cold.evaluate(async()=>{currentCustomMapSource.setTextMapData('date,region,name,boundary,candidate,party,voteshare\n6/4/2024,IN2008-S24-77,Varanasi,2024,Alice,IN-INC,0.6');await setMapSource(currentCustomMapSource,true)});
 await cold.evaluate(async()=>{const d=currentMapSource.getMapData()[currentSliderDate.getTime()];currentMapZoomRegion=currentMapSource.getZoomRegion('IN2008-S24-77',d);currentViewingState=ViewingState.zooming;await displayDataMap()});assert.equal(await cold.locator('#outlines > path').count(),80);assert.equal(await cold.locator('#mapViewLabel').textContent(),'Uttar Pradesh');assert.equal(await cold.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await cold.screenshot({path:'.tools/india-state-mobile.png',fullPage:true});
 await cold.locator('#mapZoomInButton').click();assert.ok(await cold.evaluate(()=>svgPanZoomController.getZoom()>1));await cold.locator('#mapResetZoomButton').click();assert.ok(Math.abs(await cold.evaluate(()=>svgPanZoomController.getZoom())-1)<1e-6);await cold.locator('#mapCloseButton').click();await cold.waitForFunction(()=>currentViewingState===ViewingState.viewing&&document.querySelector('#outlines').children.length===543);
 assert.deepEqual(errors,[]);console.log('PASS cold partial CSV state membership, mobile state zoom/reset/back and no runtime errors');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
