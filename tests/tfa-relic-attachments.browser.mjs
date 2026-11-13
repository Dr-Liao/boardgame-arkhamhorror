import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'

// 破碎永世 4a「古代遗物」附属地点牌桌验收（桌面 1440 / 移动 390）。
// 玩家报告：看不到古代遗物牌上已经附属了几处地点。真实引擎进入《破碎永世》后，
// 把遗物支援与 1 处已附属地点注入（与检定成功后的状态形状一致），再用浏览器只读渲染
// 这份观察投影。断言：
//   1. 牌桌上的遗物卡显示「附属 1」角标；
//   2. 遗物卡详情列出正面朝下附属的「姆大陆」；
//   3. 剧本卡顶沿 / 推进按钮显示 1 / 2（单人局目标 = 人数 + 1）；
//   4. 局势面板显示遗物附属地点 1 / 2 处；
//   5. 桌面与移动端都不能横向溢出。
const output = fileURLToPath(new URL('../../../artifacts/tfa-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const { createGameState, applyMove, startScenario } = await import('../src/engine/engine.js')
const { viewState } = await import('../src/integration/observation.js')

function relicAttachmentView() {
  const state = createGameState({ campaignId: 'theForgottenAge', campaignHub: true, seed: 'tfa-relic-attachments' },
    [{ seat: 0, role: 'human' }])
  const scenarioIds = contentRegistry.getCampaign('theForgottenAge').scenarioIds
  startScenario(state, scenarioIds.indexOf('shatteredAeons'), [])
  for (let guard = 0; state.pendingChoice && guard < 300; guard++) {
    const pending = state.pendingChoice
    const optionId = ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  // 幕 4a：遗物已由玩家控制；「姆大陆」在上一次行动中检定成功附属到遗物。
  state.actIndex = 3
  state.relicOfAges = { code: '04061', location: null, seat: 0 }
  state.investigators[0].assets.push({ id: 'relic-asset', code: '04061', originalCode: '04061', exhausted: false })
  state.scenarioFlags.relicUnderneath = [{ id: 'mu', code: '04332', name: '姆大陆', victory: 1 }]
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
      ...body, settings: { ...body.settings, seed: 'tfa-relic-attachments', playerCount: 1,
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
  test(`破碎永世古代遗物：附属地点数量与目标进度在${viewport}端可见`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await openView(page, relicAttachmentView())

    // 1. 牌桌：遗物支援卡上有「附属 1」角标。
    const relicCard = page.locator('.ah-minicard[data-card-code="04061"]')
    await expect(relicCard).toBeVisible()
    const marker = relicCard.locator('[data-card-marker="attached"]')
    await expect(marker).toBeVisible()
    await expect(marker).toContainText('1')
    const tableShot = `${output}m6-relic-attachments-table-${viewport}.png`
    await page.screenshot({ path: tableShot, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: tableShot })

    // 2. 右键打开遗物卡详情：列出正面朝下附属的「姆大陆」。
    await relicCard.click({ button: 'right' })
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    await expect(detail).toBeVisible()
    // 运行时状态在卡面下方，弹窗自身滚动：滚到底再断言，避免只存在于「被裁掉的下半页」。
    await detail.evaluate(el => { el.scrollTop = el.scrollHeight })
    const runtime = detail.locator('.ah-runtime-card-state')
    await expect(runtime).toBeVisible()
    const attachments = runtime.locator('.ah-detail-attachments')
    await expect(attachments).toBeVisible()
    await expect(attachments).toContainText('附属卡（1）')
    await expect(attachments).toContainText('姆大陆')
    expect(await detail.evaluate(el => {
      const box = el.getBoundingClientRect()
      const target = el.querySelector('.ah-detail-attachments').getBoundingClientRect()
      return target.top >= box.top - 1 && target.bottom <= box.bottom + 1
    })).toBe(true)
    expect(await detail.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const detailShot = `${output}m6-relic-attachments-detail-${viewport}.png`
    await page.screenshot({ path: detailShot, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: detailShot })
    await detail.getByRole('button', { name: '关闭卡牌详情' }).click()

    // 3. 剧本卡顶沿与推进按钮：1 / 2（单人局 = 人数 + 1）。
    const progress = page.locator('.ah-story-book .ah-page-progress.is-relic')
    await expect(progress).toBeVisible()
    await expect(progress).toHaveAttribute('aria-label', '场景目标进度 1/2')
    await expect(progress.locator('.ah-page-pips i')).toHaveCount(2)
    await expect(progress.locator('.ah-page-pips i.is-filled')).toHaveCount(1)
    await expect(progress).toContainText('1')
    await expect(page.locator('.ah-act-advance')).toContainText('附属 1 / 2')
    await expect(page.locator('.ah-act-advance')).toHaveAttribute('title', /自动结算推进/)

    // 4. 局势面板：遗物附属地点 1 / 2 处，悬停可看附属地点清单。
    await page.getByRole('button', { name: '局势', exact: true }).click()
    const situation = page.getByRole('dialog', { name: '调查局势' })
    await expect(situation).toBeVisible()
    // 剧本状态在弹窗最下面：滚到底，确保截图证据里看得到这一行。
    await situation.evaluate(el => { el.scrollTop = el.scrollHeight })
    const relicRows = situation.locator('.ah-campaign-tfa')
    await expect(relicRows).toBeVisible()
    await expect(relicRows).toContainText('遗物附属地点')
    await expect(relicRows).toContainText('1 / 2 处')
    await expect(relicRows.locator('li', { hasText: '遗物附属地点' })).toHaveAttribute('title', '姆大陆')

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    const situationShot = `${output}m6-relic-attachments-situation-${viewport}.png`
    await page.screenshot({ path: situationShot, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: situationShot })

    expect(errors, JSON.stringify(errors)).toEqual([])
  })
}
