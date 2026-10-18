import {test,expect} from '@playwright/test'

async function fixture(page,{muted=false,reduced=false}={}) {
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'})
  await page.route('**/combat-fixture',route=>route.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/mods/arkhamhorror/noir.css"><div class="ah-table"><button id="unlock">进入战斗</button><div class="ah-map-node" data-location-id="study" style="position:fixed;left:300px;top:250px;width:140px;height:190px"></div><button class="ah-map-investigator" data-seat="0" data-interaction="investigator:0" style="position:fixed;left:220px;top:270px;width:50px;height:65px">罗兰</button><div class="ah-engagement-cards"><button data-interaction="enemy:e1" style="position:fixed;left:640px;top:240px;width:130px;height:185px">食尸鬼</button></div><output id="health">9</output></div>`}))
  await page.goto('/combat-fixture')
  await page.evaluate(async({muted})=>{
    localStorage.setItem('arkham-presentation',JSON.stringify({sound:!muted}))
    window.soundStarts=0
    const start=OscillatorNode.prototype.start
    OscillatorNode.prototype.start=function(...args){window.soundStarts++;return start.apply(this,args)}
    window.samples=[]
    const playSample=HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play=function(...args){window.samples.push(this.src.split('/').pop());return playSample.apply(this,args)}
    const {createTablePresentation}=await import('/mods/arkhamhorror/table-presentation.js')
    const state={revision:10,uiState:'inScenario',phase:'investigation',investigators:[{seat:0,damage:0,hand:[],assets:[],engaged:['e1'],location:'study'}],enemies:[{id:'e1',engagedSeat:0,name:'食尸鬼',damageTaken:0,health:3,location:'study'}],locations:[]}
    let session={sessionId:'attack-test',state,players:[{seat:0,role:'human'}],events:[]}
    const render=()=>{const shown=p.sync(session);document.querySelector('#health').textContent=String(9-shown.state.investigators[0].damage)}
    const p=createTablePresentation({onChange:render});render()
    window.attack=(direction,success=true,attackStyle)=>{
      const before=structuredClone(session.state)
      session=structuredClone(session);session.state.revision++
      if(direction==='incoming')session.state.investigators[0].damage+=2
      else if(success)session.state.enemies[0].damageTaken++
      session.events.push({seq:session.events.length,type:'presentation',kind:'attack',direction,seat:0,enemyId:'e1',name:'食尸鬼',damage:direction==='incoming'?2:1,horror:direction==='incoming'?1:0,success,attackStyle,tableState:before})
      session.events.push({seq:session.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(session.state)})
      render()
    }
    window.blast=()=>{
      const before=structuredClone(session.state)
      session=structuredClone(session);session.state.revision++;session.state.enemies[0].damageTaken+=3;session.state.investigators[0].damage+=3
      session.events.push({seq:session.events.length,type:'presentation',kind:'blast',fx:'dynamite',seat:0,location:'study',name:'书房',damage:3,enemyIds:['e1'],seats:[0],tableState:before})
      session.events.push({seq:session.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(session.state)})
      render()
    }
    window.repaint=render;window.presenter=p
  },{muted})
  await page.locator('#unlock').click()
}

test('攻击使用场上卡牌，受击后更新生命，锁定操作且重绘不重播',async({page})=>{
  await fixture(page)
  await page.evaluate(()=>window.attack('outgoing'))
  await expect(page.locator('.ah-combat-fx')).toHaveAttribute('data-direction','outgoing')
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting') && !el.inert)).toBe(true)
  expect(await page.locator('.ah-map-investigator').evaluate(el=>el.getAnimations().length)).toBeGreaterThan(0)
  await expect(page.locator('.ah-combat-caption')).toContainText('命中')
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
  expect(await page.evaluate(()=>window.soundStarts)).toBe(2)
  await page.evaluate(()=>{window.repaint();window.repaint()})
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
  expect(await page.evaluate(()=>window.soundStarts)).toBe(2)
  await page.evaluate(()=>window.attack('incoming'))
  await expect(page.locator('.ah-combat-fx')).toHaveAttribute('data-direction','incoming')
  await expect(page.locator('#health')).toHaveText('9')
  await expect(page.locator('.ah-combat-fx.is-impact')).toBeVisible()
  await page.screenshot({path:'artifacts/arkham-polish/attack-impact.png'})
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
  await expect(page.locator('#health')).toHaveText('7')
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
  expect(await page.evaluate(()=>window.soundStarts)).toBe(5)
  expect(await page.locator('.ah-map-investigator').evaluate(el=>el.getAnimations().length)).toBe(0)
})

test('枪械与刀类攻击使用专属动效和音效，未知样式回落默认',async({page})=>{
  await fixture(page)
  const styles=[
    ['firearm',['.ah-combat-muzzle','.ah-combat-tracer','.ah-combat-hole'],['firearm-shot.wav'],1],
    ['blade',['.ah-combat-cut'],['blade-slash.ogg','blade-hit.ogg'],0],
    ['lightning',['.ah-combat-bolts','.ah-combat-charge'],['lightning-zap.wav'],1],
    ['laser',['.ah-combat-slash','.ah-combat-burst'],[],2],
  ]
  for(const [style,parts,samples,oscillators] of styles) {
    await page.evaluate(()=>{window.samples=[];window.soundStarts=0})
    await page.evaluate(style=>window.attack('outgoing',true,style),style)
    const fx=page.locator('.ah-combat-fx')
    await expect(fx).toHaveAttribute('data-style',style==='laser'?'default':style)
    for(const part of parts)await expect(fx.locator(part)).toHaveCount(part==='.ah-combat-cut'?2:1)
    await expect(page.locator('.ah-combat-fx.is-impact')).toBeVisible()
    if(style!=='laser')await page.screenshot({path:`../../artifacts/arkham-polish/attack-${style}.png`})
    await expect(fx).toHaveCount(0)
    expect(await page.evaluate(()=>window.samples)).toEqual(samples)
    expect(await page.evaluate(()=>window.soundStarts)).toBe(oscillators)
  }
  await page.evaluate(()=>window.attack('incoming',true,'firearm'))
  await expect(page.locator('.ah-combat-fx')).toHaveAttribute('data-style','default')
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
})

test('炸药爆破投掷后在地点爆炸，波及目标并在结束后结算伤害',async({page})=>{
  await fixture(page)
  await page.evaluate(()=>{window.samples=[];window.soundStarts=0;window.blast()})
  const fx=page.locator('.ah-blast-fx')
  await expect(fx).toHaveAttribute('data-fx','dynamite')
  await expect(fx.locator('.ah-blast-stick')).toHaveCount(1)
  await expect(fx.locator('.ah-blast-debris')).toHaveCount(12)
  await expect(fx.locator('.ah-combat-burst.is-fire')).toHaveCount(2)
  await expect(page.locator('.ah-blast-fx.is-impact .ah-combat-caption')).toContainText('炸药爆破「书房」')
  await expect(page.locator('#health')).toHaveText('9')
  await page.screenshot({path:'../../artifacts/arkham-polish/attack-dynamite.png'})
  await expect(fx).toHaveCount(0)
  await expect(page.locator('#health')).toHaveText('6')
  expect((await page.evaluate(()=>window.samples))[0]).toBe('dynamite-blast.ogg')
  expect(await page.evaluate(()=>window.soundStarts)).toBe(1)
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
})

test('落空、静音与减弱动态保留结果，离开桌面清理演出',async({page})=>{
  await fixture(page,{muted:true,reduced:true})
  await page.evaluate(()=>window.attack('outgoing',false))
  await expect(page.locator('.ah-combat-fx.is-miss')).toBeVisible()
  await expect(page.locator('.ah-combat-caption')).toContainText('攻击落空')
  expect(await page.locator('.ah-map-investigator').evaluate(el=>el.getAnimations().length)).toBe(0)
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
  expect(await page.evaluate(()=>window.soundStarts)).toBe(0)
  await page.evaluate(()=>window.attack('incoming'))
  await expect(page.locator('.ah-combat-fx')).toBeVisible()
  await page.locator('.ah-table').evaluate(el=>el.remove())
  await expect(page.locator('.ah-fx-layer')).toHaveCount(0)
})

