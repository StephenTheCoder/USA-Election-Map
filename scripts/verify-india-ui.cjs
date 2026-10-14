const {chromium}=require('../.tools/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const elections=JSON.parse(fs.readFileSync('csv-sources/india-general-elections.json','utf8')).elections;
async function point(page,id){return page.locator(`[id="${id}"]`).evaluate(el=>{const r=el.getBoundingClientRect();for(let y=Math.ceil(r.top);y<r.bottom;y++)for(let x=Math.ceil(r.left);x<r.right;x++)if(document.elementFromPoint(x,y)===el)return{x,y};throw Error('No visible hit point')})}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:8765');
 await page.waitForFunction(()=>typeof currentMapCountry!=='undefined'&&currentMapCountry&&document.querySelector('#outlines'));
 await page.locator('#cycleMapCountryButton').click();
 await page.waitForFunction(()=>currentMapCountry.getID()==='UK'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 await page.locator('#cycleMapCountryButton').click();
 await page.waitForFunction(()=>currentMapCountry.getID()==='India'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 for(let i=0;i<elections.length;i++){
  const e=elections[i];await page.locator('#dataMapDateSlider').fill(String(i+1));
  await page.waitForFunction(y=>currentSliderDate?.getFullYear()===y&&currentDisplayDate?.getFullYear()===y&&!isRunningDisplayMapQueue,e.year);
  const result=await page.evaluate(()=>({outlines:document.querySelector('#outlines').children.length,totals:getPartyTotals(false),total:displayRegionDataArray.NPV.totalVotes,
   missing:[...document.querySelector('#outlines').children].filter(el=>!displayRegionDataArray[el.id]).map(el=>el.id),
   bad:Object.values(displayRegionDataArray).filter(r=>r.region!=='NPV'&&!Number.isFinite(r.margin)).map(r=>r.region)}));
  assert.equal(result.outlines,e.regions.length);assert.deepEqual(result.missing,[]);assert.deepEqual(result.bad,[]);assert.equal(result.total,e.totalVotes);
  for(const[id,n]of Object.entries(e.seats))assert.equal(result.totals[id],n,`${e.year} ${id}`);
  assert.equal(Object.values(result.totals).reduce((a,b)=>a+b,0),Object.values(e.seats).reduce((a,b)=>a+b,0));
  if([1952,1957,1977,2024].includes(e.year))await page.screenshot({path:`.tools/india-${e.year}.png`});
  console.log('PASS',e.year,'all constituencies and matching MP/vote totals');
 }
 await page.locator('#dataMapDateSlider').fill('11');await page.waitForFunction(()=>currentSliderDate?.getFullYear()===1996&&!isRunningDisplayMapQueue);
 const long=elections[10].regions.find(r=>r.name==='Nalgonda');let pt=await point(page,long.id);await page.mouse.move(pt.x,pt.y);
 await page.waitForFunction(()=>document.querySelector('#regionbox').textContent.includes('Nalgonda')&&document.querySelector('#regionbox').scrollHeight>document.querySelector('#regionbox').clientHeight);
 assert.equal(long.votes.length,480);assert.match(await page.locator('#regionbox').textContent(),/Scroll to browse all candidates/);
 await page.mouse.wheel(0,1000);await page.waitForFunction(()=>document.querySelector('#regionbox').scrollTop>0);
 const fit=await page.locator('#regionboxcontainer').boundingBox();assert.ok(fit.y>=0&&fit.y+fit.height<=1000);
 console.log('PASS 480-candidate tooltip fits the viewport and scrolls with the wheel');
 await page.locator('#dataMapDateSlider').fill('18');await page.waitForFunction(()=>currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 const surat=elections.at(-1).regions.find(r=>r.name==='Surat');pt=await point(page,surat.id);await page.mouse.move(pt.x,pt.y);
 await page.waitForFunction(()=>document.querySelector('#regionbox').textContent.includes('DALAL'));
 assert.match(await page.locator('#regionbox').textContent(),/Elected unopposed/);assert.doesNotMatch(await page.locator('#regionbox').textContent(),/\+0/);
 const sample=elections.at(-1).regions.find(r=>r.name==='Varanasi');pt=await point(page,sample.id);await page.mouse.move(pt.x,pt.y);
 await page.waitForFunction(()=>document.querySelector('#regionbox').textContent.includes('MODI'));
 await page.keyboard.down('Shift');assert.match(await page.locator('#regionbox').textContent(),new RegExp(sample.majority.toLocaleString('en-US')));await page.keyboard.up('Shift');
 await page.mouse.click(pt.x,pt.y);await page.waitForFunction(()=>currentViewingState===ViewingState.zooming&&svgPanZoomController);
 await page.locator('#mapZoomInButton').click();assert.ok(await page.evaluate(()=>svgPanZoomController.getZoom()>1));
 await page.locator('#mapCloseButton').click();await page.waitForFunction(()=>currentViewingState===ViewingState.viewing);
 await page.locator('#dataMapDateSlider').fill('1');await page.waitForFunction(()=>currentSliderDate?.getFullYear()===1952&&!isRunningDisplayMapQueue);
 const early=elections[0].regions.find(r=>r.multiMember);pt=await point(page,early.id);await page.mouse.move(pt.x,pt.y);
 await page.waitForFunction(()=>document.querySelector('#regionbox').textContent.includes('shared constituency votes'));
 assert.match(await page.locator('#regionbox').textContent(),/Seat tile/);assert.match(await page.locator('#regionbox').textContent(),/elected/);
 await page.locator('body').click({position:{x:10,y:850}});await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>currentSliderDate?.getFullYear()===1957);
 await page.locator('#cycleMapCountryButton').click();await page.waitForFunction(()=>currentMapCountry.getID()==='JJU'&&currentMapType.getID()==='JJU-House');
 await page.locator('#cycleMapCountryButton').click();await page.waitForFunction(()=>currentMapCountry.getID()==='USA'&&document.querySelector('[aria-label="Switch to India"]'));
 await page.locator('#cycleMapCountryButton').hover();await page.locator('[aria-label="Switch to India"]').click();
 await page.waitForFunction(()=>currentMapCountry.getID()==='India'&&currentSliderDate?.getFullYear()===2024);
 await page.reload();await page.waitForFunction(()=>currentMapCountry.getID()==='India'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 assert.equal(await page.locator('#cycleMapCountryButton img').getAttribute('src'),'assets/india-flag.svg');
 const mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.stack));await mobile.setViewportSize({width:390,height:844});
 await mobile.goto('http://127.0.0.1:8765');await mobile.waitForFunction(()=>currentMapCountry.getID()==='India'&&currentSliderDate?.getFullYear()===2024&&!isRunningDisplayMapQueue);
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.screenshot({path:'.tools/india-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS tooltips, integer margins, multi-member seats, zoom, flag routes, persistence, keyboard and mobile');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
