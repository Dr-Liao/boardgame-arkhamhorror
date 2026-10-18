import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { deckBuilderData } from '../src/deck/deckbuilding.js'

// A long upgrade round isolates presentation from campaign progression/AI timing.
async function upgrades(page, filterFixture=false) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId:'arkhamhorror', settings:{legacyAutoStart:true,playerCount:1,playerInvestigator:'01001',seed:'upgrade-scroll'} }) })
    const payload = await response.json(); session = payload.session
    const st = session.state
    st.hubFlow=true;st.uiState='interlude';st.pendingChoice=null;st.currentSeat=0;st.round=2
    session.events=[]
    const cards=Object.entries(ALL_CARDS).map(([code,card])=>({...card,code}))
      .filter(c=>['asset','event','skill'].includes(c.type))
    const added=cards.slice(0,30), removed=cards.slice(30,150)
    for (const card of [...added,...removed]) st.cards[card.code]={...card,name:card.nameZh || card.name}
    for (const card of [added[0], removed[0]]) Object.assign(st.cards[card.code], {
      traits:['Practiced'],traitsZh:['精通'],text:'English upgrade text.',textZh:'中文升级说明。',
    })
    if(filterFixture) added.forEach((card,index)=>{
      // Distinct sources exercise both campaign grouping and exact packs.
      Object.assign(st.cards[card.code],{pack:['core','dwl','tmm'][index%3],packName:['基础包','敦威治遗产','米斯卡托尼克博物馆'][index%3],type:index%2?'event':'asset',klass:'guardian',cost:index%5,xp:index%6})
    })
    st.campaign.investigators[0]={...st.campaign.investigators[0],xp:20,status:'active',deck:removed.map(c=>c.code)}
    st.legalMoves=added.flatMap(a=>removed.map(r=>({action:'hubPurchase',added:a.code,removed:r.code,label:'升级（1 XP）',explanation:'花费 1 XP'})))
    await route.fulfill({response,json:payload})
  })
  await page.route('**/api/session?*', route=>route.fulfill({json:{ok:true,session}}))
  await page.route('**/api/move', async route=>{
    const move=route.request().postDataJSON().move
    session.state.revision++
    session.state.campaign.investigators[0].upgradeDraft={record:{xp:19},changes:[{...move,cost:1}]}
    session.state.legalMoves.push(
      {action:'hubConfirmUpgrades',label:'保存升级方案'},
      {action:'hubCancelUpgrades',label:'撤销本轮升级'},
    )
    await route.fulfill({json:{ok:true,session}})
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  await page.getByRole('button',{name:'开始新游戏'}).click()
  await expect(page.locator('.ah-hub')).toHaveAttribute('data-ui-state','interlude')
}
const offset = locator=>locator.evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}))
test('存档管理操作后保持内层列表和弹窗滚动位置',async({page})=>{
  const sessions=Array.from({length:14},(_,index)=>({
    sessionId:`scroll-save-${index}`,modId:'arkhamhorror',mode:'solo',online:false,
    campaignId:'nightOfTheZealot',campaignName:'夜之狂热',uiState:'campaignHub',
    playerCount:1,humanCount:1,aiCount:0,savedAt:new Date(1790000000000-index*1000).toISOString(),
    compatible:true,needsMigration:false,
    investigators:[{code:'01001',name:`罗兰·班克斯 ${index+1}`}],
  }))
  await page.route('**/api/sessions',route=>route.fulfill({json:{ok:true,persist:true,sessions}}))
  await page.setViewportSize({width:390,height:700})
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  const setup=page.locator('.ah-hub-setup')
  await setup.getByRole('button',{name:'存档管理'}).click()
  const list=setup.locator('.ah-save-list')
  await expect(list.locator('.ah-save-item')).toHaveCount(sessions.length)
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight;window.saveListScroll=el.scrollTop})
  await setup.evaluate(el=>{el.scrollTop=el.scrollHeight;window.saveModalScroll=el.scrollTop})
  expect(await page.evaluate(()=>window.saveListScroll)).toBeGreaterThan(0)
  const last=list.locator('.ah-save-item').last()
  await last.getByRole('button',{name:'删除',exact:true}).click()
  await expect(last.getByRole('button',{name:'确认删除此存档'})).toBeVisible()
  expect(await list.evaluate(el=>el.scrollTop)).toBe(await page.evaluate(()=>window.saveListScroll))
  expect(await setup.evaluate(el=>el.scrollTop)).toBe(await page.evaluate(()=>window.saveModalScroll))
})

for(const width of [1440,390]) test(`升级选卡、替换、暂存和详情保持滚动位置 ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900})
  await upgrades(page)
  const hub=page.locator('.ah-hub'),gallery=hub.locator('.ah-office-upgrade-gallery'),options=hub.locator('.ah-office-upgrade-options')
  const descriptions=hub.locator('.ah-upgrade-card-description')
  await expect(descriptions.first()).toContainText('精通')
  await expect(descriptions.last()).toContainText('中文升级说明')
  expect((await descriptions.allTextContents()).join(' ')).not.toContain('English upgrade text')
  const comparisonColumns=hub.locator('.ah-upgrade-comparison > div:not(.ah-upgrade-cost)')
  const [leftCard,rightCard]=await Promise.all([comparisonColumns.first().boundingBox(),comparisonColumns.last().boundingBox()])
  expect(Math.abs(leftCard.y-rightCard.y)).toBeLessThanOrEqual(1)
  const cardArtButtons=hub.locator('.ah-upgrade-comparison .ah-upgrade-card-art')
  const [leftArt,rightArt]=await Promise.all([cardArtButtons.first().boundingBox(),cardArtButtons.last().boundingBox()])
  expect(Math.abs(leftArt.y-rightArt.y)).toBeLessThanOrEqual(1)
  await expect(hub.locator('.ah-upgrade-inspect')).toHaveCount(0)
  const card=gallery.getByRole('button').last()
  await card.scrollIntoViewIfNeeded()
  const before=await offset(gallery)
  expect(width===390?before.left:before.top).toBeGreaterThan(100)
  await card.click()
  await expect(card).toHaveAttribute('aria-pressed','true')
  expect(await offset(gallery)).toEqual(before)
  await expect(card).toBeFocused()
  const replacement=options.getByRole('button').last()
  await replacement.scrollIntoViewIfNeeded()
  const listBefore=await offset(options)
  expect(listBefore.top).toBeGreaterThan(0)
  await replacement.click()
  await expect(replacement).toHaveAttribute('aria-pressed','true')
  expect(await offset(options)).toEqual(listBefore)
  expect(await offset(gallery)).toEqual(before)
  await expect(replacement).toBeFocused()
  const inspect=hub.locator('.ah-upgrade-card-art').last()
  await inspect.scrollIntoViewIfNeeded()
  const hubBefore=await offset(hub)
  await inspect.click()
  const detail=page.getByRole('dialog',{name:'卡牌详情'})
  await expect(detail).toBeVisible()
  await detail.getByRole('button',{name:'关闭卡牌详情'}).click()
  expect(await offset(hub)).toEqual(hubBefore)
  expect(await offset(gallery)).toEqual(before)
  expect(await offset(options)).toEqual(listBefore)
  await page.keyboard.press('F1')
  await expect(page.getByRole('dialog',{name:'游戏规则书'})).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await offset(hub)).toEqual(hubBefore)
  await hub.getByRole('button',{name:'加入升级方案，花费 1 XP'}).click()
  await expect(hub.locator('.ah-upgrade-preview')).toContainText('已加入 1 次升级')
  await expect(hub.getByRole('button',{name:'撤销所有更改'})).toBeVisible()
  await expect(hub.getByRole('button',{name:'保存升级方案',exact:true})).toBeVisible()
  expect(await offset(gallery)).toEqual(before)
  expect(await offset(options)).toEqual(listBefore)
  // Switching pages is a new context, so old scroll positions must not leak.
  await hub.getByRole('button',{name:'战役总览',exact:true}).evaluate(el=>el.click())
  await hub.getByRole('button',{name:'升级',exact:true}).evaluate(el=>el.click())
  expect(await offset(gallery)).toEqual({top:0,left:0})
})

for(const width of [1440,390]) test(`升级页面复用筛选并按战役与扩展包组合过滤 ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900})
  await upgrades(page,true)
  const hub=page.locator('.ah-hub'),filters=hub.locator('[data-filter-scope="upgrade"]'),cards=hub.locator('.ah-office-upgrade-gallery > button')
  await expect(cards).toHaveCount(30)
  await filters.getByLabel('筛选经验',{exact:true}).selectOption('2')
  await expect(cards).toHaveCount(5)
  await filters.getByLabel('筛选经验',{exact:true}).selectOption('')
  await expect(cards).toHaveCount(30)
  await filters.getByLabel('筛选战役',{exact:true}).selectOption('dwl')
  await expect(cards).toHaveCount(20)
  await filters.getByLabel('筛选扩展包',{exact:true}).selectOption('tmm')
  await expect(cards).toHaveCount(10)
  await filters.getByRole('button',{name:'事件',exact:true}).click()
  await expect(cards).toHaveCount(5)
  await filters.getByLabel('筛选费用',{exact:true}).selectOption('4+')
  await expect(cards).toHaveCount(1)
  await cards.first().click()
  await expect(filters.getByLabel('筛选战役',{exact:true})).toHaveValue('dwl')
  await filters.getByRole('textbox',{name:'搜索卡牌'}).fill('没有这种卡牌')
  await expect(cards).toHaveCount(0)
  await expect(hub.getByText('没有符合筛选条件的卡牌，请调整或清除筛选。')).toBeVisible()
  await expect(hub.getByRole('button',{name:/加入升级方案/})).toHaveCount(0)
  await filters.getByRole('button',{name:'清除筛选'}).click()
  await expect(cards).toHaveCount(30)
  await filters.getByLabel('筛选扩展包',{exact:true}).selectOption('tmm')
  await filters.getByLabel('筛选战役',{exact:true}).selectOption('core')
  await expect(filters.getByLabel('筛选扩展包',{exact:true})).toHaveValue('')
  await expect(cards).toHaveCount(10)
  expect(await hub.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await filters.scrollIntoViewIfNeeded()
  await page.screenshot({path:fileURLToPath(new URL(`../../../artifacts/arkham-polish/upgrade-filters-${width}.png`,import.meta.url)),animations:'disabled'})
})

test('升级页面按住 Alt 悬停卡牌显示放大图与说明',async({page})=>{
  await upgrades(page)
  const hub=page.locator('.ah-hub'),zoom=page.locator('.ah-card-zoom')
  for (const card of [hub.locator('.ah-office-upgrade-gallery > button').nth(2),hub.locator('.ah-upgrade-comparison .ah-upgrade-card-art').last()]) {
    await card.hover()
    await page.keyboard.down('Alt')
    await expect(zoom).toBeVisible()
    await expect(zoom).toHaveAttribute('data-zoom-for',await card.getAttribute('data-zoom-code'))
    await expect(zoom.locator('.ah-card-zoom-text h3')).toHaveText(await card.getAttribute('data-zoom-name'))
    await expect(zoom.locator('.ah-card-zoom-loading')).toHaveCount(0)
    await page.keyboard.up('Alt')
    await expect(zoom).toHaveCount(0)
  }
  await hub.locator('.ah-office-upgrade-gallery > button').nth(2).hover()
  await page.keyboard.down('Alt')
  await page.screenshot({path:fileURLToPath(new URL('../../../artifacts/arkham-polish/upgrade-card-zoom.png',import.meta.url)),animations:'disabled'})
  await page.keyboard.up('Alt')
})

test('构筑页面使用真实卡源筛选且不改变牌组',async({page})=>{
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  const setup=page.locator('.ah-hub-setup')
  await setup.getByText('玩家人数').locator('..').locator('select').selectOption('1')
  await setup.getByRole('button',{name:'开始新游戏'}).click()
  const hub=page.locator('.ah-hub')
  await hub.getByRole('button',{name:'选择调查员',exact:true}).click()
  await hub.getByRole('button',{name:/选择调查员：罗兰/}).click()
  await hub.getByRole('button',{name:'卡组构筑',exact:true}).click()
  await hub.getByRole('button',{name:/手动构筑/}).click()
  const modal=page.locator('.ah-db-modal'),filters=modal.locator('[data-filter-scope="deck"]'),cards=modal.locator('.ah-db-card')
  const total=await cards.count()
  expect(total).toBeGreaterThan(5)
  await filters.getByLabel('筛选战役',{exact:true}).selectOption('core')
  await filters.getByLabel('筛选扩展包',{exact:true}).selectOption('core')
  const data=deckBuilderData(),allowed=data.investigators.find(inv=>inv.code==='01001').allowedCards
  await expect(cards).toHaveCount(data.cardPool.filter(card=>allowed.includes(card.code)&&ALL_CARDS[card.code]?.pack==='core').length)
  await filters.getByRole('button',{name:'资产',exact:true}).click()
  await filters.getByLabel('筛选费用',{exact:true}).selectOption('4+')
  const subset=await cards.count()
  expect(subset).toBeGreaterThan(0);expect(subset).toBeLessThan(total)
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('0/30')
  await filters.getByRole('button',{name:'清除筛选'}).click()
  await expect(cards).toHaveCount(total)
})
