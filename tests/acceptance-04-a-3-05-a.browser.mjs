import { expect, test } from '@playwright/test'
import { contentRegistry } from '../content/registered.js'
import { applyMove, createGameState, legalMoves, placeDoomOnCard, placeLocation, playerWindow, scenarioRuntime, startScenario } from '../src/engine/engine.js'
import { addBreach, breachOf } from '../src/engine/location-state.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState } from '../src/integration/observation.js'
import { asset, fixture, move, settle } from './core-fixture.mjs'
import { behavior as depths } from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js'

function launch(campaignId, scenarioId) {
  const state = createGameState({ campaignId, campaignHub: true, seed: 'acceptance-04-a-3-05-a' },
    [{ seat: 0, role: 'human' }])
  startScenario(state, contentRegistry.getCampaign(campaignId).scenarioIds.indexOf(scenarioId), [])
  settle(state)
  return state
}

async function openTable(page, state, answer) {
  let session
  function refresh() {
    state.legalMoves = legalMoves(state, 0)
    session.state = viewState(state, 0, { includeStatic: true })
  }
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({
      modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, seed: 'card-acceptance' },
    }) })
    const payload = await response.json()
    session = payload.session
    refresh()
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  if (answer) await page.route('**/api/move', async route => {
    answer(route.request().postDataJSON().move)
    refresh()
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
}

for (const [width, height] of [[1440, 950], [390, 844]]) {
  test(`04299 瓦卢西亚之子在 ${width}px 的密谋牌库旁可查看实体与详情`, async ({ page }, info) => {
    const state = launch('theForgottenAge', 'theDepthsOfYoth')
    const card = { code: '04299', originalCode: '04299' }
    for (let copy = 0; copy < 2; copy++) {
      expect(depths.resolveEncounter(state, state.investigators[0], card, scenarioRuntime(state, [])))
        .toEqual({ placed: true })
    }
    await page.setViewportSize({ width, height })
    await openTable(page, state)
    const stack = page.locator('[data-agenda-aside="2"]')
    await expect(stack).toContainText('瓦卢西亚之子')
    await stack.click()
    const zone = page.getByRole('dialog', { name: '密谋牌库旁' })
    await expect(zone.locator('.ah-card-zone-card')).toHaveCount(2)
    await zone.locator('.ah-card-zone-card').first().click()
    await expect(page.getByRole('dialog', { name: '卡牌详情' })).toContainText('瓦卢西亚之子')
    await page.screenshot({ path: info.outputPath(`04299-${width}.png`), animations: 'disabled' })
  })

  test(`05301 商人区在 ${width}px 的玩家窗口可支付资源移动裂口`, async ({ page }, info) => {
    const state = launch('theCircleUndone', 'inTheClutchesOfChaos')
    const locationId = 'merchantDistrictB'
    if (!state.locations.some(location => location.id === locationId)) placeLocation(state, locationId, [])
    const location = state.locations.find(entry => entry.id === locationId)
    location.revealed = true
    const inv = state.investigators[0]
    inv.location = locationId
    inv.hand = []
    inv.assets = []
    inv.resources = 3
    addBreach(state, locationId, 1)
    const initialBreaches = breachOf(location)
    const initialActBreaches = breachOf(state.acts[state.actIndex])
    const execute = draft => playerWindow(draft, 'test.beforeCommit', [], null, {})
    resolveTransaction(state, 0, { action: 'clutches-fast-window' }, execute)
    const pending = state.pendingChoice
    expect(pending?.kind).toBe('playerWindow')
    const optionId = 'scenario-fast:locMerchantPay:'
    expect(pending.options.find(option => option.id === optionId)?.reactionSourceCode).toBe('05301')
    await page.setViewportSize({ width, height })
    await openTable(page, state, command => resolveTransaction(state, 0, command, execute))
    const panel = page.locator('.ah-choice')
    await expect(panel).toHaveAttribute('data-choice-id', pending.id)
    const button = panel.locator(`[data-option-id="${optionId}"]`)
    await expect(button).toBeEnabled()
    await page.screenshot({ path: info.outputPath(`05301-${width}.png`), animations: 'disabled' })
    const result = page.waitForResponse('**/api/move')
    await button.click()
    expect((await result).ok()).toBe(true)
    await expect(panel).toHaveCount(0)
    expect(state.investigators[0].resources).toBe(1)
    expect(breachOf(state.locations.find(entry => entry.id === locationId))).toBe(initialBreaches - 1)
    expect(breachOf(state.acts[state.actIndex])).toBe(initialActBreaches + 1)
    expect(state.pendingChoice).toBeNull()
  })
}

for (const [width, height] of [[1440, 950], [390, 844]]) {
  test(`05237 幸运或是注定在 ${width}px 的议程毁灭窗口可发动`, async ({ page }, info) => {
    const state = fixture('01001')
    state.investigators[0].hand = ['05237']
    const playerAsset = asset(state, '05235', { doom: 0 })
    resolveTransaction(state, 0, { action: 'place-player-asset-doom' }, draft => {
      const target = draft.investigators[0].assets.find(item => item.id === playerAsset.id)
      placeDoomOnCard(draft, target, 1, [])
    })
    expect(state.pendingChoice).toBeNull()
    const execute = draft => placeDoomOnCard(draft, draft.agendas[draft.agendaIndex], 1, [])
    resolveTransaction(state, 0, { action: 'place-scenario-doom' }, execute)
    const pending = state.pendingChoice
    const option = pending?.options.find(item => item.cardCode === '05237')
    expect(option).toBeTruthy()
    await page.setViewportSize({ width, height })
    await openTable(page, state, command => resolveTransaction(state, 0, command, execute))
    const panel = page.locator('.ah-choice')
    await expect(panel).toHaveAttribute('data-choice-id', pending.id)
    const button = page.getByRole('button', { name: '幸运或是注定，选择手牌', exact: true })
    await expect(button).toBeEnabled()
    await page.screenshot({ path: info.outputPath(`05237-${width}.png`), animations: 'disabled' })
    const response = page.waitForResponse('**/api/move')
    await button.click()
    expect((await response).ok()).toBe(true)
    await expect(panel).toHaveCount(0)
    expect(state.agendas[state.agendaIndex].doom).toBe(0)
    expect(state.exiled).toContain('05237')
  })

  test(`05189 秘密卷轴在 ${width}px 可选择遭遇牌库底并弃置该牌`, async ({ page }, info) => {
    const state = fixture('01001')
    const scroll = asset(state, '05189', { uses: 4, usesType: 'secrets' })
    state.encounterDeck = ['01159', '01166', '01159']
    const activate = legalMoves(state, 0).find(entry => entry.action === 'ability' && entry.assetId === scroll.id)
    move(state, activate)
    await page.setViewportSize({ width, height })
    await openTable(page, state, command => applyMove(state, 0, command))
    const panel = page.locator('.ah-choice')
    for (const option of ['encounter', 'bottom', 'discard']) {
      const button = panel.locator(`[data-option-id="${option}"]`)
      await expect(button).toBeEnabled()
      if (option === 'discard') {
        await expect(panel.locator('[data-option-id="hand"]')).toHaveCount(0)
        await page.screenshot({ path: info.outputPath(`05189-${width}.png`), animations: 'disabled' })
      }
      const response = page.waitForResponse('**/api/move')
      await button.click()
      expect((await response).ok()).toBe(true)
    }
    await expect(panel).toHaveCount(0)
    expect(state.encounterDeck).toEqual(['01166', '01159'])
    expect(state.encounterDiscard).toEqual(['01159'])
  })
}
