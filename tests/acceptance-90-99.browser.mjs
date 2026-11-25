import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { stashBeneath } from '../src/engine/commit-origins.js'
import { viewEvents, viewState } from '../src/integration/observation.js'
import { asset, enemy, fixture, legalMoves, move } from './core-fixture.mjs'

const output = fileURLToPath(new URL('../artifacts/acceptance/90-99/', import.meta.url))
mkdirSync(output, { recursive: true })

async function openHall(page) {
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
}

async function openTable(page, engine) {
  let session
  const introSkip = page.getByRole('dialog').filter({ hasNotText: '密谋推进' }).getByRole('button', { name: '跳过演出' })
  await page.addLocatorHandler(introSkip, button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({
      modId: 'arkhamhorror',
      settings: { legacyAutoStart: true, playerCount: 1, seed: 'acceptance-90-99' },
    }) })
    const body = await response.json()
    session = body.session
    engine.legalMoves = legalMoves(engine, 0)
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
  test(`90019 从手牌打出后立即推进密谋 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('90017')
    engine.investigators[0].hand = ['90019']
    engine.doom = engine.agendas[0].doomThreshold - 1
    await openTable(page, engine)
    await page.locator('[data-interaction="hand:0:0"]').first().click()
    await page.locator('[data-interaction="zone:play"].ah-drop-valid').click()
    await page.getByRole('button', { name: '正常支付', exact: true }).click()
    await page.getByRole('dialog', { name: '密谋推进', exact: true }).getByRole('button', { name: '继续', exact: true }).click()
    await page.getByRole('button', { name: '每位调查员随机弃掉 1 张手牌', exact: true }).click()
    await expect.poll(() => engine.agendaIndex).toBe(1)
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(engine.revision))
    await page.screenshot({ path: `${output}/90019-${width}.png`, animations: 'disabled' })
  })

  test(`90030 从武器选择目标，击败敌人后补回子弹 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('90024')
    const weapon = asset(engine, '90030')
    const target = enemy(engine, { fight: 6, health: 2, damage: 0, horror: 0 })
    engine.locations.find(location => location.id === engine.investigators[0].location).clues = 0
    await openTable(page, engine)
    await page.locator(`[data-interaction="asset:${weapon.id}"]`).first().click()
    await page.getByRole('button', { name: /射击.*测试敌人/ }).click()
    await page.getByRole('button', { name: '开始检定', exact: true }).click()
    await expect.poll(() => engine.enemies.some(item => item.id === target.id)).toBe(false)
    expect(engine.investigators[0].assets.find(item => item.id === weapon.id).uses).toBe(4)
    await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(engine.revision))
    await page.screenshot({ path: `${output}/90030-${width}.png`, animations: 'disabled' })
  })

  test(`98020 只可选择同特质暗置牌并降低检定难度 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const engine = fixture('98019')
    asset(engine, '98020')
    const foe = enemy(engine, { code: 'ghoulMinion', originalCode: '01160', fight: 4 })
    stashBeneath(engine, 0, '98019', 'ghoulMinion', 3)
    stashBeneath(engine, 0, '98019', 'dissonantVoices', 3)
    move(engine, { action: 'fight', enemyId: foe.id })
    await openTable(page, engine)
    await page.getByRole('button', { name: /弃掉同特质的暗置遭遇牌/ }).first().click()
    await expect(page.locator('[data-option-id="dissonantVoices"]')).toHaveCount(0)
    await page.locator('[data-option-id="ghoulMinion"]').first().click()
    await expect.poll(() => Boolean(engine.lastTestResult || engine.pendingChoice?.options.some(option => option.id === 'done'))).toBe(true)
    if (engine.pendingChoice) await page.getByRole('button', { name: '开始检定', exact: true }).click()
    await expect.poll(() => engine.lastTestResult?.difficulty).toBe(2)
    expect(engine.encounterDiscard).toContain('ghoulMinion')
    await page.screenshot({ path: `${output}/98020-${width}.png`, animations: 'disabled' })
  })

  test(`99001 的大厅重印显示路径复核，并检查挑战入口 (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openHall(page)
    const setup = page.locator('.ah-hub-setup')
    await setup.locator('#ah-campaign-picker-open').click()
    const picker = page.locator('.ah-campaign-picker')
    await picker.locator('#ah-campaign-tab-sideStories').click()
    const challenges = ['readOrDie', 'allOrNothing', 'badBlood', 'byTheBook',
      'redTideRising', 'laidToRest', 'relicsOfThePast', 'enthrallingEncore']
    for (const id of challenges) await expect(picker.locator(`[data-campaign-id="${id}"]`)).toBeVisible()
    await page.screenshot({ path: `${output}/challenges-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    const hub = page.locator('.ah-hub')
    await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
    await expect(hub.locator('.ah-office-candidate-shell[data-code="05006"]')).toBeVisible()
    await expect(hub.locator('.ah-office-candidate-shell[data-code="99001"]')).toHaveCount(0)
    await hub.locator('.ah-office-candidate-shell[data-code="05006"] .ah-office-candidate').click()
    await expect(hub.locator('.ah-hub-seat h2').first()).toContainText(/玛丽/)
    await page.screenshot({ path: `${output}/99001-roster-${width}.png`, animations: 'disabled' })
  })
}
