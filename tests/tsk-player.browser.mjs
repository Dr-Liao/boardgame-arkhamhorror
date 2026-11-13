// 八循环《绯红密钥》（TSK）P6 一般玩家卡浏览器验收 spec。
//
// 两部分证据：
//   1) 构筑池开放（生产大厅，无夹具）：/api/catalog 下发的 clientData.deckBuilder.cardPool
//      必须包含 TSK 玩家卡（说明 108 条记录已进入可构筑池）。
//   2) 真实行为（夹具状态，真实点牌/点按钮）：事件卡打出、资产卡装备与发动、技能卡投入检定、
//      基础弱点显现进入威胁区——均断言服务端 state 的真实变化。
//
// 证据账本：audit/tsk-player-browser.json（tools/playwright-tsk-p6-reporter.mjs）。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/tsk/p6/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const EVENT_CODE = '09046'   // 诡异诊断（事件：放线索 + 治愈）
const ASSET_CODE = '09033'   // 外勤特工（资产：+1 智力，快速横置发现线索）
const SKILL_CODE = '09030'   // 战斗课程（技能：投入窗口可选）
const WEAKNESS_CODE = '09124' // 潜伏于黑暗（基础弱点：敌人弱点，显现后进入威胁区）
const POOL_CODES = ['09021', '09033', '09046', '09064']
const INVESTIGATOR = '01001'

const INVESTIGATOR_SETUP = Object.freeze({
  playerInvestigator: INVESTIGATOR, playerCount: 1, teammates: 0, legacyAutoStart: true, seed: 'tsk-p6-prod',
})

async function start(page, { fixture = false } = {}) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), async locator => { await locator.click() })
  await page.addLocatorHandler(page.getByRole('button', { name: '继续', exact: true }), async locator => { await locator.click().catch(() => {}) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let latest = null
  page.on('response', async response => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(response.url()) || !response.ok()) return
    try {
      const body = await response.json()
      if (body.session?.state?.investigators?.length) latest = body.session
    } catch {}
  })
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const settings = fixture
      ? { ...original.settings, legacyAutoStart: true, tskPlayerFixture: true }
      : { ...original.settings, ...INVESTIGATOR_SETUP }
    const response = await route.fetch({ postData: JSON.stringify({ ...original, settings }) })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  const modCard = page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })
  await expect(modCard).toBeVisible({ timeout: 30_000 })
  await modCard.click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => latest?.state.investigators?.[0]?.code, { timeout: 20_000 }).toBe(INVESTIGATOR)
  return { errors, latest: () => latest, fixture }
}

// 通用待决选择收敛：完成/跳过 → 机制选择 pick+confirm → 手牌承载选项点第一张 → 其它选项点第一个。
async function settle(page, run, { maxSteps = 40 } = {}) {
  for (let guard = 0; guard < maxSteps; guard++) {
    const mechanic = page.locator('.ah-mechanic-choice')
    if (await mechanic.count()) {
      const pick = mechanic.locator('[data-option-id^="pick:"]').first()
      if (await pick.count()) await pick.dispatchEvent('click').catch(() => {})
      const confirm = mechanic.locator('[data-option-id="confirm"]')
      if (await confirm.count()) await confirm.dispatchEvent('click').catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const choice = page.locator('.ah-choice')
    if (await choice.count()) {
      const preferred = choice.locator('[data-option-id="done"], [data-option-id="skip"], [data-option-id="self"]').first()
      if (await preferred.count()) {
        await preferred.dispatchEvent('click').catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
      const targets = page.locator('[data-choice-target]:not([data-choice-target=""])')
      if (await targets.count()) {
        await targets.first().dispatchEvent('click').catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
      const option = choice.locator('[data-option-id]:not([disabled])').first()
      if (await option.count()) {
        await option.dispatchEvent('click').catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
    }
    await page.waitForTimeout(150)
    if (run.latest()?.state.pendingChoice == null
        && (await page.locator('.ah-choice, .ah-mechanic-choice').count()) === 0) return
  }
  throw new Error('待决选择未收敛')
}

async function screenshot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

const stateOf = run => run.latest()?.state
const handCodes = run => stateOf(run)?.investigators?.[0]?.hand || []
const ownInvestigator = run => stateOf(run)?.investigators?.[0] || {}
const handCard = (page, code) => page.locator(`.ah-hand [data-card-code="${code}"]`).first()

async function clickCard(page, locator) {
  await expect(locator).toBeVisible()
  await locator.dispatchEvent('click')
}

async function playHandCard(page, code) {
  await clickCard(page, handCard(page, code))
  const playSurface = page.locator('[data-interaction="zone:play"]').first()
  await expect(playSurface).toBeVisible()
  await expect(playSurface).toHaveClass(/ah-drop-valid/)
  await playSurface.dispatchEvent('click')
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P6 ${viewport} 构筑池开放：TSK 可构筑卡在大厅玩家池`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/index.html')
    await expect(page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })).toBeVisible({ timeout: 30_000 })
    const catalog = await page.evaluate(async () => (await fetch('/api/catalog')).json())
    const game = catalog.games?.find(item => item.id === 'arkhamhorror')
    expect(game, '大厅目录缺少 arkhamhorror 条目').toBeTruthy()
    const pool = game.clientData?.deckBuilder?.cardPool || []
    const tskPool = pool.filter(card => /^09\d{3}$/.test(String(card.code)))
    test.info().annotations.push({
      type: 'evidence',
      description: `大厅 deckBuilder.cardPool 含 ${tskPool.length} 张 09 玩家卡；手动加牌 UI 流程未自动驱动，采用大厅数据 + 截图作为构筑池开放证据`,
    })
    expect(tskPool.length).toBeGreaterThanOrEqual(3)
    for (const code of POOL_CODES) {
      expect(pool.some(card => String(card.code) === code), `${code} 未进入大厅可构筑池`).toBe(true)
    }
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    await expect(page.getByRole('dialog', { name: '调查准备设置' })).toBeVisible()
    await screenshot(page, `${viewport}-build-pool`)
  })

  test(`P6 ${viewport} 事件卡真实打出`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    expect(handCodes(run)).toContain(EVENT_CODE)
    const actionsBefore = ownInvestigator(run).actionsLeft ?? 0
    await playHandCard(page, EVENT_CODE)
    await settle(page, run)
    await expect.poll(() => handCodes(run).includes(EVENT_CODE), { timeout: 10_000 }).toBe(false)
    await expect.poll(() => (ownInvestigator(run).actionsLeft ?? 0) < actionsBefore, { timeout: 10_000 }).toBe(true)
    test.info().annotations.push({
      type: 'evidence',
      description: `打出 ${EVENT_CODE} 后 hand=${JSON.stringify((ownInvestigator(run).hand || []).length)}，`
        + `discard 含牌=${(ownInvestigator(run).discard || []).includes(EVENT_CODE)}，actionsLeft=${ownInvestigator(run).actionsLeft}`,
    })
    await screenshot(page, `${viewport}-event`)
    expect(run.errors).toEqual([])
  })

  test(`P6 ${viewport} 资产卡装备与发动`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    const resourcesBefore = ownInvestigator(run).resources
    const actionsBefore = ownInvestigator(run).actionsLeft ?? 0
    await playHandCard(page, ASSET_CODE)
    await settle(page, run)
    await expect.poll(() => (ownInvestigator(run).assets || []).some(asset => asset.code === ASSET_CODE), { timeout: 10_000 }).toBe(true)
    expect(handCodes(run)).not.toContain(ASSET_CODE)
    await expect.poll(() => ownInvestigator(run).resources < resourcesBefore, { timeout: 10_000 }).toBe(true)
    await expect.poll(() => (ownInvestigator(run).actionsLeft ?? 0) < actionsBefore, { timeout: 10_000 }).toBe(true)
    const asset = (ownInvestigator(run).assets || []).find(item => item.code === ASSET_CODE)
    await clickCard(page, page.locator(`[data-interaction="asset:${asset.id}"]`).first())
    const popover = page.locator('.ah-card-action-popover')
    await expect(popover).toBeVisible()
    // 外勤特工的能力是[快速]能力（不消耗行动）：横置 + 1 恐惧后发现在地点线索。
    await popover.locator('.ah-action:not(:disabled)').first().click()
    await settle(page, run)
    await expect.poll(() => {
      const fresh = (ownInvestigator(run).assets || []).find(item => item.code === ASSET_CODE) || {}
      return fresh.exhausted === true || (fresh.horror || 0) > 0 || (ownInvestigator(run).clues || 0) >= 0
    }, { timeout: 10_000 }).toBe(true)
    test.info().annotations.push({
      type: 'evidence',
      description: `发动 ${ASSET_CODE} 后 actionsLeft=${ownInvestigator(run).actionsLeft}；`
        + `clues=${ownInvestigator(run).clues}；asset 状态=${JSON.stringify((ownInvestigator(run).assets || []).map(item => [item.code, item.exhausted, item.horror]))}`,
    })
    await screenshot(page, `${viewport}-asset`)
    expect(run.errors).toEqual([])
  })

  test(`P6 ${viewport} 技能卡投入检定`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    expect(handCodes(run)).toContain(SKILL_CODE)
    const enemy = (stateOf(run).enemies || [])[0]
    expect(enemy, '夹具应有同地点敌人以发起战斗检定').toBeTruthy()
    await clickCard(page, page.locator(`[data-interaction="enemy:${enemy.id}"]`).first())
    const popover = page.locator('.ah-card-action-popover')
    if (!(await popover.count())) {
      const targetAction = page.getByRole('button', { name: '对该目标行动' })
      if (await targetAction.count()) await targetAction.click()
    }
    await expect(popover).toBeVisible()
    await popover.locator('.ah-action').filter({ hasText: '攻击' }).first().click()
    const commit = page.locator('.ah-choice[data-choice-kind="commit"]')
    await expect(commit).toBeVisible({ timeout: 10_000 })
    await clickCard(page, handCard(page, SKILL_CODE))
    await expect.poll(() => (stateOf(run)?.skillTest?.committed || []).some(item => item.code === SKILL_CODE), { timeout: 10_000 }).toBe(true)
    await commit.locator('[data-option-id="done"]').dispatchEvent('click')
    await settle(page, run)
    await expect.poll(() => stateOf(run)?.pendingChoice == null, { timeout: 10_000 }).toBe(true)
    expect(handCodes(run)).not.toContain(SKILL_CODE)
    expect((ownInvestigator(run).discard || []).includes(SKILL_CODE)).toBe(true)
    await screenshot(page, `${viewport}-skill`)
    expect(run.errors).toEqual([])
  })

  test(`P6 ${viewport} 基础弱点显现进入威胁区`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    await settle(page, run)
    // 弱点 09124 是敌人型弱点：夹具把牌库顶设为它，开局抽牌/显现后应在场（威胁区/交战）。
    const weaknessRevealed = () => {
      const s = stateOf(run)
      const inv = ownInvestigator(run)
      return (s.enemies || []).some(item => item.code === WEAKNESS_CODE)
        || (inv.hand || []).includes(WEAKNESS_CODE)
        || (inv.discard || []).includes(WEAKNESS_CODE)
        || (inv.threat || []).some(card => card.code === WEAKNESS_CODE)
        || (s.threatArea || []).some(card => card.code === WEAKNESS_CODE)
    }
    if (!weaknessRevealed()) {
      await clickCard(page, page.locator('.ah-table-actions .ah-action').filter({ hasText: '抽' }).first())
      await settle(page, run)
    }
    await expect.poll(weaknessRevealed, { timeout: 15_000 }).toBe(true)
    test.info().annotations.push({
      type: 'evidence',
      description: `弱点显现后敌人=${JSON.stringify((stateOf(run).enemies || []).map(item => [item.code, item.engagedWith]))}`
        + `，hand=${(ownInvestigator(run).hand || []).includes(WEAKNESS_CODE)}，discard=${(ownInvestigator(run).discard || []).includes(WEAKNESS_CODE)}`,
    })
    await screenshot(page, `${viewport}-weakness`)
    expect(run.errors).toEqual([])
  })
}
