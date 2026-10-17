import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish', import.meta.url))
mkdirSync(output, { recursive: true })

test('出发页检查全队准备，局外显示队友名称与图片头像', async ({ page }) => {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { playerCount: 1, seed: 'departure' } }) })
    const body = await response.json(); session = body.session
    const st = session.state
    st.uiState = 'scenarioSetup'; st.hubReady = true; st.hubSeatSelected = { 0: true, 1: true }; st.hubSeatDone = { 0: true }
    st.investigators.push({ ...structuredClone(st.investigators[0]), seat: 1, code: '01002', name: '黛西·沃克', klass: 'seeker' })
    for (const inv of st.investigators) st.campaign.investigators[inv.seat] = { code: inv.code, status: 'active', deck: ['01087'], xp: 0 }
    st.campaign.investigators[1].deckSize = 33
    delete st.campaign.investigators[1].deck
    session.players.push({ seat: 1, role: 'ai', name: '才羽桃', avatar: '/avatars/momoi.webp', aiId: 'ai-ling' })
    st.legalMoves = [{ action: 'hubBeginScenario', label: '开始当前关卡' }]
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub'), nav = hub.getByRole('navigation', { name: '战役局外页面' })
  await nav.getByRole('button', { name: '开始关卡', exact: true }).click()
  await expect(hub.getByRole('button', { name: '开始当前关卡' })).toBeDisabled()
  await expect(hub.locator('[data-player-seat="1"]')).toHaveText('才羽桃')
  await expect(hub.locator('[data-player-seat="1"] img')).toHaveAttribute('src', '/avatars/momoi.webp')
  await expect(hub.locator('.ah-departure-member[data-seat="1"] .is-done')).toHaveCount(2)
  session.state.hubSeatDone[1] = true
  await hub.getByRole('button', { name: '刷新', exact: true }).click()
  await expect(hub.getByRole('button', { name: '开始当前关卡' })).toBeEnabled()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(nav.getByRole('button', { name: '开始关卡', exact: true })).toBeInViewport()
    await expect(hub.getByRole('button', { name: '开始当前关卡' })).toBeInViewport()
    await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
    await page.screenshot({ path: output + `hub-departure-${width}.png`, animations: 'disabled' })
  }
  for (const name of ['战役总览', '调查员与席位']) {
    await nav.getByRole('button', { name, exact: true }).click()
    await expect(hub.locator('[data-player-seat="1"]')).toHaveText('才羽桃')
    await expect(hub.getByText('AI 队友', { exact: true })).toHaveCount(0)
    await expect(hub.locator('[data-player-seat="1"] img')).toBeVisible()
  }
})

test('真实四人流程：三个队友自动组牌与准备，玩家点击开始进入关卡', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('4')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: /自动构筑/ }).click()
  let release, submissions=0
  const gate=new Promise(resolve=>{release=resolve})
  await page.route('**/api/move',async route=>{
    if(route.request().postDataJSON()?.move?.action!=='hubDoneSeat')return route.continue()
    submissions++
    const response=await route.fetch()
    await gate
    await route.fulfill({response})
  })
  const prepared = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubDoneSeat')
  await hub.getByRole('button', { name: '确认准备', exact: true }).first().click()
  await expect(hub.locator('.ah-hub-preparing')).toBeVisible()
  await expect(hub.getByRole('navigation', { name: '战役局外页面' }).getByRole('button', { name: '开始关卡', exact: true })).toHaveAttribute('aria-current','page')
  // The move response is still delayed. Read-only progress polling must show
  // server-committed preparation while leaving the start action disabled.
  await expect(hub.locator('.ah-hub-preparing')).toContainText('全队已就绪。你是房主，现在可以开始关卡。')
  await expect(hub.locator('.ah-departure-member.is-ready')).toHaveCount(4)
  await expect(hub.getByRole('button',{name:'开始当前关卡'})).toBeDisabled()
  expect(submissions).toBe(1)
  release()
  const result = await (await prepared).json()
  expect(result.ok).toBe(true)
  const st = result.session.state
  expect(st.uiState).toBe('scenarioSetup')
  expect(st.hubReady).toBe(true)
  expect(st.currentSeat).toBe(0)
  expect(new Set(st.investigators.map(inv => inv.code)).size).toBe(4)
  for (let seat = 1; seat < 4; seat++) {
    expect(st.hubSeatDone[seat]).toBe(true)
    expect(st.campaign.investigators[seat].deckSize).toBeGreaterThan(0)
    expect(st.campaign.investigators[seat].deck).toBeUndefined()
  }
  await expect(hub.locator('.ah-departure-member.is-ready')).toHaveCount(4)
  await expect(hub.getByRole('button', { name: '开始当前关卡' })).toBeEnabled()
  await expect(hub.locator('.ah-hub-preparing')).toHaveCount(0)
  const started = page.waitForResponse(response => response.url().endsWith('/api/move') && response.request().postDataJSON()?.move?.action === 'hubBeginScenario')
  await hub.getByRole('button', { name: '开始当前关卡' }).click()
  const game = await (await started).json()
  expect(game.ok).toBe(true)
  expect(game.session.state.uiState).toBe('inScenario')
  expect(game.session.state.pendingChoice.kind).toBe('mulligan')
  await expect(page.locator('.ah-table')).toBeVisible()
  await expect(page.locator('.ah-cinematic')).toBeVisible()
})
test('出发前选择真人队长，队长未确认禁止开局且不提供 AI 候选',async({page})=>{
  let session,submitted=[]
  await page.route('**/api/start',async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{playerCount:3,seed:'leader-picker'}})})
    const payload=await response.json();session=payload.session
    session.players[1].role='human';session.players[1].name='同行玩家'
    const s=session.state;s.uiState='scenarioSetup';s.phase='scenarioSetup';s.hubReady=true;s.hubSeatDone={0:true,1:true,2:true};s.campaign.leadConfirmed=false
    for(const inv of s.investigators)s.campaign.investigators[inv.seat]={code:inv.code,status:'active',deckSize:33}
    s.legalMoves=[0,1].map(leadSeat=>({action:'hubSetLeader',leadSeat,label:'设为队长'}))
    await route.fulfill({response,json:payload})
  })
  await page.route('**/api/session?*',route=>route.fulfill({json:{ok:true,session}}))
  await page.route('**/api/move',route=>{
    const m=route.request().postDataJSON().move;submitted.push(m)
    session.state.campaign.leadSeat=m.leadSeat;session.state.campaign.leadConfirmed=true;session.state.revision++
    session.state.legalMoves.push({action:'hubBeginScenario',label:'开始当前关卡'})
    return route.fulfill({json:{ok:true,session}})
  })
  await page.goto('/index.html');await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click();await page.getByRole('button',{name:'开始新游戏'}).click()
  await page.getByRole('button',{name:'开始关卡',exact:true}).click()
  const picker=page.getByRole('region',{name:'选择队长'}),start=page.getByRole('button',{name:'开始当前关卡'})
  await expect(start).toBeDisabled();await expect(picker.locator('button')).toHaveCount(2)
  await picker.locator('button').filter({hasText:'同行玩家'}).click()
  await expect(start).toBeEnabled()
  expect(submitted[0]).toMatchObject({action:'hubSetLeader',leadSeat:1})
  await expect(picker.locator('button[aria-pressed="true"]')).toContainText('同行玩家')
})
