import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { placeLocation } from '../src/engine/engine.js'
import { starterInvestigators } from '../src/deck/starter-packs.js'
import { enemy, fixture, legalMoves, move } from './core-fixture.mjs'
import { viewEvents, viewState } from '../src/integration/observation.js'

const output = fileURLToPath(new URL('../artifacts/acceptance/60-a/', import.meta.url))
mkdirSync(output, { recursive: true })

async function openHall(page) {
  // 卡面媒体与本轮规则验收独立，使用本地回退以避免测试写入缩略图缓存。
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
}

async function openTable(page, engine) {
  let session
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: engine.investigators.length, seed: 'acceptance-60-a',
    } }) })
    const body = await response.json()
    session = body.session
    session.state = viewState(engine, 0)
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    const events = viewEvents(move(engine, route.request().postDataJSON().move), 0)
    const firstSeq = Math.max(-1, ...(session.events || []).map(event => event.seq ?? -1)) + 1
    session.events = [...(session.events || []), ...events.map((event, index) => ({ ...event, seq: firstSeq + index }))]
    session.state = viewState(engine, 0)
    await route.fulfill({ json: { ok: true, session } })
  })
  await openHall(page)
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
}

for (const width of [1440, 390]) {
  test(`60227 寻找答案在牌桌选择本地与相连地点各一条线索 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('01002')
    for (const id of ['attic', 'hallway']) {
      placeLocation(engine, id, [])
      Object.assign(engine.locations.find(location => location.id === id), { revealed: true, clues: 2, shroud: 1 })
    }
    Object.assign(engine.investigators[0], { hand: ['60227'], location: 'attic', clues: 0 })
    engine.legalMoves = legalMoves(engine, 0)
    await openTable(page, engine)
    await page.locator('[data-interaction="hand:0:0"]').first().click()
    await page.locator('[data-interaction="zone:play"].ah-drop-valid').click()
    await page.getByRole('button', { name: /开始检定/ }).first().click()
    const choice = page.locator('.ah-choice')
    await expect(choice).toContainText('选择要发现一个线索的地点')
    const map = page.getByRole('region', { name: '地点地图' })
    const attic = map.getByRole('button', { name: '阁楼', exact: true })
    const hallway = map.getByRole('button', { name: '走廊', exact: true })
    await expect(attic).toBeVisible()
    await expect(hallway).toBeVisible()
    await page.screenshot({ path: `${output}/60227-${width}.png`, animations: 'disabled' })
    const firstChoice = engine.pendingChoice.id
    await hallway.click()
    await expect.poll(() => engine.pendingChoice?.id).not.toBe(firstChoice)
    await expect(choice).toHaveAttribute('data-choice-id', engine.pendingChoice.id)
    await expect(choice.locator('[data-option-id="attic"]')).toBeEnabled()
    await attic.click()
    await expect.poll(() => engine.investigators[0].clues).toBe(2)
    expect(['attic', 'hallway'].map(id => engine.locations.find(location => location.id === id).clues)).toEqual([1, 1])
  })

  test(`十位入门包调查员可在真实大厅选择 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openHall(page)
    const setup = page.locator('.ah-hub-setup')
    await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    const hub = page.locator('.ah-hub')
    await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
    await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
    for (const code of starterInvestigators) {
      const name = ALL_CARDS[code].nameZh.replace(/^\*/, '').split(/[·・]/)[0].trim()
      await expect(hub.getByRole('button', { name: '选择调查员：' + name, exact: false }).first()).toBeVisible()
    }
    await hub.getByRole('button', { name: /选择调查员：托米/ }).first().click()
    await hub.getByRole('button', { name: /使用推荐卡组/ }).first().click()
    await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
    await expect(hub.getByRole('heading', { name: /卡组/ }).first()).toBeVisible()
    expect(await hub.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `${output}/lobby-${width}.png`, animations: 'disabled' })
  })

  test(`60216 / 60416 / 60206 / 60457 手牌操作调用真实引擎 (${width})`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width, height: 900 })
    const codes = ['60216', '60206', '60457', '60416']
    const engine = fixture('01002', 1, { campaignId: 'theDunwichLegacy' })
    engine.investigators[0].clues = 0
    engine.investigators[0].hand = [...codes]
    engine.locations.find(location => location.id === engine.investigators[0].location).clues = 5
    engine.chaosBag = ['skull', 'cultist', 'autofail']
    engine.legalMoves = legalMoves(engine, 0)
    await openTable(page, engine)
    for (const code of codes) await test.step(`打出 ${code}`, async () => {
      const handIndex = engine.investigators[0].hand.indexOf(code)
      await page.locator(`[data-interaction="hand:0:${handIndex}"]`).first().click()
      const playTarget = page.locator('[data-interaction="zone:play"].ah-drop-valid, [data-interaction^="slot:"].ah-drop-valid').first()
      await expect(playTarget).toBeVisible()
      await playTarget.click()
      await expect.poll(() => ALL_CARDS[code].type === 'event'
        ? engine.investigators[0].discard.includes(code)
        : engine.investigators[0].assets.some(asset => asset.code === code)).toBe(true)
      await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(engine.revision))
    })
    expect(engine.investigators[0].clues).toBe(2)
    expect(engine.investigators[0].hand).toHaveLength(0)
    await page.screenshot({ path: `${output}/events-${width}.png`, animations: 'disabled' })
  })

  test(`60218 / 60263 重印保留原版打出条件与抽牌 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('01002')
    const inv = engine.investigators[0]
    inv.hand = ['60218', '60263']
    engine.locations.find(location => location.id === inv.location).clues = 1
    engine.legalMoves = legalMoves(engine, 0)
    await openTable(page, engine)
    for (const code of ['60218', '60263']) {
      await page.locator('[data-interaction="hand:0:0"]').first().click()
      const playArea = page.locator('[data-interaction="zone:play"].ah-drop-valid')
      await expect(playArea).toBeVisible()
      await playArea.click()
      await expect.poll(() => engine.investigators[0].discard.includes(code)).toBe(true)
      await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(engine.revision))
    }
    expect(engine.investigators[0].hand).toHaveLength(6)
    await page.screenshot({ path: `${output}/alias-events-${width}.png`, animations: 'disabled' })
  })

  test(`60226 可在行动后快速窗口直接点牌并抽一张 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('01002', 1, { campaignId: 'theDunwichLegacy' })
    const inv = engine.investigators[0]
    inv.hand = ['60226']
    move(engine, { action: 'resource' })
    expect(engine.pendingChoice?.options.some(option => option.id === 'fast-card:60226')).toBe(true)
    await openTable(page, engine)
    const offer = page.locator('.ah-hand [data-option-id="fast-card:60226"]').first()
    await expect(offer).toBeVisible()
    await offer.click()
    await expect.poll(() => engine.investigators[0].discard.includes('60226')).toBe(true)
    expect(engine.investigators[0].hand).toHaveLength(1)
    expect(engine.investigators[0].actionsLeft).toBe(19)
    await page.screenshot({ path: `${output}/60226-${width}.png`, animations: 'disabled' })
  })

  test(`60118 可从两位同地点队友中指定获益对象 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('01001', 3)
    engine.investigators[0].hand = ['60118']
    engine.legalMoves = legalMoves(engine, 0)
    await openTable(page, engine)
    await page.locator('[data-interaction="hand:0:0"]').first().click()
    await page.locator('[data-interaction="zone:play"].ah-drop-valid').click()
    const choices = page.locator('.ah-choice')
    await expect(choices).toContainText('选择与谁共享资源')
    await expect(choices.locator('[data-option-id="1"]')).toBeVisible()
    await choices.locator('[data-option-id="2"]').click()
    await expect.poll(() => engine.investigators.map(inv => inv.resources)).toEqual([32 - ALL_CARDS['60118'].cost, 30, 32])
    await page.screenshot({ path: `${output}/60118-${width}.png`, animations: 'disabled' })
  })

  for (const [code, action] of [['60119', 'fight'], ['60219', 'investigate']]) {
    test(`${code} 重印可从手牌投入真实检定 (${width})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const engine = fixture(action === 'fight' ? '01001' : '01002')
      engine.investigators[0].hand = [code]
      engine.locations.find(location => location.id === engine.investigators[0].location).clues = 3
      const target = action === 'fight' ? enemy(engine, { fight: 0 }) : null
      move(engine, { action, ...(target && { enemyId: target.id }) })
      expect(engine.pendingChoice?.kind).toBe('commit')
      await openTable(page, engine)
      const hand = page.locator('[data-interaction="hand:0:0"]').first()
      const commit = page.locator('[data-interaction="zone:commit"]')
      await hand.dragTo(commit)
      await expect.poll(() => engine.investigators[0].hand.includes(code)).toBe(false)
      await page.getByRole('button', { name: /开始检定/ }).first().click()
      await expect.poll(() => engine.investigators[0].discard.includes(code)).toBe(true)
      if (target) expect(engine.enemies.find(item => item.id === target.id).damageTaken).toBe(2)
      else expect(engine.investigators[0].clues).toBe(2)
      await page.screenshot({ path: `${output}/${code}-${width}.png`, animations: 'disabled' })
    })
  }
}
