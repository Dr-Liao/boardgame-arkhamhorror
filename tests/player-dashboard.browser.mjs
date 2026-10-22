import { test,expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { mkdirSync } from 'node:fs'
const output='artifacts/arkham-polish/'
mkdirSync(output,{recursive:true})
async function fixture(page) {
  let session
  await page.route('**/api/start',async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:1,playerInvestigator:'01001',seed:'player-dashboard'}})})
    const body=await response.json();session=body.session;const s=session.state
    s.pendingChoice=null;s.currentSeat=0;s.phase='investigation';s.enemies=[]
    s.locations=['hallway','attic','cellar','parlor'].map(id=>({...scenario.locations[id],revealed:true,clues:id==='cellar'?2:0,maxClues:2}))
    const inv=s.investigators[0];inv.location='hallway';inv.hand=['01016','01087','01088','01025','01086'];inv.resources=7;inv.clues=3;inv.effectiveStats={willpower:inv.willpower-1,intellect:inv.intellect,combat:inv.combat+1,agility:inv.agility}
    inv.assets=[{id:'beat-cop',code:'01018',exhausted:false}]
    s.legalMoves=[{action:'play',cardId:'01016',label:'装备手枪'},{action:'play',cardId:'01087',label:'装备手电筒'}]
    await route.fulfill({response,json:body})
  })
  await page.route('**/api/session?*',route=>route.fulfill({json:{ok:true,session}}))
  await page.goto('/index.html');await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click();await page.getByRole('button',{name:'开始新游戏'}).click();await page.getByRole('button',{name:'跳过演出'}).click()
  return {session,async update(change){change(session);session.state.revision++;await page.getByRole('button',{name:'刷新局势'}).click();await expect(page.locator('.ah-table')).toHaveAttribute('data-revision',String(session.state.revision))}}
}
test('常显属性与正负修正、独立托盘、费用悬浮与动态交战区',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1920,height:1080})
  const f=await fixture(page)
  await f.update(s=>{s.players[0].name='星河队长'})
  await expect(page.locator('.ah-dock-kicker')).toHaveText('星河队长的调查员')
  await expect(page.getByRole('region',{name:'交战区',exact:true})).toHaveCount(0)
  await expect(page.locator('[data-skill="combat"] strong')).toHaveText('4')
  await expect(page.locator('[data-skill="combat"] .is-positive')).toHaveText('+1')
  await expect(page.locator('[data-skill="combat"]')).toHaveAttribute('aria-label','战斗：基础 4，额外 +1，当前 5')
  await expect(page.locator('[data-skill="willpower"] .is-negative')).toHaveText('-1')
  await expect(page.locator('[data-skill="intellect"] small')).toHaveCount(0)
  await expect(page.locator('[data-skill="agility"] small')).toHaveCount(0)
  await expect(page.locator('.ah-vital-health')).toHaveAttribute('aria-label','生命 9 / 9')
  await expect(page.locator('.ah-vital-sanity')).toHaveAttribute('aria-label','理智 5 / 5')
  await expect(page.locator('.ah-action-count')).toHaveText('3')
  await expect(page.locator('.ah-action-pips .is-ready')).toHaveCount(3)
  await expect(page.locator('.ah-pool-resource > strong')).toHaveText('7')
  await expect(page.locator('.ah-pool-clue > strong')).toHaveText('3')
  const hand=page.locator('.ah-hand-card')
  await hand.first().hover();await expect(page.locator('.ah-pool-resource')).toHaveClass(/is-cost-preview/)
  await hand.nth(2).hover();await expect(page.locator('.ah-pool-resource')).not.toHaveClass(/is-cost-preview/)
  await hand.first().focus();await expect(page.locator('.ah-pool-resource')).toHaveClass(/is-cost-preview/)
  await f.update(({state:s})=>{s.enemies=[{id:'ghoul',code:'01160',originalCode:'01160',name:'食尸鬼爪牙',location:'hallway',engagedSeat:0,health:2,damageTaken:0,fight:2,evade:2},{id:'rats',code:'01159',originalCode:'01159',name:'鼠群',location:'hallway',engagedSeat:0,health:1,damageTaken:0,fight:1,evade:1}]})
  await expect(page.locator('.ah-engagement-alert')).toContainText('进入交战状态')
  await expect(page.locator('.ah-engagement-zone')).toHaveAttribute('data-engaged-count','2')
  expect((await page.locator('.ah-engagement-zone .ah-enemy').first().boundingBox()).height).toBeGreaterThan(140)
  await expect(page.locator('.ah-engagement-alert')).toHaveCount(0,{timeout:6000})
  await hand.first().hover()
  await expect.poll(()=>page.locator('.ah-table-art').evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().width>0).every(el=>el.dataset.imageState==='displayable'))).toBe(true)
  await page.screenshot({path:output+'player-dashboard-final.png',animations:'disabled'})
  await page.mouse.move(0,0)
  for(const width of [900,390]){
    await page.setViewportSize({width,height:844})
    await expect(page.locator('.ah-dock-skills')).toBeInViewport();await expect(page.locator('.ah-pool-resource')).toBeInViewport();await expect(page.locator('.ah-engagement-zone')).toBeInViewport()
    await expect(page.locator('.ah-action-points')).toBeInViewport()
    await expect(page.locator('.ah-vital-health')).toBeInViewport()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:output+`player-dashboard-${width}.png`,animations:'disabled'})
  }
  await f.update(s=>{s.state.enemies=[];s.state.investigators[0].actionsLeft=0;s.state.investigators[0].damage=2;s.state.investigators[0].horror=4})
  await expect(page.locator('.ah-vital-health')).toHaveAttribute('aria-label','生命 7 / 9')
  await expect(page.locator('.ah-vital-sanity')).toHaveAttribute('aria-label','理智 1 / 5')
  for(const [kind,ratio] of [['health',7/9],['sanity',1/5]]) {
    const actual=await page.locator(`.ah-vital-${kind} .ah-vital-track`).evaluate(el=>el.firstElementChild.getBoundingClientRect().width/el.getBoundingClientRect().width)
    expect(actual).toBeCloseTo(ratio,2)
  }
  await page.setViewportSize({width:1440,height:1000})
  await page.locator('.ah-dock-vitals').screenshot({path:output+'vitals-corrected.png'})
  await expect(page.locator('.ah-action-count')).toHaveText('0')
  await expect(page.locator('.ah-action-pips .is-ready')).toHaveCount(0)
  await expect(page.locator('.ah-engagement-zone')).toHaveCount(0)
  await f.update(s=>{s.state.enemies=[{id:'massive',name:'巨型怪物',massive:true,location:'hallway',health:6,fight:4,evade:3,code:'01116'}]})
  await expect(page.locator('.ah-engagement-alert')).toBeVisible()
  await expect(page.locator('.ah-engagement-alert')).toHaveCount(0,{timeout:6000})
  await f.update(()=>{})
  await expect(page.locator('.ah-engagement-alert')).toHaveCount(0)
  expect(errors).toEqual([])
})
test('自动阶段无需任何操作即按序播放并消失，切换页面可继续',async({page})=>{
  const f=await fixture(page)
  await page.emulateMedia({reducedMotion:'reduce'})
  await f.update(s=>{for(const phase of ['enemy','upkeep','mythos'])s.events.push({seq:s.events.length,type:'presentation',kind:'automatic',phase,round:2,text:phase+'自动结算',effect:'resource',delta:1,seat:0})})
  const scene=page.locator('.ah-phase-scene')
  await expect(scene).toHaveAttribute('data-phase','enemy')
  await expect(scene.getByRole('button',{name:'下一步'})).toHaveCount(0)
  await expect(scene.getByRole('button',{name:'暂停'})).toHaveCount(0)
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))})
  await expect(scene).toHaveAttribute('data-phase','upkeep',{timeout:6000})
  await expect(scene).toHaveAttribute('data-phase','mythos',{timeout:6000})
  await expect(scene).toHaveCount(0,{timeout:6000})
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
})

test('米奇·布朗的额外盟友槽单独显示，且只放非独特盟友',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:1000})
  const f=await fixture(page)
  await f.update(session=>{
    const s=session.state,inv=s.investigators[0]
    s.cards['04006']={...s.cards['04006'],code:'04006',name:'米奇·布朗',type:'asset',slot:'Ally',slots:['Ally'],unique:true,allySlotsForNonUnique:2}
    s.cards['02158']={...s.cards['02158'],code:'02158',name:'魅力超凡',type:'asset',unique:false,extraSlots:{ally:1}}
    s.cards['01048']={...s.cards['01048'],code:'01048',name:'里奥·德·卢卡',type:'asset',slot:'Ally',slots:['Ally'],unique:true}
    s.cards['01018']={...s.cards['01018'],code:'01018',name:'巡警',type:'asset',slot:'Ally',slots:['Ally'],unique:false}
    inv.assets=[
      {id:'charisma',code:'02158',exhausted:false},
      {id:'leo-de-luca',code:'01048',exhausted:false},
      {id:'mickey',code:'04006',exhausted:false},
      {id:'beat-cop',code:'01018',exhausted:false},
    ]
    inv.hand=['01021'];inv.resources=10
    s.legalMoves=[{action:'play',cardId:'01021',label:'装备看门狗'}]
  })
  // 基础 1 + 魅力超凡 1：两个不受限盟友槽；米奇再开两个「非独特」受限槽。
  await expect(page.locator('.ah-equip-slot[data-slot="ally"]')).toHaveCount(2)
  const restricted=page.locator('.ah-equip-slot[data-slot="allyRestricted"]')
  await expect(restricted).toHaveCount(2)
  await expect(restricted.first()).toContainText('盟友·非独特 1')
  await expect(restricted.first()).toContainText('巡警')
  await expect(page.locator('.ah-equip-slot[data-slot="ally"]').first()).toContainText('里奥·德·卢卡')
  await expect(page.locator('.ah-equip-slot[data-slot="ally"]').nth(1)).toContainText('米奇·布朗')
  await page.screenshot({path:output+'mickey-ally-slots-desktop.png',animations:'disabled'})
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900})
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }
  await page.screenshot({path:output+'mickey-ally-slots.png',animations:'disabled'})
  expect(errors).toEqual([])
})

