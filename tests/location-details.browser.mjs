import { test, expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { mkdirSync } from 'node:fs'
const output = 'artifacts/arkham-polish/'
mkdirSync(output,{recursive:true})

async function fixture(page) {
  let session
  const submitted=[]
  await page.route('**/api/start', async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:1,playerInvestigator:'01001',seed:'location-details'}})})
    const payload=await response.json(); session=payload.session
    const st=session.state
    st.pendingChoice=null; st.currentSeat=0; st.phase='investigation'; st.enemies=[]
    st.locations=['hallway','attic','cellar'].map(id=>({...scenario.locations[id],revealed:id!=='attic',clues:id==='cellar'?2:0,maxClues:2}))
    st.investigators[0].location='cellar'
    st.legalMoves=[{action:'investigate',label:'调查地窖'},{action:'move',locationId:'hallway',label:'移动到走廊'}]
    await route.fulfill({response,json:payload})
  })
  await page.route('**/api/session?*',route=>route.fulfill({json:{ok:true,session}}))
  await page.route('**/api/move',route=>{submitted.push(route.request().postDataJSON());session.state.revision++;return route.fulfill({json:{ok:true,session}})})
  await page.goto('/index.html');await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  await page.getByRole('button',{name:'开始新游戏'}).click()
  await page.getByRole('button',{name:'跳过演出'}).click()
  return {session,submitted,async update(fn){fn(session);session.state.revision++;await page.getByRole('button',{name:'刷新局势'}).click();await expect(page.locator('.ah-table')).toHaveAttribute('data-revision',String(session.state.revision))}}
}

test('地点正反面、资源档案、相邻地点与直接行动保持一致',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const f=await fixture(page)
  const cellar=page.locator('.ah-map-node[data-location-id="cellar"]'), attic=page.locator('.ah-map-node[data-location-id="attic"]')
  await expect(cellar.locator('.ah-table-art[data-art-code="01114"] img')).toHaveAttribute('src',/01114\.avif/)
  await expect(attic.locator('.ah-table-art[data-art-code="01113"] img')).toHaveAttribute('src',/01113b\.avif/)
  await cellar.locator('[data-map-info="clues"]').click()
  const modal=page.locator('.ah-location-detail')
  await expect(modal.locator('h2')).toHaveText('地窖')
  await expect(modal.locator('.ah-location-detail-art img')).toHaveAttribute('src',/01114\.avif/)
  await expect(modal.locator('[data-location-stat="clues"].is-focused strong')).toHaveText('2')
  await expect(modal.locator('.ah-location-entry-effect')).toContainText('受到 1 点伤害')
  await expect(modal.locator('.ah-location-rules')).toContainText('强制')
  await expect(modal).not.toContainText('undefined')
  await expect(modal).not.toContainText('未映射')
  await page.screenshot({path:output+'location-dossier-desktop.png',animations:'disabled'})
  await modal.getByRole('button',{name:'未揭示',exact:true}).click()
  await expect(modal.locator('.ah-location-detail-art img')).toHaveAttribute('src',/01114b\.avif/)
  await expect(modal.locator('.ah-location-entry-effect')).not.toContainText('受到 1 点伤害')
  await expect(modal.locator('.ah-location-rules')).toContainText('薄冰')
  await modal.getByRole('button',{name:'→ 走廊'}).click()
  await modal.getByRole('button',{name:'→ 阁楼'}).click()
  await expect(modal.getByRole('button',{name:'已揭示',exact:true})).toBeDisabled()
  await expect(modal.locator('.ah-location-detail-art img')).toHaveAttribute('src',/01113b\.avif/)
  await expect(modal.locator('[data-location-stat="shroud"] strong')).toHaveText('？')
  await expect(modal.locator('.ah-location-rules')).not.toContainText('恐惧')
  await modal.getByRole('button',{name:'关闭卡牌详情'}).click()
  await cellar.click({button:'right'})
  await page.setViewportSize({width:390,height:844})
  expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:output+'location-dossier-mobile.png',animations:'disabled'})
  await modal.getByRole('button',{name:'调查地窖',exact:true}).click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move.action).toBe('investigate')
  expect(errors).toEqual([])
})

test('调查员详情使用卡面反应、旧印与技能符号，规则链接保持可用',async({page})=>{
  await fixture(page)
  await page.locator('.ah-map-investigator').click()
  const modal=page.locator('.ah-carddetail-modal')
  await expect(modal).toBeVisible()
  const reaction=modal.locator('.ah-card-full-text [data-card-symbol="reaction"]')
  const elderSign=modal.locator('.ah-card-full-text [data-card-symbol="elder_sign"]')
  await expect(reaction).toHaveAttribute('aria-label','反应')
  await expect(elderSign).toHaveAttribute('aria-label','旧印')
  await expect(reaction.locator('.ah-card-glyph')).toHaveText('y')
  await expect(elderSign.locator('.ah-card-glyph')).toHaveText('X')
  for(const [skill,glyph] of Object.entries({willpower:'A',intellect:'F',combat:'D',agility:'S'})) {
    await expect(modal.locator(`.ah-card-full-stats [data-card-symbol="${skill}"] .ah-card-glyph`)).toHaveText(glyph)
  }
  expect(await page.evaluate(async()=>{
    await document.fonts.load('20px AHCardSymbols','yXAFDS')
    return document.fonts.check('20px AHCardSymbols','yXAFDS')
  })).toBe(true)
  await expect(modal.locator('.ah-detail-layout > .ah-art img')).toBeVisible()
  await page.screenshot({path:output+'investigator-card-symbols.png',animations:'disabled'})
  await reaction.click()
  await expect(page.locator('.ah-rulebook')).toBeVisible()
})

test('地点揭示全屏显示完整正面和进入效果，手动继续且刷新不重播',async({page})=>{
  const f=await fixture(page)
  await f.update(s=>{
    const loc=s.state.locations.find(l=>l.id==='attic');loc.revealed=true;loc.clues=2
    s.events.push({seq:s.events.length,type:'info',text:'阁楼被揭示',presentation:{kind:'location',location:'attic',code:'01113',name:'阁楼',title:'地点揭示',flip:true,shroud:1,clues:2,onEnter:{horror:1},text:'强制 — 你进入阁楼后：受到1点恐惧。'}})
  })
  const scene=page.locator('.ah-location-reveal')
  await expect(scene).toHaveCount(1)
  await expect(scene.locator('h1')).toHaveText('阁楼')
  await expect(scene.locator('.ah-table-art img')).toHaveAttribute('src',/01113\.avif/)
  await expect(scene.locator('.ah-location-reveal-stats')).toContainText('进入后受到 1 点恐惧')
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable');await scene.locator('img').evaluate(img=>img.decode());
  await page.screenshot({path:output+'location-reveal-desktop.png',animations:'disabled'})
  await page.clock.install();await page.clock.fastForward(60000)
  await expect(scene).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await expect(scene.getByRole('button',{name:'继续',exact:true})).toBeInViewport()
  await expect(scene.locator('.ah-table-art img')).toBeInViewport()
  expect(await scene.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:output+'location-reveal-mobile.png',animations:'disabled'})
  await scene.getByRole('button',{name:'继续',exact:true}).click()
  await expect(scene).toHaveCount(0)
  await f.update(()=>{})
  await expect(scene).toHaveCount(0)
})
test('地图小卡显示实际标记，数量更新与清除同步且保留点击详情',async({page})=>{
  const f=await fixture(page)
  await f.update(s=>{
    s.state.enemies=[{id:'marked-acolyte',code:'acolyte',originalCode:'01169',name:'祭司',type:'enemy',location:'hallway',health:3,fight:3,evade:2,damage:1,horror:1,damageTaken:2,doom:1,
      attachedTreacheries:['02096'],smiteTheWickedSeat:0,bindMonster:{code:'02031',ownerSeat:0},engagedSeat:null}]
    s.state.storyAssets=[{id:'marked-lita',code:'01117',location:'hallway',controllerSeat:null,doom:2,damage:1}]
    s.state.investigators[0].assets=[{id:'marked-gun',code:'01016',uses:2,doom:1,damage:1,horror:1,resources:2,counters:3,attached:['01087'],exhausted:false}]
    s.state.investigators[0].threat=[{id:'marked-threat',code:'01163',doom:2,resources:1,counters:1,counterType:'horror'}]
    s.state.investigators[0].damage=1;s.state.investigators[0].horror=5
    s.state.locations.find(loc=>loc.id==='hallway').searchingForIzzieSeat=0
  })
  const enemy=page.locator('.ah-location-entities [data-interaction="enemy:marked-acolyte"]')
  const doom=enemy.locator('[data-card-marker="doom"]')
  await expect(doom).toBeVisible()
  await expect(doom).toHaveAttribute('aria-label','毁灭 1')
  await expect(enemy.locator('[data-card-marker="damage"]')).toHaveAttribute('aria-label','伤害 2')
  await expect(enemy.locator('[data-card-marker="horror"]')).toHaveCount(0)
  await expect(enemy.locator('[data-card-marker="attached"]')).toHaveAttribute('aria-label','附属卡 3')
  await expect(page.locator('.ah-map-investigator .ah-card-markers')).toHaveCount(0)
  await expect(page.locator('.ah-roster-character .ah-card-markers')).toHaveCount(0)
  await expect(page.locator('[data-location-id="hallway"] [data-attachment-code="02011"]')).toBeVisible()
  const story=page.locator('.ah-map-story-marker')
  await expect(story.locator('[data-card-marker="doom"]')).toHaveAttribute('aria-label','毁灭 2')
  await expect(story.locator('[data-card-marker="damage"]')).toBeVisible()
  const asset=page.locator('[data-interaction="asset:marked-gun"]').filter({visible:true}).first()
  for(const kind of ['uses','doom','damage','horror','resources','counters','attached']) await expect(asset.locator(`[data-card-marker="${kind}"]`)).toBeVisible()
  const threat=page.locator('[data-interaction="asset:marked-threat"]').filter({visible:true}).first()
  await expect(threat.locator('[data-card-marker="doom"]')).toHaveAttribute('aria-label','毁灭 2')
  await expect(threat.locator('[data-card-marker="counters"]')).toHaveAttribute('aria-label','恐惧 1')
  for(const width of [1400,390]) {
    await page.setViewportSize({width,height:950})
    await expect(doom).toBeVisible()
    expect(await enemy.evaluate(el=>[...el.querySelectorAll('.ah-card-marker')].every(marker=>{
      const card=el.getBoundingClientRect(), token=marker.getBoundingClientRect()
      return token.width>0 && token.height>0 && token.left>=card.left && token.right<=card.right+1 && token.top>=card.top && token.bottom<=card.bottom+1
    }))).toBe(true)
    await page.screenshot({path:output+`map-card-markers-${width}.png`,animations:'disabled'})
  }
  await page.setViewportSize({width:1400,height:950})
  await enemy.click()
  let detail=page.locator('.ah-carddetail-modal')
  await expect(detail.locator('[data-runtime-marker="damage"]')).toHaveAttribute('aria-label','伤害 2')
  for(const code of ['02096','02007','02031']) await expect(detail.locator(`.ah-detail-attachment-card[data-attachment-code="${code}"]`)).toBeVisible()
  await detail.locator('.ah-detail-attachment-card[data-attachment-code="02007"]').click()
  await expect(detail.locator('.ah-runtime-host')).toContainText('祭司')
  await expect(detail).toContainText('击退邪恶')
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await asset.click({button:'right'})
  detail=page.locator('.ah-carddetail-modal')
  await expect(detail.locator('[data-runtime-marker="doom"]')).toHaveAttribute('aria-label','毁灭 1')
  await expect(detail.locator('.ah-detail-attachment-card')).toHaveAttribute('data-attachment-code','01087')
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await f.update(s=>{s.state.enemies[0].doom=12;s.state.enemies[0].damageTaken=0})
  await expect(doom).toHaveAttribute('aria-label','毁灭 12')
  await expect(enemy.locator('[data-card-marker="damage"]')).toHaveCount(0)
  await f.update(s=>{s.state.enemies[0].doom=0})
  await expect(enemy.locator('.ah-card-markers')).toHaveCount(1)
  await expect(enemy.locator('.ah-card-marker')).toHaveCount(1)
  await expect(enemy.locator('[data-card-marker="attached"]')).toHaveAttribute('aria-label','附属卡 3')
})

test('队友进入地点仅显示地图提示并自动消失，不打开全屏弹窗',async({page})=>{
  const f=await fixture(page)
  f.session.players.push({seat:1,role:'ai',name:'队友'})
  f.session.state.investigators.push({...structuredClone(f.session.state.investigators[0]),seat:1,name:'黛西·沃克'})
  await f.update(s=>{
    s.events.push({seq:s.events.length,type:'info',text:'黛西进入阁楼',presentation:{kind:'location',seat:1,location:'attic',code:'01113',name:'阁楼',title:'进入地点',onEnter:{horror:1}}})
  })
  await expect(page.locator('.ah-location-notice')).toContainText('黛西·沃克')
  await expect(page.locator('.ah-location-notice')).toContainText('受到 1 点恐惧')
  await expect(page.locator('.ah-location-reveal')).toHaveCount(0)
  await page.screenshot({path:output+'teammate-location-notice.png'})
  await expect(page.locator('.ah-location-notice')).toHaveCount(0,{timeout:5000})
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(false)
})
