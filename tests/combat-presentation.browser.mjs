import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish', import.meta.url))
mkdirSync(output,{recursive:true})
async function fixture(page) {
  let session
  await page.route('**/api/start',async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:2,playerInvestigator:'01001',seed:'cinematic'}})})
    const body=await response.json();session=body.session
    session.state.pendingChoice=null;session.state.currentSeat=0;session.state.phase='investigation'
    session.state.investigators[0].hand=['01087','01025'];session.state.investigators[0].resources=20
    session.state.legalMoves=[{action:'play',cardId:'01087',label:'装备手电筒'}]
    await route.fulfill({response,json:body})
  })
  await page.route('**/api/session?*',route=>route.fulfill({json:{ok:true,session}}))
  await page.goto('/index.html');await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  await page.getByRole('button',{name:'开始新游戏'}).click()
  await expect(page.locator('.ah-cinematic')).toBeVisible()
  return {get session(){return session},async update(change) {
    change(session);session.state.revision++
    await page.getByRole('button',{name:'刷新局势'}).click()
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision',String(session.state.revision))
  }}
}
test('交战区真实卡牌播放攻击和受击动画，地图保持可见',async({page})=>{
  await page.setViewportSize({width:1440,height:960})
  const f=await fixture(page)
  await page.getByRole('button',{name:'跳过演出'}).click()
  await f.update(s=>{
    const inv=s.state.investigators[0]
    s.state.enemies=[{id:'attack-enemy',code:'ghoulMinion',originalCode:'01160',name:'食尸鬼爪牙',health:3,damageTaken:0,fight:2,evade:2,damage:1,horror:1,location:inv.location,engagedSeat:0}]
    inv.engaged=['attack-enemy']
  })
  await expect.poll(()=>page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
  const enemy=page.locator('.ah-engagement-cards [data-interaction="enemy:attack-enemy"]')
  await expect(enemy.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
  const update=direction=>f.update(s=>{
    const before=structuredClone(s.state),seq=Math.max(-1,...s.events.map(e=>e.seq??-1))+1
    if(direction==='outgoing')s.state.enemies[0].damageTaken++
    else s.state.investigators[0].damage++
    s.events.push({seq,type:'presentation',kind:'attack',direction,seat:0,enemyId:'attack-enemy',name:'食尸鬼爪牙',damage:1,success:true,tableState:before},
      {seq:seq+1,type:'presentation',kind:'checkpoint',tableState:structuredClone(s.state)})
  })
  await update('outgoing')
  await expect(page.locator('.ah-combat-fx.is-impact')).toBeVisible()
  await expect(enemy).toBeVisible()
  await expect(page.locator('.ah-cinematic')).toHaveCount(0)
  await page.screenshot({path:output+'combat-outgoing.png'})
  await expect.poll(()=>page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
  await update('incoming')
  await expect(page.locator('.ah-combat-fx.is-impact')).toBeVisible()
  await expect(page.locator('.ah-combat-caption')).toContainText('受到「食尸鬼爪牙」攻击')
  await page.screenshot({path:output+'combat-incoming.png'})
  await expect.poll(()=>page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
})

test('开场依次拍脸故事导入与初始密谋卡',async({page})=>{
  const f=await fixture(page),scene=page.locator('.ah-cinematic')
  await expect(scene).toHaveAccessibleName('故事导入')
  await scene.getByRole('button',{name:'继续',exact:true}).click()
  await expect(scene).toHaveAccessibleName('密谋揭示')
  await expect(scene.locator('.ah-cinematic-detail')).toContainText(f.session.state.agendas[0].text)
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-art-code',f.session.state.agendas[0].originalCode||f.session.state.agendas[0].code)
})

test('全屏幕卡导入、正常和非行动手牌置灰，反应窗口仍可投入',async({page})=>{
  await page.setViewportSize({width:1440,height:960})
  const f=await fixture(page), scene=page.locator('.ah-cinematic')
  await expect(scene.getByRole('button',{name:'暂停',exact:true})).toHaveCount(0)
  await expect(scene).toHaveAccessibleName('故事导入')
  await expect(scene.locator('.ah-cinematic-detail')).toContainText('1925年9月18日')
  await expect(scene.locator('.ah-cinematic-detail')).toContainText('讨论这些怪异的事件')
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-art-code',f.session.state.acts[0].originalCode||f.session.state.acts[0].code)
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
  await expect(scene.locator('.ah-table-art img')).toBeVisible()
  await scene.locator('.ah-table-art img').evaluate(img=>img.decode())
  expect(await scene.locator('.ah-table-art img').evaluate(img=>getComputedStyle(img).objectFit)).toBe('contain')
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(true)
  await page.screenshot({path:output+'combat-story-intro.png',animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  expect(await scene.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await expect(scene.getByRole('button',{name:'跳过演出'})).toBeInViewport()
  await expect(scene.locator('.ah-table-art img')).toBeInViewport()
  const storyText=scene.locator('.ah-cinematic-detail')
  await storyText.evaluate(el=>{el.scrollTop=el.scrollHeight})
  expect(await storyText.evaluate(el=>Math.abs(el.scrollHeight-el.scrollTop-el.clientHeight)<2)).toBe(true)
  await page.screenshot({path:output+'combat-story-intro-mobile.png',animations:'disabled'})
  await page.setViewportSize({width:1440,height:960})
  await scene.getByRole('button',{name:'跳过演出'}).click()
  const cards=page.locator('.ah-hand-card')
  await expect(cards.nth(0)).toHaveAttribute('data-card-available','true')
  await expect(cards.nth(1)).toHaveAttribute('data-card-available','false')
  expect(await cards.nth(1).locator('.ah-table-art').evaluate(el=>getComputedStyle(el).filter)).toContain('grayscale(1)')
  await expect(cards.nth(1)).toHaveAttribute('aria-description','技能牌仅能在技能检定时投入。')
  await cards.nth(1).hover()
  await expect(page.locator('.ah-card-inspection-reason')).toHaveText('技能牌仅能在技能检定时投入。')
  await cards.nth(1).click()
  await expect(page.locator('.ah-context-reason')).toHaveText('技能牌仅能在技能检定时投入。')
  await f.update(s=>{s.state.currentSeat=1;s.state.legalMoves=[]})
  await expect(page.locator('.ah-hand-card.ah-card-unavailable')).toHaveCount(2)
  await cards.nth(1).click({button:'right'})
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await f.update(s=>{
    s.state.pendingChoice={id:'commit-test',kind:'commit',seat:0,options:[{id:'1',label:'投入技能'}]}
    s.state.legalMoves=[{action:'choose',choiceId:'commit-test',optionId:'1',label:'投入技能'}]
  })
  await expect(cards.nth(1)).toHaveAttribute('data-card-available','true')
  await expect(cards.nth(0)).toHaveAttribute('data-card-available','false')
})

test('悬浮预览完整显示横向场景和密谋，竖向卡牌及窄屏不裁切',async({page})=>{
  await page.setViewportSize({width:1440,height:960})
  await fixture(page)
  await page.getByRole('button',{name:'跳过演出'}).click()
  const preview=page.locator('.ah-card-inspection')
  const checkPreview=async(landscape)=>{
    await expect(preview).toBeVisible()
    const img=preview.locator('img:not([hidden])')
    await img.evaluate(el=>el.decode())
    await expect.poll(()=>img.evaluate(el=>getComputedStyle(el).objectFit)).toBe('contain')
    const dimensions=await img.evaluate(el=>{
      const r=el.getBoundingClientRect(), p=el.closest('.ah-card-inspection').getBoundingClientRect()
      return {ratio:el.naturalWidth/el.naturalHeight,boxRatio:r.width/r.height,left:r.left,top:r.top,right:r.right,bottom:r.bottom,p:{left:p.left,top:p.top,right:p.right,bottom:p.bottom}}
    })
    expect(dimensions.boxRatio).toBeCloseTo(dimensions.ratio,1)
    expect(dimensions.ratio>1).toBe(landscape)
    expect(dimensions.left).toBeGreaterThanOrEqual(dimensions.p.left)
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.p.right)
    expect(dimensions.bottom).toBeLessThanOrEqual(dimensions.p.bottom)
    expect(dimensions.top).toBeGreaterThanOrEqual(0)
    expect(dimensions.right).toBeLessThanOrEqual(page.viewportSize().width)
    expect(dimensions.bottom).toBeLessThanOrEqual(page.viewportSize().height)
  }
  for(const card of await page.locator('.ah-story-book .ah-script-card').all()){
    await expect(card.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
    await card.hover();await checkPreview(true)
  }
  await page.screenshot({path:output+'story-hover-complete.png',animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  await page.mouse.move(0,0)
  await page.locator('.ah-story-book .ah-script-card').first().hover()
  await checkPreview(true)
  await page.locator('.ah-reference-card').hover();await checkPreview(false)
  await page.setViewportSize({width:900,height:420})
  await page.mouse.move(0,0)
  await page.locator('.ah-reference-card').hover()
  await checkPreview(false)
})

test('故事幕等待玩家手动继续，经过一分钟也不会自动关闭',async({page})=>{
  await fixture(page)
  const scene=page.locator('.ah-cinematic')
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
  await page.clock.install()
  await page.clock.fastForward(60000)
  await expect(scene).toBeVisible()
  await scene.getByRole('button',{name:'继续',exact:true}).click()
  await expect(scene).toHaveCount(0)
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
})

test('局内查看信息和选牌重绘不会把已加载卡图换回占位块',async({page})=>{
  await fixture(page)
  await page.getByRole('button',{name:'跳过演出'}).click()
  const selector='.ah-story-book .ah-table-art,.ah-map-node .ah-table-art,.ah-hand-card .ah-table-art,.ah-command-roster .ah-table-art'
  await expect.poll(()=>page.locator(selector).evaluateAll(nodes=>nodes.every(el=>el.dataset.imageState==='displayable'))).toBe(true)
  await page.locator(selector).evaluateAll(nodes=>{window.tableImages=nodes})
  const stable=()=>page.evaluate(async()=>{
    for(let i=0;i<5;i++) {
      await new Promise(requestAnimationFrame)
      if(!window.tableImages.every(el=>el.isConnected && el.dataset.imageState==='displayable'))return false
    }
    return true
  })
  await page.getByRole('button',{name:'局势',exact:true}).click()
  expect(await stable()).toBe(true)
  await page.getByRole('button',{name:'关闭局势详情'}).click()
  await page.locator('.ah-hand-card').first().click()
  expect(await stable()).toBe(true)
  await page.locator('.ah-script-card[data-interaction="act:current"]').click()
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  expect(await stable()).toBe(true)
  await page.clock.install()
  await page.clock.fastForward(60000)
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
})
test('批量返回的自动阶段按事件顺序演出，重绘不重播，减弱动效保留说明',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  const f=await fixture(page)
  await page.getByRole('button',{name:'跳过演出'}).click()
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2026-01-01T00:00:00Z'))
  const events=[
    {kind:'phase',phase:'enemy',round:1,text:'猎手开始行动'},
    {kind:'automatic',phase:'enemy',round:1,text:'食尸鬼攻击罗兰',code:'01160',effect:'attack',damage:1,horror:1},
    {kind:'phase',phase:'upkeep',round:1,text:'重整所有卡牌'},
    {kind:'automatic',phase:'upkeep',round:1,text:'罗兰抽取 1 张牌，获得 1 资源'},
    {kind:'phase',phase:'mythos',round:2,text:'密谋增加 1 点毁灭'},
    {kind:'story',title:'密谋推进',name:'黑暗降临',code:'01105',face:'back',flip:true,text:'翻页结算'},
  ]
  await f.update(s=>{for(const cue of events)s.events.push({seq:s.events.length,type:'info',text:cue.text,presentation:cue})})
  await page.clock.runFor(100)
  const scene=page.locator('.ah-phase-scene,.ah-cinematic')
  await expect(scene).toHaveAttribute('data-phase','enemy')
  await expect(page.locator('.ah-cinematic')).toHaveCount(0)
  const bounds=await scene.boundingBox(), viewport=await page.locator('.ah-map-viewport').boundingBox()
  expect(bounds.width*bounds.height).toBeLessThan(viewport.width*viewport.height/2)
  await expect(scene.getByRole('button',{name:'下一步',exact:true})).toHaveCount(0)
  await page.clock.runFor(1400)
  await expect(scene.locator('.ah-cinematic-detail')).toHaveText('食尸鬼攻击罗兰')
  await expect(scene.locator('.ah-cinematic-hit')).toHaveText('♥ 1  ·  ◈ 1')
  await expect(page.locator('.ah-phase-world-cue[data-effect="attack"]')).toBeVisible()
  await expect(page.locator('.ah-phase-ring')).toBeVisible()
  expect(await scene.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
  await expect(scene.locator('.ah-table-art img')).toBeVisible()
  await scene.locator('.ah-table-art img').evaluate(img=>img.decode())
  await page.screenshot({path:output+'combat-enemy-sequence.png',animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  await page.clock.runFor(60)
  await expect(scene).toBeInViewport()
  await expect(scene.getByRole('button',{name:'跳过演出',exact:true})).toBeInViewport()
  expect((await scene.boundingBox()).height).toBeLessThan((await page.locator('.ah-map-viewport').boundingBox()).height*.6)
  await expect(page.locator('.ah-phase-world-cue[data-effect="attack"]')).toBeInViewport()
  await expect(page.locator('.ah-phase-ring')).toBeInViewport()
  await page.screenshot({path:output+'combat-map-phase-mobile.png',animations:'disabled'})
  await page.setViewportSize({width:1400,height:950})
  await page.clock.runFor(60)
  await page.clock.runFor(1400)
  await expect(scene).toHaveAttribute('data-phase','upkeep')
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true})
    document.dispatchEvent(new Event('visibilitychange'))
    delete document.hidden
  })
  await page.clock.runFor(1400)
  await expect(scene.locator('.ah-cinematic-detail')).toContainText('获得 1 资源')
  await page.clock.runFor(1400)
  await expect(scene).toHaveAttribute('data-phase','mythos')
  await page.clock.runFor(1400)
  await expect(scene).toHaveAccessibleName('密谋推进')
  await expect(page.locator('.ah-phase-world-cue')).toHaveCount(0)
  await scene.getByRole('button',{name:'跳过演出'}).click()
  await expect(scene).toHaveCount(0)
  await page.getByRole('button',{name:'刷新局势'}).click()
  await expect(scene).toHaveCount(0)
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
})

test('顶部阶段提示无溢出，遭遇牌堆抽牌翻面，检定来源和逐次混乱抽取可见',async({page})=>{
  await page.setViewportSize({width:1440,height:960})
  const f=await fixture(page)
  await page.getByRole('button',{name:'跳过演出'}).click()
  await expect(page.locator('.ah-encounter-deck img')).toBeVisible()
  const source={label:'遭遇检定',name:'腐烂残骸',code:'01163'}
  await f.update(s=>{
    s.state.skillTest={seat:0,skill:'willpower',difficulty:3,printedValue:2,baseValue:3,value:3,stage:'ST.2',committed:[],source}
    s.state.pendingChoice={id:'encounter-test',kind:'commit',seat:0,prompt:'罗兰·班克斯的意志检定：投入手牌后可检定或求助。',options:[{id:'done',label:'开始检定'}]}
    s.state.legalMoves=[{action:'choose',choiceId:'encounter-test',optionId:'done'}]
  })
  await expect(page.locator('.ah-test-context')).toHaveText('遭遇检定 · 腐烂残骸')
  await expect(page.locator('.ah-test-preview strong')).toContainText('意志 2')
  await expect(page.locator('.ah-test-modifier')).toHaveText('+1')
  await expect(page.locator('.ah-test-preview')).toHaveAttribute('aria-label','意志：基础 2，修正 +1，当前 3，难度 3')
  await page.locator('.ah-test-source').click()
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await page.screenshot({path:output+'encounter-test-context.png',animations:'disabled'})
  await f.update(s=>{
    for(const cue of [
      {kind:'automatic',phase:'upkeep',round:1,effect:'resource',seat:1,delta:1,text:'黛西·沃克获得 1 资源（当前 4）。'},
      {kind:'automatic',phase:'mythos',round:2,effect:'encounter',seat:0,code:'01163',name:'腐烂残骸',text:'罗兰·班克斯遭遇「腐烂残骸」'},
      {kind:'chaos',token:'skull',seat:0,name:'罗兰·班克斯',skill:'willpower',difficulty:3,source},
      {kind:'chaos',token:'-1',seat:0,name:'罗兰·班克斯',skill:'willpower',difficulty:3,source},
      {kind:'test',drawn:['-1'],success:false,name:'罗兰·班克斯',skill:'willpower',difficulty:3,value:2,source},
    ])s.events.push({seq:s.events.length,type:'presentation',...cue})
  })
  const scene=page.locator('.ah-phase-scene')
  await expect(scene).toHaveAttribute('data-phase','upkeep')
  expect((await scene.boundingBox()).y).toBeLessThan(100)
  expect(await scene.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1)).toBe(true)
  expect((await scene.locator('.ah-cinematic-counter').boundingBox()).width).toBeLessThanOrEqual(60)
  await page.screenshot({path:output+'upkeep-top-panel.png',animations:'disabled'})
  await expect(scene).toHaveAttribute('data-phase','mythos')
  await expect(scene.locator('.ah-encounter-reveal-back')).toBeVisible()
  await expect(scene.locator('.ah-encounter-reveal-back')).toHaveCount(0)
  await expect(scene.locator('.is-encounter .ah-table-art')).toHaveAttribute('data-image-state','displayable')
  await expect(scene.locator('.ah-cinematic-detail')).toContainText('腐烂残骸')
  await page.screenshot({path:output+'encounter-draw-reveal.png',animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  await expect(scene.getByRole('button',{name:'跳过演出',exact:true})).toBeInViewport()
  await expect(scene.locator('.is-encounter img:not([hidden])')).toBeInViewport()
  expect(await scene.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:output+'encounter-draw-mobile.png',animations:'disabled'})
  const chaos=page.locator('.ah-chaos-reveal')
  await expect(chaos).toHaveAttribute('data-token','skull')
  await expect(chaos).toHaveAttribute('data-revealed','true')
  await expect(chaos.locator('.ah-chaos-reveal-token')).toHaveAccessibleName('骷髅')
  await expect(chaos.locator('.ah-chaos-reveal-token img')).toHaveAttribute('src',/ct-skull\.png$/)
  expect(await chaos.locator('.ah-chaos-reveal-token img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true)
  await expect(chaos).toContainText('腐烂残骸')
  await page.screenshot({path:output+'chaos-draw-mobile.png',animations:'disabled'})
  await chaos.getByRole('button',{name:'继续',exact:true}).click()
  await expect(chaos).toHaveAttribute('data-token','-1')
  await expect(chaos).toHaveAttribute('data-revealed','true')
  await chaos.getByRole('button',{name:'继续',exact:true}).click()
  await expect(page.locator('.ah-fx-banner')).toContainText('检定失败')
  await expect(chaos).toHaveCount(0)
})
