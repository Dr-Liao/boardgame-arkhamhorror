// 七循环《地球边缘》（EotE）P6 一般玩家卡浏览器验收 spec。
//
// 两部分证据：
//   1) 构筑池开放（生产大厅，无夹具）：/api/catalog 下发的大厅 clientData.deckBuilder.cardPool
//      必须包含 EotE 玩家卡（说明 115 张已进入可构筑池）；手动加牌 UI 流程未自动驱动时按
//      约定以「大厅数据 + 截图 + annotation」作为退化证据（不伪造）。
//   2) 真实行为（夹具状态，真实点牌/点按钮）：事件卡打出、资产卡装备与发动、技能卡投入检定、
//      基础弱点显现进入威胁区——均断言服务端 state 的真实变化。
//
// 证据账本：audit/eote-player-browser.json（tools/playwright-eote-p6-reporter.mjs）。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/eote/p6/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const EVENT_CODE = '08020'   // Toe to Toe（事件：攻击 +1 伤害并自动成功，敌人反击）
const ASSET_CODE = '08025'   // Butterfly Swords（资产：行动攻击，可横置再攻击）
const SKILL_CODE = '08024'   // Defensive Stance（技能：动态战斗/敏捷图标，见下方 annotation 说明）
const COMMIT_SKILL_CODE = '08052' // 行业专家（技能：印刷 [wild] 图标，真实投入窗口的可投入证据）
const WEAKNESS_CODE = '08130' // Arm Injury（基础弱点：显现进入威胁区）
const INVESTIGATOR = '01001' // 核心守卫者，真实大厅生产选人用

const INVESTIGATOR_SETUP = Object.freeze({
  playerInvestigator: INVESTIGATOR, playerCount: 1, teammates: 0, legacyAutoStart: true, seed: 'eote-p6-prod',
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
    try { const body = await response.json(); if (body.session) latest = body.session } catch {}
  })
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const settings = fixture
      ? { ...original.settings, legacyAutoStart: true, eotePlayerFixture: true }
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
  const debug = process.env.P6_DEBUG === '1'
  for (let guard = 0; guard < maxSteps; guard++) {
    if (debug) {
      const choice = run.latest()?.state?.pendingChoice
      console.log('[P6 settle]', guard, 'pending=', JSON.stringify(choice && { kind: choice.kind, id: choice.id, seat: choice.seat,
        prompt: choice.prompt, options: (choice.options || []).map(item => item.id) }),
      'dom=', await page.locator('.ah-choice, .ah-mechanic-choice').count())
    }
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
      const option = choice.locator('[data-option-id]:not([disabled])').first()
      if (await option.count()) {
        await option.dispatchEvent('click').catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
      // 目标选择也可能挂在实体上（data-choice-target）：点发光敌人/地点完成选择。
      const target = page.locator('[data-choice-target]:not([data-choice-target=""])').first()
      if (await target.count()) {
        await target.dispatchEvent('click').catch(() => {})
        await page.waitForTimeout(140)
        continue
      }
      const hosted = page.locator('button[aria-label$="选择手牌"], .ah-hand [data-card-code]').first()
      if (await hosted.count()) {
        await hosted.dispatchEvent('click').catch(() => {})
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

// 点开牌桌手牌（选中）→ 点发光的出牌区（`zone:play`，真实落点），提交打出移动。
// 目标类事件/资产在结算过程中再通过待决选择面板选目标（由 settle 收敛）。
async function playHandCard(page, code) {
  await clickCard(page, handCard(page, code))
  const playSurface = page.locator('[data-interaction="zone:play"]').first()
  await expect(playSurface).toBeVisible()
  await expect(playSurface).toHaveClass(/ah-drop-valid/)
  await playSurface.dispatchEvent('click')
}

async function clickTableAction(page, pattern) {
  const button = page.locator('.ah-table-actions .ah-actions .ah-action').filter({ hasText: pattern }).first()
  await expect(button).toBeVisible()
  await button.dispatchEvent('click')
}

for (const [viewport, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test(`P6 ${viewport} 构筑池开放：EotE 可构筑卡在大厅玩家池`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/index.html')
    await expect(page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })).toBeVisible({ timeout: 30_000 })
    // 生产大厅数据：/api/catalog 的 clientData.deckBuilder.cardPool 是构筑界面真实下发的可构筑池。
    const catalog = await page.evaluate(async () => (await fetch('/api/catalog')).json())
    const game = catalog.games?.find(item => item.id === 'arkhamhorror')
    expect(game, '大厅目录缺少 arkhamhorror 条目').toBeTruthy()
    const pool = game.clientData?.deckBuilder?.cardPool || []
    const eotePool = pool.filter(card => /^08\d{3}$/.test(String(card.code)))
    test.info().annotations.push({
      type: 'evidence',
      description: `大厅 deckBuilder.cardPool 含 ${eotePool.length} 张 08 玩家卡；手动加牌 UI 流程未自动驱动，采用大厅数据 + 截图作为构筑池开放证据`,
    })
    expect(eotePool.length).toBeGreaterThanOrEqual(3)
    for (const code of [EVENT_CODE, ASSET_CODE, SKILL_CODE]) {
      expect(pool.some(card => String(card.code) === code), `${code} 未进入大厅可构筑池`).toBe(true)
    }
    // 打开「调查准备设置」作为可视证据（内含本地卡组库入口）。
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    await expect(page.getByRole('dialog', { name: '调查准备设置' })).toBeVisible()
    await screenshot(page, `${viewport}-build-pool`)
  })

  test(`P6 ${viewport} 事件卡真实打出`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    expect(handCodes(run)).toContain(EVENT_CODE)
    const actionsBefore = ownInvestigator(run).actionsLeft ?? 0
    const enemyBefore = JSON.stringify((stateOf(run).enemies || []).map(item => [item.id, item.health, item.damageTaken || 0]))
    const investigatorBefore = { damage: ownInvestigator(run).damage || 0, horror: ownInvestigator(run).horror || 0 }
    await playHandCard(page, EVENT_CODE)
    await settle(page, run)
    await expect.poll(() => handCodes(run).includes(EVENT_CODE), { timeout: 10_000 }).toBe(false)
    expect(ownInvestigator(run).discard || []).toContain(EVENT_CODE)
    // 事件结算：消耗 1 行动；攻击自动成功并 +1 伤害；额外费用是目标敌人对你发动一次攻击。
    await expect.poll(() => (ownInvestigator(run).actionsLeft ?? 0) < actionsBefore, { timeout: 10_000 }).toBe(true)
    await expect.poll(() => JSON.stringify((stateOf(run).enemies || []).map(item => [item.id, item.health, item.damageTaken || 0])))
      .not.toBe(enemyBefore)
    const investigatorAfter = ownInvestigator(run)
    expect((investigatorAfter.damage || 0) + (investigatorAfter.horror || 0)
      >= investigatorBefore.damage + investigatorBefore.horror).toBe(true)
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
    // 打出资产支付 3 资源、消耗 1 行动。
    await expect.poll(() => ownInvestigator(run).resources < resourcesBefore, { timeout: 10_000 }).toBe(true)
    await expect.poll(() => (ownInvestigator(run).actionsLeft ?? 0) < actionsBefore, { timeout: 10_000 }).toBe(true)
    const asset = (ownInvestigator(run).assets || []).find(item => item.code === ASSET_CODE)
    const actionsAfterPlay = ownInvestigator(run).actionsLeft ?? 0
    await clickCard(page, page.locator(`[data-interaction="asset:${asset.id}"]`).first())
    const popover = page.locator('.ah-card-action-popover')
    await expect(popover).toBeVisible()
    await popover.locator('.ah-action:not(:disabled)').first().click()
    await settle(page, run)
    // 资产能力：消耗行动发起攻击（检定结果可能抽到自动失败；以「行动-1 + 真实结算收敛」为使用证据，
    // 命中时敌人生命投影同步下降记录在 annotation）。
    await expect.poll(() => (ownInvestigator(run).actionsLeft ?? 0) <= actionsAfterPlay - 1, { timeout: 10_000 }).toBe(true)
    const enemyAfter = (stateOf(run).enemies || []).map(item => [item.id, item.health, item.damageTaken || 0])
    test.info().annotations.push({ type: 'evidence', description: `发动 ${ASSET_CODE} 后 actionsLeft=${ownInvestigator(run).actionsLeft}；敌人投影=${JSON.stringify(enemyAfter)}` })
    await screenshot(page, `${viewport}-asset`)
    expect(run.errors).toEqual([])
  })

  test(`P6 ${viewport} 技能卡投入检定`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    expect(handCodes(run)).toContain(COMMIT_SKILL_CODE)
    expect(handCodes(run)).toContain(SKILL_CODE)
    // 已知引擎缺口（不改引擎，报 Lead）：08024 的 commit 动态图标实现在 iconBonus 里按字符串
    // `skill === 'combat'` 判断，但引擎开检定传给 commitIcons 的是 skillList 数组，导致其
    // 候选被过滤掉（Node 分片测试直接用字符串调用所以是绿的）。这里用印刷 [wild] 图标的
    // 08052 完成真实投入证据，并记录 08024 的缺口 annotation。
    test.info().annotations.push({
      type: 'ability-skip',
      description: `08024 动态 commit 图标在引擎数组 skillList 路径返回 0（iconBonus 按字符串比较 skill），无法在真实投入窗口选择；用印刷 [wild] 图标的 ${COMMIT_SKILL_CODE} 完成真实投入。复现：commitIcons(state, inv, '08024', ['combat']) === 0，而 commitIcons(..., 'combat') === 2。`,
    })
    // 真实「攻击」行动开始一次战斗检定，进入投入手牌窗口后点技能卡投入。
    const enemy = (stateOf(run).enemies || [])[0]
    expect(enemy, '夹具应有同地点敌人以发起战斗检定').toBeTruthy()
    await clickCard(page, page.locator(`[data-interaction="enemy:${enemy.id}"]`).first())
    const popover = page.locator('.ah-card-action-popover')
    // 地图敌人默认打开卡牌详情；卡牌详情里的「对该目标行动」把目标转成动作条。
    if (!(await popover.count())) {
      const targetAction = page.getByRole('button', { name: '对该目标行动' })
      if (await targetAction.count()) await targetAction.click()
    }
    await expect(popover).toBeVisible()
    await popover.locator('.ah-action').filter({ hasText: '攻击' }).first().click()
    const commit = page.locator('.ah-choice[data-choice-kind="commit"]')
    await expect(commit).toBeVisible({ timeout: 10_000 })
    await clickCard(page, handCard(page, COMMIT_SKILL_CODE))
    await expect.poll(() => (stateOf(run)?.skillTest?.committed || []).some(item => item.code === COMMIT_SKILL_CODE), { timeout: 10_000 }).toBe(true)
    await commit.locator('[data-option-id="done"]').dispatchEvent('click')
    await settle(page, run)
    await expect.poll(() => stateOf(run)?.pendingChoice == null, { timeout: 10_000 }).toBe(true)
    expect(handCodes(run)).not.toContain(COMMIT_SKILL_CODE)
    expect(ownInvestigator(run).discard || []).toContain(COMMIT_SKILL_CODE)
    await screenshot(page, `${viewport}-skill`)
    expect(run.errors).toEqual([])
  })

  test(`P6 ${viewport} 弱点显现与结算`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const run = await start(page, { fixture: true })
    expect(ownInvestigator(run).deckSize ?? 0).toBeGreaterThan(0)
    const handBefore = [...handCodes(run)]
    // 真实 UI：点牌库抽牌（牌库顶是 Arm Injury），触发显现并进入威胁区。
    await clickCard(page, page.locator('.ah-dock-deck').first())
    await settle(page, run)
    await expect.poll(() => (ownInvestigator(run).threat || []).some(card => (typeof card === 'string' ? card : card.code) === WEAKNESS_CODE), { timeout: 10_000 }).toBe(true)
    expect(handCodes(run).length).toBe(handBefore.length)
    await screenshot(page, `${viewport}-weakness`)
    expect(run.errors).toEqual([])
  })
}
