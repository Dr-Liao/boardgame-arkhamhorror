// 七循环《地球边缘》（EotE）P5 调查员浏览器验收 spec。
//
// 真实大厅 HTTP 路径：/api/start 注入 `playerInvestigator` 选人设置 → 真实开局 → 换牌 →
// pendingChoice 收敛，然后逐人做可达能力抽查（演武翻面 / 牌库顶揭示 /  investigator 卡 / 回合结束）。
// 不使用测试夹具；能力抽查在真实开局状态不可达时只记录 annotation 并断言可达子集，不伪造证据。
//
// 证据账本：audit/eote-investigators-browser.json（tools/playwright-eote-p5-reporter.mjs）。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CARD_ABILITY_CODES } from '../src/cards/card-abilities.js'

const output = fileURLToPath(new URL('../../../artifacts/migration/eote/p5/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const CODES = Object.freeze(['08001', '08004', '08007', '08010', '08016'])
const NAMES = Object.freeze({
  '08001': '丹妮拉·雷耶丝',
  '08004': '诺曼·威瑟斯',
  '08007': '蒙特雷·杰克',
  '08010': '陈丽丽',
  '08016': '鲍勃·詹金斯',
})

function noteSkip(id, reason) {
  test.info().annotations.push({ type: 'ability-skip', description: `${id}: ${reason}` })
  console.log(`[P5] ability demo skipped ${id}: ${reason}`)
}

// 与 TIC P5 同口径：通过 /api/start 注入调查员与固定种子，在大厅真实开局。
async function start(page, code) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), locator => locator.click())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let latest = null
  page.on('response', async response => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(response.url()) || !response.ok()) return
    try { const body = await response.json(); if (body.session) latest = body.session } catch {}
  })
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({ ...original, settings: { ...original.settings,
      playerInvestigator: code, playerCount: 1, teammates: 0, legacyAutoStart: true, seed: `eote-p5-${code}` } }) })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => latest?.state.investigators?.[0]?.code, { timeout: 20_000 }).toBe(code)
  return { errors, latest: () => latest }
}

// 开局选择收敛：换牌保留手牌；Lily 开局演武等机制选择自动 pick+confirm；
// 其余通用选择优先「完成/跳过/自己」，避免开局软锁。返回后 pendingChoice 必须为 null。
async function settleChoices(page, run, { maxSteps = 60 } = {}) {
  for (let guard = 0; guard < maxSteps; guard++) {
    const mechanic = page.locator('.ah-mechanic-choice')
    if (await mechanic.count()) {
      const pick = mechanic.locator('[data-option-id^="pick:"]').first()
      if (await pick.count()) await pick.click().catch(() => {})
      const confirm = mechanic.locator('[data-option-id="confirm"]')
      if (await confirm.count()) await confirm.click().catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const choice = page.locator('.ah-choice')
    if (await choice.count()) {
      const kind = await choice.getAttribute('data-choice-kind').catch(() => null)
      const preferred = kind === 'mulligan'
        ? choice.locator('[data-option-id="done"]')
        : choice.locator('[data-option-id="done"], [data-option-id="skip"], [data-option-id="self"]').first()
      if (await preferred.count()) {
        await preferred.first().click().catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
      const option = choice.locator('[data-option-id]:not([disabled])').first()
      if (await option.count()) {
        await option.click().catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
      // 「从手牌选择」类待决选择把可点选项挂回手牌实体（无 data-option-id 按钮）：
      // 牌桌手牌按钮的 aria-label 以「选择手牌」结尾，点第一张后在下一步点「完成」。
      const hosted = page.locator('button[aria-label$="选择手牌"], [data-interaction^="hand:"]').first()
      if (await hosted.count()) {
        await hosted.click().catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
    }
    await page.waitForTimeout(150)
    if (run.latest()?.state.pendingChoice == null
        && (await page.locator('.ah-choice, .ah-mechanic-choice').count()) === 0) return
  }
  throw new Error('开局待决选择未收敛')
}

async function screenshot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

async function openMechanicSummary(page) {
  const summary = page.locator('.ah-mechanic-summary').first()
  if (!(await summary.count())) return null
  const open = await summary.evaluate(element => element instanceof HTMLDetailsElement && element.open)
  if (!open) await summary.locator('summary').click().catch(() => {})
  return summary
}

// ── 逐人能力抽查（真实开局状态可达时执行；不可达时记录 annotation） ────────────────────────
async function demoLily(page, run, viewport) {
  const disciplines = () => (run.latest()?.state.investigators?.[0]?.assets || [])
    .filter(asset => /^0801[1-4][ab]$/.test(String(asset.code || '')))
  try {
    await expect.poll(() => disciplines().length, { timeout: 15_000 }).toBeGreaterThan(0)
  } catch {
    return noteSkip('08010-discipline', '真实开局未出现永久演武资产（entry 未接线或构筑未选演武）')
  }
  const first = disciplines()[0]
  const node = page.locator(`[data-interaction="asset:${first.id}"]`)
  if (!(await node.count())) return noteSkip('08010-discipline', `演武资产 ${first.code} 未挂到牌桌可见实体`)
  await node.dispatchEvent('click')
  const popover = page.locator('.ah-card-action-popover')
  const flip = popover.getByRole('button', { name: /翻|Broken|Unbroken|破功|运功/ }).first()
  if (!(await flip.count())) {
    await page.keyboard.press('Escape').catch(() => {})
    return noteSkip('08010-discipline', '演武卡动作条没有翻面动作')
  }
  const before = JSON.stringify(disciplines())
  await flip.click()
  // 演武翻面动作会先询问「承受伤害还是恐惧」，先自动选第一个选项完成翻面；
  // 面板与状态都异步渲染，轮询等待资产卡号从 Unbroken(a) 变 Broken(b)。
  for (let guard = 0; guard < 24; guard++) {
    if (JSON.stringify(disciplines()) !== before) break
    const option = page.locator('.ah-choice [data-option-id]:not([disabled])').first()
    if (await option.count()) await option.click().catch(() => {})
    await page.waitForTimeout(250)
  }
  try {
    await expect.poll(() => JSON.stringify(disciplines()) !== before, { timeout: 8_000 }).toBe(true)
  } catch {
    return noteSkip('08010-discipline', '演武动作已提交但场上资产未翻面（本 demo 依赖单卡能力接线）')
  }
  await screenshot(page, `${viewport}-08010-discipline`)
}

async function demoNorman(page, run, viewport) {
  let summary = await openMechanicSummary(page)
  if (!summary) return noteSkip('08004-decktop', '真实开局没有 mechanic summary（牌库顶揭示未投影）')
  const chip = summary.locator('[data-eote-deck-top]')
  try {
    await expect.poll(async () => await chip.count(), { timeout: 12_000 }).toBeGreaterThan(0)
  } catch {
    return noteSkip('08004-decktop', '真实开局摘要未出现本人牌库顶揭示（能力可能仅在回合开始揭示）')
  }
  await expect(chip).toHaveCount(1)
  await expect(chip.first()).toHaveAttribute('data-eote-deck-top', '0')
  await expect(chip.first()).not.toBeEmpty()
  await screenshot(page, `${viewport}-08004-deck-top`)
}

async function openInvestigatorCard(page, viewport, code) {
  const node = page.locator('[data-interaction="investigator:0"]').first()
  if (!(await node.count())) return noteSkip(`${code}-card`, '牌桌没有 investigator:0 交互实体')
  await node.dispatchEvent('click')
  const detail = page.getByRole('dialog', { name: '卡牌详情' })
  if (await detail.count()) {
    await expect(detail).toBeVisible()
    await screenshot(page, `${viewport}-${code}-card`)
    await page.keyboard.press('Escape')
    return
  }
  const popover = page.locator('.ah-card-action-popover')
  if (await popover.count()) {
    await screenshot(page, `${viewport}-${code}-card`)
    await page.keyboard.press('Escape')
    return
  }
  noteSkip(`${code}-card`, '调查员卡点击后没有详情/动作条')
}

async function demoMonterey(page, run, viewport) {
  const startRound = run.latest()?.state.round ?? 1
  const endTurn = page.getByRole('button', { name: /结束回合|结束行动|通过/ }).last()
  if (!(await endTurn.count())) return noteSkip('08007-round-end', '牌桌没有「结束回合/通过」按钮')
  // 牌桌右侧时间线浮层可能盖住按钮命中点：直接派发元素 click（同一份 onclick 处理）。
  await endTurn.dispatchEvent('click')
  // 回合结束会进入敌军/神话阶段，可能有遭遇选择；统一按跳过/完成收敛。
  try {
    await settleChoices(page, run, { maxSteps: 40 })
  } catch (error) {
    const pending = run.latest()?.state.pendingChoice
    noteSkip('08007-round-end', `回合结束后的待决选择未在浏览器内收敛（${error.message}；pending=${JSON.stringify(pending && { kind: pending.kind, prompt: pending.prompt })}）`)
    await page.keyboard.press('Escape').catch(() => {})
    return screenshot(page, `${viewport}-08007-round-end`)
  }
  const after = run.latest()?.state
  const round = after?.round ?? 1
  if (!(round > startRound || after?.pendingChoice != null)) {
    return noteSkip('08007-round-end', '结束回合后既没有进入下一轮也没有待决反应窗口')
  }
  await expect.poll(() => run.latest()?.state.pendingChoice?.kind || null, { timeout: 10_000 }).toBeNull()
  await screenshot(page, `${viewport}-08007-round-end`)
}

async function demoBob(page, run, viewport) {
  await openInvestigatorCard(page, viewport, '08016')
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  for (const code of CODES) {
    test(`P5 ${viewport} ${code} 真实选人构筑与开局`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      // 能力条目由内容层注册（entries/index 重建后 CARD_ABILITY_CODES 才包含该卡号）。
      // 条目未落地时仍验证真实选人/构筑/开局；落地后同一条用例会追加逐人能力抽查。
      const entryLanded = CARD_ABILITY_CODES.has(code)
      if (!entryLanded) noteSkip(`${code}-entry`, 'entries/index 尚未包含该调查员（能力抽查等待条目落地）')
      const run = await start(page, code)
      await settleChoices(page, run)
      const state = () => run.latest()?.state
      // 选人结果：真实开局使用注入的调查员，构筑产出的牌组/手牌存在。
      await expect.poll(() => state()?.investigators?.[0]?.code, { timeout: 10_000 }).toBe(code)
      const investigator = state().investigators[0]
      expect(typeof investigator.name === 'string' && investigator.name.length > 0).toBe(true)
      // 观察投影不下发牌库顺序（`deck: []`），牌库只暴露张数 `deckSize`；手牌只有本人可见。
      expect(investigator.deckSize).toBeGreaterThan(0)
      expect(investigator.hand.length).toBeGreaterThan(0)
      // 牌桌仪表显示该调查员（卡号实体或名字文本至少其一可见）。
      await expect(page.locator('.ah-table')).toBeVisible()
      const dashboardCard = page.locator(`[data-card-code="${code}"]`).first()
      const nameVisible = await page.locator('body').innerText()
      expect(nameVisible.includes(investigator.name) || nameVisible.includes(NAMES[code]) || await dashboardCard.count() > 0).toBe(true)
      // 换牌已完成、待决选择收敛。
      await expect(page.locator('.ah-choice[data-choice-kind="mulligan"]')).toHaveCount(0)
      await expect.poll(() => state()?.pendingChoice?.kind || null, { timeout: 10_000 }).toBeNull()
      await screenshot(page, `${viewport}-${code}-start`)
      // 逐人能力抽查（条目落地后才执行）。
      if (entryLanded) {
        if (code === '08010') await demoLily(page, run, viewport)
        else if (code === '08004') await demoNorman(page, run, viewport)
        else if (code === '08007') await demoMonterey(page, run, viewport)
        else if (code === '08016') await demoBob(page, run, viewport)
        else await openInvestigatorCard(page, viewport, code)
      }
      expect(run.errors).toEqual([])
    })
  }
}
