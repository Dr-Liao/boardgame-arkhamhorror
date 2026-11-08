import {test,expect} from '@playwright/test'
import { ATTACK_THEMES } from '../web/attack-themes.js'

async function fixture(page,{muted=false,reduced=false}={}) {
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'})
  await page.route('**/combat-fixture',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><link rel="stylesheet" href="/mods/arkhamhorror/noir.css"><div class="ah-table"><button id="unlock">进入战斗</button><div class="ah-map-node" data-location-id="study" style="position:fixed;left:300px;top:250px;width:140px;height:190px"></div><button class="ah-map-investigator" data-seat="0" data-interaction="investigator:0" style="position:fixed;left:220px;top:270px;width:50px;height:65px">罗兰</button><div class="ah-engagement-cards"><button data-interaction="enemy:e1" style="position:fixed;left:640px;top:240px;width:130px;height:185px">食尸鬼</button><button data-interaction="enemy:e2" style="position:fixed;left:850px;top:250px;width:130px;height:185px">邪灵</button></div><output id="health">9</output></div>`}))
  await page.goto('/combat-fixture')
  await page.evaluate(async({muted})=>{
    localStorage.setItem('arkham-presentation',JSON.stringify({sound:!muted}))
    window.soundStarts=0
    window.tones=[]
    const start=OscillatorNode.prototype.start
    OscillatorNode.prototype.start=function(...args){window.soundStarts++;window.tones.push(this.type);return start.apply(this,args)}
    window.samples=[]
    const playSample=HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play=function(...args){window.samples.push(this.src.split('/').pop());return playSample.apply(this,args)}
    const {createTablePresentation}=await import('/mods/arkhamhorror/table-presentation.js')
    const state={revision:10,uiState:'inScenario',phase:'investigation',investigators:[{seat:0,damage:0,hand:[],assets:[],engaged:['e1'],location:'study'}],enemies:[{id:'e1',engagedSeat:0,name:'食尸鬼',damageTaken:0,health:3,location:'study'},{id:'e2',engagedSeat:null,name:'邪灵',damageTaken:0,health:3,location:'study'}],locations:[]}
    let session={sessionId:'attack-test',state,players:[{seat:0,role:'human'}],events:[]}
    const render=()=>{const shown=p.sync(session);document.querySelector('#health').textContent=String(9-shown.state.investigators[0].damage)}
    const p=createTablePresentation({onChange:render});render()
    window.attack=(direction,success=true,attackStyle)=>{
      const before=structuredClone(session.state)
      session=structuredClone(session);session.state.revision++
      if(direction==='incoming')session.state.investigators[0].damage+=2
      else if(success){session.state.enemies[0].damageTaken++;if(attackStyle==='spiritStorm')session.state.enemies[1].damageTaken++}
      session.events.push({seq:session.events.length,type:'presentation',kind:'attack',direction,seat:0,enemyId:'e1',enemyIds:attackStyle==='spiritStorm'?['e1','e2']:undefined,name:'食尸鬼',damage:direction==='incoming'?2:1,horror:direction==='incoming'?1:0,success,attackStyle,tableState:before})
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
    window.directDamage=(style='impact',code='01018')=>{
      const before=structuredClone(session.state)
      session=structuredClone(session);session.state.revision++
      session.state.enemies[0].damageTaken+=2
      const targets=[{enemyId:'e1',name:'食尸鬼',damage:2}]
      if(style==='blast') {
        session.state.enemies[1].damageTaken+=2
        targets.push({enemyId:'e2',name:'邪灵',damage:2})
      }
      session.events.push({seq:session.events.length,type:'presentation',kind:'directDamage',code,style,sourceName:'测试伤害来源',seat:0,location:'study',damage:2,targets,tableState:before})
      session.events.push({seq:session.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(session.state)})
      render()
    }
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

test('枪械、刀和法术攻击使用专属动效和音效，未知样式回落默认',async({page})=>{
  await fixture(page)
  const styles=[
    ['firearm',['.ah-combat-muzzle','.ah-combat-tracer','.ah-combat-hole'],['firearm-shot.wav'],1],
    ['blade',['.ah-combat-cut'],['blade-slash.ogg','blade-hit.ogg'],0],
    ['lightning',['.ah-combat-bolts','.ah-combat-charge'],['lightning-zap.wav'],1],
    ['spell',['.ah-combat-sigil','.ah-combat-orb','.ah-combat-ward'],[],2],
    ['spiritStorm',['.ah-storm-sigil','.ah-storm-vortex','.ah-storm-core','.ah-storm-wave','.ah-storm-echo'],[],2],
    ['laser',['.ah-combat-slash','.ah-combat-burst'],[],2],
  ]
  for(const [style,parts,samples,oscillators] of styles) {
    await page.evaluate(()=>{window.samples=[];window.soundStarts=0;window.tones=[]})
    await page.evaluate(style=>window.attack('outgoing',true,style),style)
    const fx=page.locator('.ah-combat-fx')
    await expect(fx).toHaveAttribute('data-style',style==='laser'?'default':style)
    for(const part of parts)await expect(fx.locator(part)).toHaveCount(part==='.ah-combat-cut'?2:1)
    await expect(page.locator('.ah-combat-fx.is-impact')).toBeVisible()
    if(style!=='laser')await page.screenshot({path:`../../artifacts/arkham-polish/attack-${style}.png`})
    await expect(fx).toHaveCount(0)
    expect(await page.evaluate(()=>window.samples)).toEqual(samples)
    expect(await page.evaluate(()=>window.soundStarts)).toBe(oscillators)
    if(style==='spiritStorm')expect(await page.evaluate(()=>window.tones)).toEqual(['sawtooth','sawtooth'])
  }
  await page.evaluate(()=>window.attack('incoming',true,'firearm'))
  await expect(page.locator('.ah-combat-fx')).toHaveAttribute('data-style','default')
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
})

test('法术攻击落空仍播放施法，静音时不发声',async({page})=>{
  await fixture(page,{muted:true})
  await page.evaluate(()=>window.attack('outgoing',false,'spell'))
  const fx=page.locator('.ah-combat-fx')
  await expect(fx).toHaveAttribute('data-style','spell')
  await expect(fx.locator('.ah-combat-orb')).toHaveCount(1)
  await expect(page.locator('.ah-combat-caption')).toContainText('攻击落空')
  await expect(fx).toHaveCount(0)
  expect(await page.evaluate(()=>window.soundStarts)).toBe(0)
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

for(const width of [1440,390])test(`P0 direct damage templates, legal samples and source/target feedback at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:950})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const failedAudio=[]
  page.on('response',response=>{if(/\/audio\/direct-/.test(response.url())&&!response.ok())failedAudio.push(response.url())})
  await fixture(page)
  await page.addStyleTag({content:'.ah-map-node{left:35% !important;top:350px !important;width:110px !important;height:150px !important}.ah-map-investigator{left:10% !important;top:270px !important}[data-interaction="enemy:e1"]{left:60% !important;top:420px !important;width:100px !important;height:150px !important}[data-interaction="enemy:e2"]{left:15% !important;top:620px !important;width:100px !important;height:150px !important}'})
  const styles=[['impact','direct-impact.ogg'],['bite','direct-bite.ogg'],['glass','direct-glass.ogg'],['arcane','direct-arcane.ogg'],['curse','direct-arcane.ogg'],['flash','direct-arcane.ogg'],['redirect','direct-arcane.ogg'],['ambush','blade-hit.ogg'],['firearm','firearm-shot.wav']]
  for(const [style,sample] of styles) {
    await page.evaluate(style=>{window.samples=[];window.directDamage(style)},style)
    const fx=page.locator('.ah-direct-fx')
    await expect(fx).toHaveAttribute('data-style',style)
    await expect(fx.locator('.ah-direct-source')).toHaveCount(1)
    await expect(fx.locator('.ah-combat-caption')).toContainText('测试伤害来源 → 食尸鬼')
    await expect(fx.locator('.ah-direct-number')).toHaveText('−2')
    await expect(fx).toHaveClass(/is-impact/)
    if(style==='arcane') {
      const box=await fx.locator('.ah-combat-caption').boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x+box.width).toBeLessThanOrEqual(width)
      await page.screenshot({path:`../../artifacts/arkham-attack-audit/p0-direct-${width}.png`})
    }
    await expect(fx).toHaveCount(0)
    expect(await page.evaluate(sample=>window.samples.includes(sample),sample)).toBe(true)
    const previous=await page.evaluate(()=>window.samples.length)
    await page.evaluate(()=>{window.repaint();window.repaint()})
    expect(await page.evaluate(()=>window.samples.length)).toBe(previous)
  }
  await page.evaluate(()=>window.directDamage('blast','05273'))
  const blast=page.locator('.ah-blast-fx')
  await expect(blast).toHaveAttribute('data-fx','grenade')
  await expect(blast.locator('.ah-direct-number')).toHaveCount(2)
  await expect(blast.locator('.ah-combat-caption')).toContainText('食尸鬼 −2 / 邪灵 −2')
  await expect(blast).toHaveClass(/is-impact/)
  await page.screenshot({path:`../../artifacts/arkham-attack-audit/p0-grenade-${width}.png`})
  await expect(blast).toHaveCount(0)
  expect(errors).toEqual([])
  expect(failedAudio).toEqual([])
})

test('P0 direct damage respects mute, reduced motion, fast mode and reset',async({page})=>{
  await fixture(page,{muted:true,reduced:true})
  await page.evaluate(()=>{window.samples=[];window.directDamage('glass')})
  const fx=page.locator('.ah-direct-fx')
  await expect(fx).toHaveClass(/is-impact/)
  await expect(fx.locator('.ah-combat-caption')).toContainText('2 伤害')
  await expect(fx.locator('.ah-direct-mark')).toBeHidden()
  expect(await page.locator('.ah-map-investigator').evaluate(el=>el.getAnimations().length)).toBe(0)
  await expect(fx).toHaveCount(0)
  expect(await page.evaluate(()=>window.samples)).toEqual([])
  expect(await page.evaluate(()=>window.soundStarts)).toBe(0)
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.evaluate(()=>{window.presenter.toggleFast();window.directDamage('curse')})
  await expect(page.locator('.ah-direct-fx')).toHaveCount(1)
  await page.evaluate(()=>window.presenter.reset())
  await expect(page.locator('.ah-fx-layer')).toHaveCount(0)
  expect(await page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
})

for(const width of [1440,390])test(`P1 all themed attacks have distinct geometry, audio and bounded captions (${width})`,async({page})=>{
  test.setTimeout(100_000)
  await page.setViewportSize({width,height:950})
  const errors=[],failedAudio=[]
  page.on('pageerror',error=>errors.push(error.message))
  page.on('response',response=>{if(/\/audio\/p1-/.test(response.url())&&!response.ok())failedAudio.push(response.url())})
  await fixture(page)
  await page.addStyleTag({content:'.ah-map-node{left:35% !important;top:350px !important;width:110px !important;height:150px !important}.ah-map-investigator{left:10% !important;top:270px !important}[data-interaction="enemy:e1"]{left:60% !important;top:420px !important;width:100px !important;height:150px !important}'})
  await page.evaluate(()=>window.presenter.toggleFast())
  for(const [style,theme] of Object.entries(ATTACK_THEMES)) {
    await page.evaluate(style=>{window.samples=[];window.attack('outgoing',true,style)},style)
    const fx=page.locator('.ah-themed-fx')
    await expect(fx).toHaveAttribute('data-style',style)
    await expect(fx).toHaveAttribute('data-family',theme.family)
    const motif={projectile:'.ah-p1-projectile',flame:'.ah-p1-flame',beast:'.ah-p1-beast',bind:'.ah-p1-cord',wave:'.ah-p1-sound-wave',blade:'.ah-p1-motif',spell:'.ah-p1-motif'}[theme.family]
    expect(await fx.locator(motif).count()).toBeGreaterThan(0)
    await expect(fx).toHaveClass(/is-impact/)
    await page.waitForTimeout(45)
    const box=await fx.locator('.ah-combat-caption').boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width)
    await page.screenshot({path:`../../artifacts/arkham-attack-audit/p1/${style}-${width}.png`})
    await expect(fx).toHaveCount(0)
    if(theme.strikeSound.sample)expect((await page.evaluate(()=>window.samples)).length).toBeGreaterThan(0)
    const samples=await page.evaluate(()=>window.samples.length)
    await page.evaluate(()=>{window.repaint();window.repaint()})
    expect(await page.evaluate(()=>window.samples.length)).toBe(samples)
    if(width===1440) {
      await page.evaluate(style=>window.attack('outgoing',false,style),style)
      await expect(page.locator('.ah-themed-fx')).toHaveClass(/is-miss/)
      await expect(page.locator('.ah-themed-fx .ah-combat-caption')).toContainText('攻击落空')
      await expect(page.locator('.ah-themed-fx')).toHaveCount(0)
    }
  }
  expect(errors).toEqual([]);expect(failedAudio).toEqual([])
})

test('P1 reduced motion and mute keep outcomes; non-attack branches do not create themed scenes',async({page})=>{
  await fixture(page,{muted:true,reduced:true})
  for(const style of ['flamethrower','bow','voidSpell']) {
    await page.evaluate(style=>window.attack('outgoing',true,style),style)
    const fx=page.locator('.ah-themed-fx')
    await expect(fx).toHaveClass(/is-impact/)
    await expect(fx.locator('.ah-p1-hit')).toBeHidden()
    await expect(fx.locator('.ah-combat-caption')).toContainText('命中')
    await expect(fx).toHaveCount(0)
  }
  expect(await page.evaluate(()=>window.samples)).toEqual([])
  expect(await page.evaluate(()=>window.soundStarts)).toBe(0)
  await page.evaluate(()=>window.repaint())
  await expect(page.locator('.ah-themed-fx')).toHaveCount(0)
})

