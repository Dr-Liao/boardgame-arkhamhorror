import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'

// 04094 一片漆黑「放在密谋牌库旁」的牌桌验收（桌面 1440 / 移动 390）。
// 真实引擎造一局《幽嘶深渊》，把 2 张漆黑放进 state.agendaAside（与真实显现同一入口），
// 再用浏览器只读渲染这份观察投影。断言：剧本书下沿出现「一片漆黑 ×2」卡堆 →
// 点开公开区域弹窗列出 2 张卡 → 点卡打开完整卡牌详情；局势面板同样能看到漆黑。
const output = fileURLToPath(new URL('../../../artifacts/tfa-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const { createGameState, applyMove, startScenario, scenarioRuntime } = await import('../src/engine/engine.js')
const { viewState } = await import('../src/integration/observation.js')
const { resolveTransaction } = await import('../src/engine/resolution.js')
const { encounterRules } = await import('../content/campaigns/theForgottenAge/encounter-rules.js')

function settleChoices(state) {
  for (let guard = 0; state.pendingChoice && guard < 300; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

// 与引擎 encounter.js 同一入口（behavior.resolveEncounter → 条目 encounterResolve），
// 把 04094 真实放进密谋牌库旁。
function revealDeepDark(state, seat = 0) {
  resolveTransaction(state, seat, { action: 'tfaAgendaAsideBrowser' }, draft => {
    const inv = draft.investigators[seat]
    encounterRules.resolveEncounter(draft, inv, { code: '04094', originalCode: '04094' },
      scenarioRuntime(draft, [], { type: 'encounter', label: '诡计检定', code: '04094' }),
      { location: draft.locations.find(location => location.id === inv.location) || null })
  })
}

function deepDarkView() {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-agenda-aside-browser' },
    [{ seat: 0, role: 'human' }])
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('theDepthsOfYoth'), [])
  settleChoices(state)
  revealDeepDark(state)
  revealDeepDark(state)
  state.phase = 'investigation'
  state.currentSeat = 0
  state.investigators[0].actionsLeft = 3
  state.status = 'playing'
  state.revision = 1
  state.uiState = 'inScenario'
  const view = viewState(state, 0, { includeStatic: true })
  view.revision = 1
  view.uiState = 'inScenario'
  return view
}

async function openView(page, view) {
  let session
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({
      ...body, settings: { ...body.settings, seed: 'tfa-agenda-aside', playerCount: 1,
        teammates: 0, opponents: [], playerInvestigator: '04001', legacyAutoStart: true },
    }) })
    const payload = await response.json()
    if (payload.ok) {
      session = payload.session
      session.state = view
      session.state.revision = 1
    }
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', '1', { timeout: 30_000 })
}

for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`一片漆黑放在密谋牌库旁：${viewport} 端牌桌与公开区域可见`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await openView(page, deepDarkView())

    // 剧本书下沿的卡堆：卡名 + 张数。
    const stack = page.locator('.ah-agenda-aside-card')
    await expect(stack).toBeVisible()
    await expect(stack).toHaveAttribute('data-agenda-aside', '2')
    await expect(stack).toContainText('一片漆黑')
    await expect(stack).toContainText('×2')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    const tableShot = `${output}m5-agenda-aside-table-${viewport}.png`
    await page.screenshot({ path: tableShot, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: tableShot })

    // 点开公开区域弹窗：列出 2 张实体卡。
    await stack.click()
    const zone = page.getByRole('dialog', { name: '密谋牌库旁' })
    await expect(zone).toBeVisible()
    await expect(zone.locator('.ah-card-zone-card')).toHaveCount(2)
    await expect(zone.locator('.ah-card-zone-card').first()).toContainText('一片漆黑')
    const shot = `${output}m5-agenda-aside-${viewport}.png`
    await page.screenshot({ path: shot, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: shot })

    // 弹窗里的卡可以打开完整卡牌详情（卡名没有退化成卡号）。
    await zone.locator('.ah-card-zone-card').first().click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    await expect(detail).toBeVisible()
    await expect(detail).toContainText('一片漆黑')
    await detail.getByRole('button', { name: '关闭卡牌详情' }).click()
    await zone.getByRole('button', { name: '关闭密谋牌库旁' }).click()

    // 局势面板同样能看到漆黑（旧的剧本标记计数已迁移成实体卡）。
    await page.getByRole('button', { name: '局势', exact: true }).click()
    const situation = page.getByRole('dialog', { name: '调查局势' })
    await expect(situation).toBeVisible()
    await expect(situation.locator('.ah-campaign-tfa')).toContainText('漆黑')
    await expect(situation.locator('.ah-campaign-tfa')).toContainText('2 张')
    await page.getByRole('button', { name: '关闭局势详情' }).click()

    expect(errors, JSON.stringify(errors)).toEqual([])
  })
}
