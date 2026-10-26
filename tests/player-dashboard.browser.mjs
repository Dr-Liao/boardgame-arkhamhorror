import { test,expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { mkdirSync } from 'node:fs'
const output='artifacts/arkham-polish/'
mkdirSync(output,{recursive:true})
async function fixture(page,{investigator='01001'}={}) {
  let session
  await page.route('**/api/start',async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:1,playerInvestigator:investigator,seed:'player-dashboard'}})})
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

test('米兰资产卡有三态按钮；不显示神智角标，恐惧扣除标记在左侧', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:900})
  const f=await fixture(page)
  await f.update(session=>{
    session.state.cards['01033']={code:'01033',name:'米兰·克里斯托弗',type:'asset',cost:4,sanity:2,
      klass:'seeker',text:'你获得+1[willpower]。',hasAutoReaction:true,autoByDefault:true,hasReactionPrompt:false}
    session.state.investigators[0].assets=[{id:'milan',code:'01033',exhausted:false,horror:1,damage:0}]
  })
  const card=page.locator('.ah-minicard[data-card-code="01033"]')
  await expect(card).toHaveCount(1)
  await expect(card.locator('.ah-minicard-sanity')).toHaveCount(0)
  const mode=card.locator('.ah-reaction-mode')
  await expect(mode).toHaveCount(1)
  await expect(mode).toHaveAttribute('data-reaction-mode','auto')
  // 三态按钮同样只有图标、没有「反应开/反应关」文字；三态读屏走 aria-label 而非 switch。
  await expect(mode).toHaveText('')
  await expect(mode.locator('.ah-icon')).toHaveCount(1)
  expect(await mode.getAttribute('role')).toBeNull()
  const marker=card.locator('.ah-card-marker-horror')
  await expect(marker).toBeVisible()
  const markerBox=await marker.boundingBox(),cardBox=await card.boundingBox()
  expect(markerBox).not.toBeNull();expect(cardBox).not.toBeNull()
  expect(markerBox.x).toBeLessThan(cardBox.x+cardBox.width/2)
  expect(markerBox.y).toBeGreaterThan(cardBox.y+18)
  await page.screenshot({path:output+'milan-card-reaction.png',animations:'disabled'})
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','skip')
  await expect(mode.locator('.ah-reaction-slash')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('带经验角标的资产卡：三态按钮与经验角标不重叠', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:900})
  const f=await fixture(page)
  await f.update(session=>{
    session.state.cards['01041']={code:'01041',name:'伊察姆纳圆盘',type:'asset',cost:3,xp:2,klass:'seeker',
      text:'你获得+1[willpower]。',hasAutoReaction:true,autoByDefault:true,hasReactionPrompt:false}
    session.state.investigators[0].assets=[{id:'disc',code:'01041',exhausted:false}]
  })
  const card=page.locator('.ah-minicard[data-card-code="01041"]')
  await expect(card).toHaveCount(1)
  const mode=card.locator('.ah-reaction-mode')
  const xp=card.locator('.ah-minicard-xp')
  await expect(mode).toBeVisible();await expect(xp).toBeVisible()
  const modeBox=await mode.boundingBox(),xpBox=await xp.boundingBox()
  expect(modeBox).not.toBeNull();expect(xpBox).not.toBeNull()
  expect(markerOverlap(modeBox,xpBox)).toBe(false)
  await page.screenshot({path:output+'xp-card-reaction.png',animations:'disabled'})
  // 窄屏（手机 390）装备卡更窄：按钮仍要在卡内且不压经验角标。
  await page.setViewportSize({width:390,height:844})
  await expect(mode).toBeVisible()
  const modeMobile=await mode.boundingBox(),xpMobile=await xp.boundingBox()
  expect(modeMobile).not.toBeNull();expect(xpMobile).not.toBeNull()
  expect(markerOverlap(modeMobile,xpMobile)).toBe(false)
  expect(modeMobile.x).toBeGreaterThanOrEqual(0)
  expect(errors).toEqual([])
})
function markerOverlap(a,b){return !(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1)}

test('升级版米兰 01533 也有三态按钮（默认 ask，可切 auto）', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:900})
  const f=await fixture(page)
  await f.update(session=>{
    session.state.cards['01533']={code:'01533',name:'米兰·克里斯托弗博士',type:'asset',cost:4,sanity:2,
      klass:'seeker',text:'你获得+1[intellect]。',hasReactionPrompt:true,hasAutoReaction:true,autoByDefault:false}
    session.state.investigators[0].assets=[{id:'milan2',code:'01533',exhausted:false}]
  })
  const card=page.locator('.ah-minicard[data-card-code="01533"]')
  await expect(card).toHaveCount(1)
  const mode=card.locator('.ah-reaction-mode')
  await expect(mode).toHaveCount(1)
  await expect(mode).toHaveAttribute('data-reaction-mode','ask')
  await expect(mode).toHaveText('')
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','auto')
  await expect(mode).toHaveClass(/is-auto/)
  await page.screenshot({path:output+'milan2-card-reaction.png',animations:'disabled'})
  expect(errors).toEqual([])
})

test('角色面板三态按钮：循环 skip/ask/auto、齿轮旋转与长名字省略',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:900})
  const f=await fixture(page)
  // 角色面板的三态按钮；牌桌上的反应卡（如巡警）也有同名按钮，按名字行限定。
  const mode=page.locator('.ah-dock-investigator .ah-reaction-mode')
  await expect(mode).toHaveCount(1)
  await expect(mode).toHaveAttribute('data-reaction-mode','auto')
  await expect(mode).toHaveAttribute('title',/自动触发/)
  await f.update(session=>{
    session.players[0].name='DrLiao'
    session.state.investigators[0].name='普雷斯顿·费尔蒙特·超长名字测试'
  })
  const name=page.locator('.ah-dock-name')
  await expect(name).toHaveAttribute('title','普雷斯顿·费尔蒙特·超长名字测试')
  const text=name.locator('.ah-dock-name-text')
  expect(await text.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true)
  await expect(mode).toBeVisible()
  // 罗兰的无目标纯收益反应默认 auto；三态循环 auto → skip → ask → auto。
  await expect(mode).toHaveClass(/is-auto/)
  expect(await mode.locator('.ah-icon').evaluate(el=>getComputedStyle(el).animationName)).toBe('ah-gear-spin')
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','skip')
  await expect(mode.locator('.ah-reaction-slash')).toHaveCount(1)
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','ask')
  // 再切到 auto 留一张截图；名字恢复成罗兰，避免截图里是测试用的超长名。
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','auto')
  await f.update(session=>{ session.state.investigators[0].name='罗兰·班克斯' })
  await expect(mode).toHaveAttribute('data-reaction-mode','auto')
  await page.screenshot({path:output+'reaction-mode.png',animations:'disabled'})
  expect(errors).toEqual([])
})

test('两态调查员（温蒂）角色面板开关只在 skip/ask 间循环，没有 auto 档',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:900})
  await fixture(page,{investigator:'01005'})
  // 01005 温蒂·亚当斯只有快速反应入口（hasReactionPrompt，没有自动资格）。
  const mode=page.locator('.ah-dock-investigator .ah-reaction-mode')
  await expect(mode).toHaveCount(1)
  await expect(mode).toHaveAttribute('data-reaction-mode','ask')
  await expect(mode).toHaveAttribute('role','switch')
  await expect(mode).toHaveAttribute('aria-checked','true')
  await expect(mode).toHaveAttribute('title','快速反应已开启，点击关闭本局提示')
  await expect(mode).toHaveText('')
  await expect(mode.locator('.ah-icon')).toHaveCount(1)
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','skip')
  await expect(mode).toHaveAttribute('aria-checked','false')
  await expect(mode).toHaveAttribute('title','快速反应已关闭，点击恢复提示')
  await expect(mode.locator('.ah-reaction-slash')).toHaveCount(1)
  await expect(mode).toHaveText('')
  // 再点只回到 ask；两态卡不会进入 auto（不出齿轮、不播旋转动画）。
  await mode.click()
  await expect(mode).toHaveAttribute('data-reaction-mode','ask')
  await expect(mode).toHaveAttribute('aria-checked','true')
  await expect(mode.locator('.ah-icon')).toHaveCount(1)
  expect(await mode.locator('.ah-icon').evaluate(el=>getComputedStyle(el).animationName)).toBe('none')
  expect(errors).toEqual([])
})

test('角色面板头像与三态齿轮同排垂直居中，窄屏不留空白',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:900})
  await fixture(page)
  const gear=page.locator('.ah-dock-investigator .ah-reaction-mode')
  const portrait=page.locator('.ah-dock-investigator .ah-dock-portrait')
  const inv=page.locator('.ah-dock-investigator')
  const row=page.locator('.ah-dock-name-row')
  await expect(gear).toHaveCount(1)
  await expect(portrait).toBeVisible()
  const b={gear:await gear.boundingBox(),portrait:await portrait.boundingBox(),inv:await inv.boundingBox(),row:await row.boundingBox()}
  for(const box of Object.values(b))expect(box).not.toBeNull()
  // 用户反馈「头像和齿轮要对齐」：两者的竖直中心线偏差不超过 1px。
  expect(Math.abs((b.portrait.y+b.portrait.height/2)-(b.gear.y+b.gear.height/2))).toBeLessThanOrEqual(1)
  // 头像在齿轮右侧、不重叠，也不越出调查员列（不压到资源/线索托盘）。
  expect(b.portrait.x).toBeGreaterThanOrEqual(b.gear.x+b.gear.width)
  expect(b.portrait.x+b.portrait.width).toBeLessThanOrEqual(b.inv.x+b.inv.width+0.5)
  // 同排对齐不能把名字行撑高（否则整块面板会向下溢出）。
  expect(b.row.height).toBeLessThanOrEqual(25)
  await page.screenshot({path:output+'dock-avatar-gear-aligned.png',animations:'disabled'})
  // ≤1000px 头像隐藏（noir.css），名字行不能再预留头像位。
  await page.setViewportSize({width:900,height:900})
  await expect(portrait).toBeHidden()
  expect(await row.evaluate(el=>getComputedStyle(el).paddingRight)).toBe('0px')
  expect(errors).toEqual([])
})


