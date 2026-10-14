const{chromium}=require('../.tools/node_modules/playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
const elections=JSON.parse(fs.readFileSync('csv-sources/india-general-elections.json','utf8')).elections;
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.context().addCookies([{name:'currentMapCountry',value:'India',url:'http://127.0.0.1:8765'}]);
 await p.goto('http://127.0.0.1:8765');await p.waitForFunction(()=>typeof currentSliderDate!=='undefined'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 const before=await p.evaluate(()=>JSON.stringify(mapSources['Past-India-General-Elections'].getMapData()));
 await p.locator('#compareButton').click();await p.waitForFunction(()=>currentMapSource.isCompare()&&currentMapSource.getMapData()?.[currentSliderDate?.getTime()]&&loaderStack[0]===LoaderType.hidden&&document.querySelector('#secondCompareDataMapDateSlider').value==='17');
 for(let i=1;i<=18;i++){
  for(let j=1;j<=18;j++){
   const r=await p.evaluate(async([i,j])=>{
    $('#firstCompareDataMapDateSlider').val(i);$('#secondCompareDataMapDateSlider').val(j);await setCompareSourceDate(0,i,false);await setCompareSourceDate(1,j,true);
    const m=currentMapSource.getMapData()[currentSliderDate.getTime()];return{outlines:document.querySelector('#outlines').children.length,count:Object.keys(m).length,unavailable:Object.values(m).filter(v=>v.comparisonUnavailable).length,nonzero:Object.values(m).filter(v=>!v.disabled&&v.margin>1e-7).length,nans:Object.values(m).filter(v=>!Number.isFinite(v.margin)).length,shares:m.NPV.partyVotesharePercentages,totals:Object.values(getPartyTotals(false)).reduce((a,b)=>a+b,0)}
   },[i,j]);
   const first=elections[i-1],second=elections[j-1];const geometry=first.boundaryYear>=second.boundaryYear?first:second;
   const comparable=geometry.regions.filter(g=>[first,second].every(e=>e.regions.some(v=>v.id===g.id&&!v.disabled))).length;
   assert.equal(r.count,geometry.regions.length+1,`${i}/${j} coverage`);assert.equal(r.outlines,geometry.regions.length);assert.equal(r.nans,0);assert.equal(r.totals,comparable);
   assert.ok(Math.abs(r.shares.reduce((s,v)=>s+v.voteshare,0))<1e-7,`${i}/${j} national conservation`);
   if(i===j)assert.equal(r.nonzero,0,`${i} self neutral`);
   if((i===18&&j===17)||(i===17&&j===18)){assert.equal(r.unavailable,20);assert.equal(r.totals,523)}
  }
  console.log('PASS',elections[i-1].year,'compared with all 18 elections; numeric coverage, finite margins and national shares');
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(mapSources['Past-India-General-Elections'].getMapData())),before);
 await p.evaluate(async()=>{await setCompareSourceDate(0,18,false);await setCompareSourceDate(1,17,true)});
 const id=elections.at(-1).regions.find(r=>r.name==='Varanasi').id;
 const a=elections.at(-1).regions.find(r=>r.id===id),c=elections.at(-2).regions.find(r=>r.id===id);
 const actual=await p.evaluate(id=>currentMapSource.getMapData()[currentSliderDate.getTime()][id],id);
 assert.ok(Math.abs(actual.margin-Math.abs(a.majority/a.totalVotes*100-c.majority/c.totalVotes*100))<1e-7);
 const inc=r=>r.votes.filter(v=>v.party==='IN-INC').reduce((s,v)=>s+v.votes,0)/r.totalVotes*100;
 assert.ok(Math.abs(actual.partyVotesharePercentages.find(v=>v.partyID==='IN-INC').voteshare-(inc(a)-inc(c)))<1e-7);
 await p.screenshot({path:'.tools/india-compare.png'});
 assert.deepEqual(errors,[]);console.log('PASS all 324 pairs, numeric Varanasi movement and unchanged historical data');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
