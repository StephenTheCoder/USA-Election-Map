const{chromium}=require('../.tools/node_modules/playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>typeof currentMapType!=='undefined'&&currentMapType&&document.querySelector('#outlines'));await p.locator('#cycleMapCountryButton').click();await p.waitForFunction(()=>currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 const before=await p.evaluate(()=>JSON.stringify(mapSources['Past-UK-General-Elections'].getMapData()));await p.locator('#compareButton').click();await p.waitForFunction(()=>currentMapSource.isCompare()&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]&&loaderStack[0]===LoaderType.hidden&&document.querySelector('#secondCompareDataMapDateSlider').value==='7');
 for(let i=1;i<=8;i++)for(let j=1;j<=8;j++){
  const r=await p.evaluate(async([i,j])=>{
   $('#firstCompareDataMapDateSlider').val(i);$('#secondCompareDataMapDateSlider').val(j);await setCompareSourceDate(0,i,false);await setCompareSourceDate(1,j,true);
   const m=currentMapSource.getMapData()[currentSliderDate.getTime()];return{outlines:document.querySelector('#outlines').children.length,count:Object.keys(m).length,unavailable:Object.values(m).filter(v=>v.comparisonUnavailable).length,nonzero:Object.values(m).filter(v=>!v.disabled&&v.margin>1e-7).length,nans:Object.values(m).filter(v=>!Number.isFinite(v.margin)).length,notes:[...document.querySelectorAll('.uk-comparison-note')].map(e=>e.textContent),boundary:Object.values(m)[0].boundaryYear,shares:m.NPV?.partyVotesharePercentages,totals:Object.values(getPartyTotals(false)).reduce((a,b)=>a+b,0)}
  },[i,j]);
  assert.equal(r.count,r.outlines+1,`${i}/${j} coverage`);assert.equal(r.nans,0,`${i}/${j} finite margins`);assert.equal(r.totals,r.outlines-r.unavailable,`${i}/${j} totals`);
  assert.ok(Math.abs(r.shares.reduce((s,v)=>s+v.voteshare,0))<1e-7,`${i}/${j} national shifts conserve 100%`);
  if(i===j){assert.equal(r.nonzero,0,`${i} self neutral`);assert.equal(r.unavailable,0)}
  if((i>=4&&i<=7&&j>=4&&j<=7)||(i===8&&j===7)||(i===7&&j===8)||(i===4&&j===3)||(i===3&&j===4))assert.equal(r.unavailable,0,`${i}/${j} matching estimates`);
  if(i===j||(i===8&&j===7)||(i===4&&j===3))console.log('PASS pair',i,j,r.outlines,'outlines,',r.unavailable,'unavailable');
 }
 const after=await p.evaluate(()=>JSON.stringify(mapSources['Past-UK-General-Elections'].getMapData()));assert.equal(after,before,'Historical records must remain unchanged');
 await p.evaluate(async()=>{await setCompareSourceDate(0,8,false);await setCompareSourceDate(1,7,true)});
 const example=await p.evaluate(()=>currentMapSource.getMapData()[currentSliderDate.getTime()]['UK2024-W07000081']);
 assert.equal(example.partyID,'UK-RUK');assert.ok(Math.abs(example.margin-Math.abs(10354/35755*100-13457/44423*100))<1e-7);
 const labour=example.partyVotesharePercentages.find(v=>v.partyID==='UK-LAB').voteshare;
 assert.ok(Math.abs(labour-(17838/35755*100-23509/44423*100))<1e-7,'Published actual/notional vote-share difference');
 console.log('PASS numeric published margin movement and Labour percentage-point change');
 assert.deepEqual(errors,[]);console.log('PASS all 64 pairs, reversed estimates, self neutrality, finite shifts, coverage and immutable historical data');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
