import { test, expect } from '@playwright/test'
import { ENEMY_ATTACK_GROUPS, ENEMY_ATTACK_FAMILIES } from '../web/enemy-attack-themes.js'
import { mkdirSync } from 'node:fs'
const output='../../artifacts/arkham-enemy-attack-audit/implementation'
mkdirSync(output,{recursive:true})
async function fixture(page,{muted=false,reduced=false}={}) {
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'})
  await page.route('**/enemy-fixture',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/mods/arkhamhorror/noir.css"><div class="ah-table"><button id="unlock">开始</button><button class="ah-map-investigator" data-seat="0" data-interaction="investigator:0" style="position:fixed;left:18vw;top:400px;width:65px;height:85px">罗兰</button><button data-interaction="asset:a1" style="position:fixed;left:40vw;top:500px;width:70px;height:95px">盟友</button><div class="ah-engagement-cards"><button data-interaction="enemy:e1" style="position:fixed;left:65vw;top:200px;width:90px;height:135px">敌人</button></div><output id="damage">0</output></div>`}))
  await page.goto('/enemy-fixture')
  await page.evaluate(async({muted})=>{
    localStorage.setItem('arkham-presentation',JSON.stringify({sound:!muted,fast:true}))
    window.samples=[];const play=HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play=function(...args){window.samples.push(this.src.split('/').pop());return play.apply(this,args)}
    const {createTablePresentation}=await import('/mods/arkhamhorror/table-presentation.js')
    const state={revision:1,uiState:'inScenario',phase:'enemy',investigators:[{seat:0,name:'罗兰',damage:0,horror:0,hand:[],assets:[{id:'a1',name:'盟友',code:'01086'}],engaged:['e1'],location:'study'}],enemies:[{id:'e1',location:'study',name:'敌人',health:20,damageTaken:0}],locations:[]}
    let session={sessionId:'enemy-test',state,players:[{seat:0,role:'human'}],events:[]}
    const render=()=>{const shown=p.sync(session);document.querySelector('#damage').textContent=String(shown.state.investigators[0].damage)}
    const p=createTablePresentation({onChange:render});render();window.presenter=p
    window.seen=[]
    new MutationObserver(()=>{for(const fx of document.querySelectorAll('.ah-combat-fx[data-stage]')){
      if(!window.seen.some(item=>item.stage===fx.dataset.stage))window.seen.push({stage:fx.dataset.stage,style:fx.dataset.style,signature:!!fx.querySelector('.is-signature'),marks:fx.querySelectorAll('.ah-enemy-mark').length})
    }}).observe(document.body,{childList:true,subtree:true})
    window.freezeHarm=()=>{
      window.frozen=false;window.frozenAnimations=[];let frames=0
      const watch=()=>{
        const fx=document.querySelector('.ah-combat-fx[data-stage="harm"]'),hit=fx?.querySelector('.is-contact')
        if(hit&&Number(getComputedStyle(hit).opacity)>.4){window.frozenAnimations=fx.getAnimations({subtree:true});window.frozenAnimations.forEach(a=>a.pause());window.frozen=true}
        else if(frames++<600)requestAnimationFrame(watch)
      };requestAnimationFrame(watch)
    }
    window.enemyAttack=(spec={})=>{
      window.seen=[]
      const before=structuredClone(session.state);session=structuredClone(session);session.state.revision++
      const base={direction:'incoming',seat:0,enemyId:'e1',name:'敌人',location:'study',attackStyle:'claw',damage:1,horror:0,...spec}
      if(spec.sourceKind==='global'){delete base.enemyId;document.querySelector('[data-interaction="enemy:e1"]')?.remove()}
      session.events.push({seq:session.events.length,type:'presentation',kind:'attack',...base,presentationStage:'threat',tableState:before})
      if(!spec.prevented) {
        session.events.push({seq:session.events.length,type:'presentation',kind:'enemyHarm',...base,presentationStage:'harm',targets:[{seat:0,damage:base.damage,horror:base.horror,...(spec.asset?{assetId:'a1'}:{})}],tableState:before})
        if(!spec.asset){session.state.investigators[0].damage+=base.damage;session.state.investigators[0].horror+=base.horror}
      }
      session.events.push({seq:session.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(session.state)});render()
    }
    window.repaint=render
  },{muted})
  await page.locator('#unlock').click()
}
for(const width of [1440,390])test(`enemy shared categories and all special families render and finish (${width})`,async({page})=>{
  test.setTimeout(180000);await page.setViewportSize({width,height:900});await fixture(page)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const profiles=[...Object.keys(ENEMY_ATTACK_GROUPS).map(attackStyle=>({attackStyle})),...Object.keys(ENEMY_ATTACK_FAMILIES).map(enemyFamily=>({enemyFamily,attackStyle:'psychic'})),
    {enemyFamily:'atlach',enemyVariant:'leg-1',attackStyle:'claw'},{enemyFamily:'nyarlathotep',enemyVariant:'trueShape',attackStyle:'psychic'}]
  for(const profile of profiles) {
    await page.evaluate(profile=>window.enemyAttack(profile),profile)
    await expect.poll(()=>page.evaluate(()=>window.seen.map(item=>item.stage))).toContain('harm')
    const seen=await page.evaluate(()=>window.seen)
    expect(seen.find(item=>item.stage==='threat').marks).toBeGreaterThan(0)
    if(profile.enemyFamily)expect(seen.find(item=>item.stage==='threat').signature).toBe(true)
    await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
    await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
  }
  expect(errors).toEqual([])
  expect(await page.evaluate(()=>window.samples.some(name=>name==='enemy-fear.ogg'))).toBe(true)
})
test('enemy actual fear, asset soak, prevented attack and global source keep correct anchors',async({page})=>{
  await fixture(page)
  await page.evaluate(()=>{window.freezeHarm();window.enemyAttack({damage:0,horror:2,attackStyle:'spectral'})})
  await expect.poll(()=>page.evaluate(()=>window.frozen)).toBe(true)
  await expect(page.locator('.ah-combat-fx[data-stage="harm"] .is-fear')).toHaveCount(1)
  await expect(page.locator('.ah-enemy-harm-number')).toHaveText('−2 ◉')
  await page.screenshot({path:output+'/fear-fixture.png'})
  await page.evaluate(()=>window.frozenAnimations.forEach(a=>a.play()))
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
  await expect(page.locator('#damage')).toHaveText('0')
  await page.evaluate(()=>{window.freezeHarm();window.enemyAttack({asset:true,damage:1,horror:0})})
  await expect.poll(()=>page.evaluate(()=>window.frozen)).toBe(true)
  await expect(page.locator('.ah-combat-fx[data-stage="harm"] .ah-combat-caption')).toContainText('盟友')
  const hit=page.locator('.ah-combat-fx[data-stage="harm"] .is-contact')
  const at=await hit.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)})),box=await page.locator('[data-interaction="asset:a1"]').boundingBox()
  expect(Math.hypot(at.x-box.x-box.width/2,at.y-box.y-box.height/2)).toBeLessThan(2)
  await page.evaluate(()=>window.frozenAnimations.forEach(a=>a.play()))
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
  await page.evaluate(()=>window.enemyAttack({prevented:true}))
  await expect(page.locator('.ah-combat-fx[data-stage="threat"]')).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
  await expect(page.locator('#damage')).toHaveText('0')
  await page.evaluate(()=>window.enemyAttack({sourceKind:'global',enemyFamily:'azathoth',attackStyle:'psychic'}))
  await expect(page.locator('.ah-combat-fx[data-stage="threat"] .is-signature')).toHaveCount(1)
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
  await expect(page.locator('#damage')).toHaveText('1')
  await page.evaluate(()=>{window.repaint();window.repaint()})
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
})
test('enemy animation respects mute, reduced motion and cancellation',async({page})=>{
  await fixture(page,{muted:true,reduced:true})
  await page.evaluate(()=>window.enemyAttack({enemyFamily:'hastur',damage:0,horror:2,attackStyle:'psychic'}))
  await expect.poll(()=>page.evaluate(()=>window.seen.map(item=>item.stage))).toContain('harm')
  await expect.poll(()=>page.evaluate(()=>window.presenter.isBlocking)).toBe(false)
  expect(await page.evaluate(()=>window.samples)).toEqual([])
  await page.evaluate(()=>window.enemyAttack())
  await expect(page.locator('.ah-combat-fx')).toBeVisible()
  await page.evaluate(()=>window.presenter.reset())
  await expect(page.locator('.ah-combat-fx')).toHaveCount(0)
})
