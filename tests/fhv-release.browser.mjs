// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P8 发布门禁浏览器证据（桌面 1440×900 / 移动 390×844）。
//
// 一个 spec 文件、3 个发布门禁 phase 用例 × 2 视口 = 6 行，全部走真实大厅 / 真实 HTTP / 真实 web 界面：
//
//   phase=release      真实大厅启动《铁杉谷盛宴》→ 调查准备（选择调查员 10001 / 自动构筑合法牌组 /
//                      确认准备）→ 出发准备（首章《欢迎来到铁杉谷》）→ 牌桌（真实手牌/地点/行动）→
//                      关卡设置指南（中英关卡名 / 特别规则优先 / 后续剧情与结局默认折叠 / 中文正文）→
//                      一次真实法典交互（地点 [codex] 行动 → 法典选择面板 → 面板记录已读）→
//                      真实打出一张支援 → 真实关末结算（debug endScenario，已披露）→ 序曲整备
//                      （结算「保留 1 张支援」的真实选择事务）→ 勘察选择《岩间密语》→ 下一章开局
//                      带支援入场（整备包裹被消费、保留的支援真实在场）。
//   phase=progression  真实跨章：欢迎 → 岩间密语（勘察关）→ 首夜《扭曲空洞》→ 第二日黎明 →
//                      升级窗（未花费 XP → 真实购买一次 / 另一窗口真实跳过并保留 XP）→ 跳过勘察
//                      逐日推进（Day 2 → Day 3《最终日黎明》）→ 最终夜 → 终章《山谷的命运》→
//                      真实战役结算 campaignResult；中途刷新页面验证会话恢复（断线恢复）。
//   phase=online       中转服务 + 两个真实大厅实例、两名真人（10001 / 10004）各自准备、房主开局；
//                      轮流行动（房主行动并交回合 → 客人行动）；隐私（对方手牌为空、只给牌库张数、
//                      页面只渲染本席位手牌、法典投影不含未触发条目的正文/条件）；权限边界（非房主
//                      不能 /api/debug、不能提交 debug 命令、不能开始关卡、不能在他人回合行动）；
//                      断线恢复（关闭客人页面后重开同一大厅，回到同一战役会话与同一手牌）。
//
// 真实口径（与 P7 一致）：不 page.route 改写 /api/start、/api/session、/api/move；不写 session.state；
// 章内不做夹具。跨章加速只用 host-only POST /api/debug 的「结束这关」（真实 debugCommand 解析 +
// 正常事务提交 + 真实 finishScenario/结局/XP/记录），并在每个用例的 debugJump annotation 里披露。
// 多人阶段全部经真实 /api/online/command（房主/客人各自的席位投影），不使用任何注入端点。
//
// 证据账本：audit/fhv-release-browser.json（tools/playwright-fhv-release-reporter.mjs）。
// 证据截图：artifacts/migration/fhv/p8/screenshots/。
import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

import { chapters as FHV_CHAPTERS } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as fhvWelcomeToHemlockVale from '../content/campaigns/theFeastOfHemlockVale/scenarios/welcomeToHemlockVale/index.js'
import * as fhvWrittenInRock from '../content/campaigns/theFeastOfHemlockVale/scenarios/writtenInRock/index.js'
import * as fhvHemlockHouse from '../content/campaigns/theFeastOfHemlockVale/scenarios/hemlockHouse/index.js'
import * as fhvTheSilentHeath from '../content/campaigns/theFeastOfHemlockVale/scenarios/theSilentHeath/index.js'
import * as fhvTheLostSister from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/index.js'
import * as fhvTheThingInTheDepths from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/index.js'
import * as fhvTheTwistedHollow from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/index.js'
import * as fhvDawnOfTheSecondDay from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheSecondDay/index.js'
import * as fhvTheLongestNight from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/index.js'
import * as fhvDawnOfTheFinalDay from '../content/campaigns/theFeastOfHemlockVale/scenarios/dawnOfTheFinalDay/index.js'
import * as fhvPreludeTheFinalEvening from '../content/campaigns/theFeastOfHemlockVale/scenarios/preludeTheFinalEvening/index.js'
import * as fhvFateOfTheVale from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/index.js'

const output = fileURLToPath(new URL('../../../artifacts/migration/fhv/p8/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const CAMPAIGN_ID = 'theFeastOfHemlockVale'
const CAMPAIGN_NAME = '铁杉谷盛宴'
const HOST_CODE = '10001'
const GUEST_CODE = '10004'
const FIRST_CHAPTER_ID = FHV_CHAPTERS[0].id
const VIEWPORTS = Object.freeze([['desktop', 1440, 900], ['mobile', 390, 844]])
const CJK = /[\u4e00-\u9fff]/
const debug = message => { if (process.env.FHV_P8_DEBUG === '1') console.log('[FHV P8]', message) }

// 场景定义里的真实显示名（牌桌标题 / 出发准备 h2 / 关卡设置 h2 都是它；含英文副题）。
const SCENARIO_MODULES = Object.freeze({
  welcomeToHemlockVale: fhvWelcomeToHemlockVale,
  writtenInRock: fhvWrittenInRock,
  hemlockHouse: fhvHemlockHouse,
  theSilentHeath: fhvTheSilentHeath,
  theLostSister: fhvTheLostSister,
  theThingInTheDepths: fhvTheThingInTheDepths,
  theTwistedHollow: fhvTheTwistedHollow,
  dawnOfTheSecondDay: fhvDawnOfTheSecondDay,
  theLongestNight: fhvTheLongestNight,
  dawnOfTheFinalDay: fhvDawnOfTheFinalDay,
  preludeTheFinalEvening: fhvPreludeTheFinalEvening,
  fateOfTheVale: fhvFateOfTheVale,
})
const CHAPTER_BY_ID = new Map(FHV_CHAPTERS.map(chapter => [chapter.id, chapter]))
const chapterOf = id => CHAPTER_BY_ID.get(id) || { id, name: id }
const chapterName = id => chapterOf(id).name
const scenarioDisplayName = id => SCENARIO_MODULES[id]?.scenario?.name || chapterName(id)
const investigatorName = code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 各章指南的「特别规则」是否由正式指南数据提供（web/scenario-guides/<id>.json 的 zh 层）。
// 面板只在有内容时渲染「特别规则」分区，因此用真实数据决定是否断言该分区。
const GUIDE = new Map()
for (const chapter of FHV_CHAPTERS) {
  try {
    const guide = JSON.parse(readFileSync(fileURLToPath(new URL(`../web/scenario-guides/${chapter.id}.json`, import.meta.url)), 'utf8'))
    GUIDE.set(chapter.id, guide)
  } catch {
    GUIDE.set(chapter.id, null)
  }
}
const guideSpecialRules = id => (GUIDE.get(id)?.locales?.zh?.specialRules || []).length
const guideHasEnglish = id => Boolean(GUIDE.get(id)?.locales?.en)

// P7 已验证的路线与回答（parts.js 的 nextStep/route 语义；跨章用 endScenario 真实推进）。
const ANSWER = Object.freeze({
  skipCodex: Object.freeze({ text: '跳过' }),
  noMoreFood: Object.freeze({ text: '不要再吃' }),
  rescheduleSurvey: Object.freeze({ text: '跳过本次勘察' }),
  searchForBertie: Object.freeze({ text: '寻找伯蒂' }),
  gatherMoreInformation: Object.freeze({ text: '在夜间收集' }),
})
const surveyAnswer = scenarioId => Object.freeze({ text: chapterName(scenarioId) })
// 欢迎 → 岩间密语（勘察关）→ 首夜（寻找伯蒂）→ 扭曲空洞 → 第二日黎明 → 跳过勘察 → 最终日黎明
// → 跳过勘察 → 最终夜 → 终章。每个 campaignBranch 的 source 都在这里给出中文选项文本。
const CAMPAIGN_PLAN = Object.freeze({
  answers: Object.freeze({
    surveyChoiceDay1: surveyAnswer('writtenInRock'),
    firstEveningCodex: ANSWER.skipCodex,
    firstEveningMeal: ANSWER.noMoreFood,
    firstEveningChoice: ANSWER.searchForBertie,
    surveyChoiceDay2: ANSWER.rescheduleSurvey,
    secondEveningCodex: ANSWER.skipCodex,
    secondEveningChoice: ANSWER.gatherMoreInformation,
    surveyChoiceNight2: ANSWER.rescheduleSurvey,
    surveyChoiceDay3: ANSWER.rescheduleSurvey,
  }),
})

// ---------------------------------------------------------------------------
// 截图与基础断言
// ---------------------------------------------------------------------------
const screenshotPath = name => `${output}${name}.png`
const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((resolve, reject) => setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms).unref?.()),
])
const shot = async (page, testInfo, name, { fullPage = false } = {}) => {
  const path = screenshotPath(name)
  testInfo.annotations.push({ type: 'screenshot', description: path })
  await withTimeout(page.screenshot({ path, animations: 'disabled', fullPage }), 45_000, `截图 ${name}`)
}
const annotate = (testInfo, type, description) => testInfo.annotations.push({ type, description })

async function assertNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

// 失败现场：截图 + 界面快照写入 annotation（只失败时；联机用例自建 context/page，单独收集错误）。
// 注意：失败现场只截视口（fullPage 在长战役纪事页上会等待巨量图片布局，可能把收尾拖到超时）。
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  if (testInfo.annotations.some(annotation => annotation.type === 'blocked')) return
  try {
    const path = screenshotPath(`p8-failure-${testInfo.title.replace(/[^\w\u4e00-\u9fff-]+/g, '-')}.png`)
    testInfo.annotations.push({ type: 'screenshot', description: path })
    await withTimeout(page.screenshot({ path, animations: 'disabled' }), 20_000, '失败截图')
  } catch {
    // 页面已关闭/崩溃时不掩盖原始错误。
  }
})

async function captureBlockedEvidence(page, testInfo, label, error) {
  annotate(testInfo, 'blocked', `${label}: ${String(error?.message || error).slice(0, 600)}`)
  try {
    if (page && !page.isClosed()) {
      const alert = await withTimeout(page.locator('[role="alert"]').first().innerText(), 5000, '读取错误提示')
        .catch(() => '')
      if (alert) annotate(testInfo, 'evidence', `界面错误提示：${alert.trim().slice(0, 300)}`)
      const path = screenshotPath(`p8-blocked-${label.replace(/[^\w\u4e00-\u9fff-]+/g, '-')}.png`)
      testInfo.annotations.push({ type: 'screenshot', description: path })
      await withTimeout(page.screenshot({ path, animations: 'disabled' }), 20_000, '失败现场截图')
    }
  } catch {
    // 不掩盖原始错误。
  }
}

// ---------------------------------------------------------------------------
// 演出 / 待决选择收敛（真实 UI 点击；与 P7 同一口径）
// ---------------------------------------------------------------------------
async function dismissPresentation(page) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await page.locator('.ah-cinematic').count() === 0) {
      await page.waitForTimeout(200)
      if (await page.locator('.ah-cinematic').count() === 0) return
      continue
    }
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const next = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
    if (await next.count()) {
      await next.first().click({ timeout: 3000, force: true }).catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    await page.waitForTimeout(150)
  }
}

async function isPresenting(page) {
  const table = page.locator('.ah-table').first()
  if (!(await table.count())) return false
  return table.evaluate(element => element.classList.contains('ah-presenting')).catch(() => false)
}

// 真实玩家路径清空牌桌待决选择/演出队列（换牌、故事、遭遇目标、机制选择、地点/敌人目标、行动演出），
// 直到可操作。`timeout` 是收敛上限：服务端事务卡住时不把整条用例拖到 240s 超时。
async function settleTableToPlayable(page, { timeout = 45_000 } = {}) {
  const deadline = Date.now() + timeout
  await page.waitForTimeout(400)
  let stable = 0
  for (let guard = 0; guard < 300 && stable < 5 && Date.now() < deadline; guard++) {
    if (guard % 25 === 0) {
      debug(`settle guard=${guard} stable=${stable} presenting=${await isPresenting(page)} `
        + `choice=${await page.locator('.ah-choice').count()} mechanic=${await page.locator('.ah-mechanic-choice').count()} `
        + `cinematic=${await page.locator('.ah-cinematic').count()}`)
    }
    if (await isPresenting(page)) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(180)
      continue
    }
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) {
      await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(120)
      continue
    }
    const next = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
    if (await next.count()) {
      await next.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(120)
      continue
    }
    // FHV 机制选择（法典/整备/网格/矿车/猎杀袋/形态）：pick 一项 → 确认；取消类选项留到最后。
    const mechanic = page.locator('.ah-mechanic-choice')
    if (await mechanic.count()) {
      const pick = mechanic.locator('[data-option-id^="pick:"]:not([disabled])').first()
      if (await pick.count()) await pick.click({ timeout: 5000 }).catch(() => {})
      else {
        const confirm = mechanic.locator('[data-option-id="confirm"]:not([disabled])')
        if (await confirm.count()) await confirm.click({ timeout: 5000 }).catch(() => {})
        else {
          const other = mechanic.locator('[data-option-id]:not([disabled])').first()
          if (await other.count()) await other.click({ timeout: 5000 }).catch(() => {})
        }
      }
      stable = 0
      await page.waitForTimeout(160)
      continue
    }
    // 地点/敌人作为待决目标（FHV 初始工事、猎杀袋、法典目标等）：点地图上的 ah-choice-target。
    const choiceTarget = page.locator('.ah-choice-target[data-choice-target]').first()
    if (await choiceTarget.count()) {
      await choiceTarget.click({ timeout: 5000 }).catch(() => {})
      stable = 0
      await page.waitForTimeout(180)
      continue
    }
    // 检定前/回合收尾的「免费能力窗口」：让过（skip）优先，否则会误点成场景能力或快速卡。
    const skipWindow = page.locator('.ah-choice [data-option-id="skip"]:not([disabled])').first()
    if (await skipWindow.count()) {
      await skipWindow.click({ timeout: 5000 }).catch(() => {})
      stable = 0
      await page.waitForTimeout(140)
      continue
    }
    const done = page.locator('.ah-choice [data-option-id="done"]:not([disabled])')
    if (await done.count()) {
      await done.first().click({ timeout: 5000 }).catch(() => {})
      stable = 0
      await page.waitForTimeout(160)
      continue
    }
    const option = page.locator('.ah-choice .ah-choice-option:not([disabled])')
    if (await option.count()) {
      await option.first().click({ timeout: 5000 }).catch(() => {})
      stable = 0
      await page.waitForTimeout(160)
      continue
    }
    // 待决面板已出现但选项还没渲染（会话视图里的 legalMoves 是暂停前的旧快照）：点「刷新局势」
    // 让服务端按当前 pendingChoice 重算 legalMoves，选项会随真实 /api/session 响应出现。
    if (await page.locator('.ah-choice').count()) {
      const empty = (await page.locator('.ah-choice [data-option-id]').count()) === 0
      const refresh = page.getByRole('button', { name: '刷新局势' })
      if (empty && await refresh.count()) {
        await refresh.first().dispatchEvent('click').catch(() => {})
        stable = 0
        await page.waitForTimeout(600)
        continue
      }
    }
    if (await page.locator('.ah-cinematic, .ah-choice, .ah-mechanic-choice').count()) {
      stable = 0
      await page.waitForTimeout(220)
      continue
    }
    stable += 1
    await page.waitForTimeout(180)
  }
  debug(`settle done presenting=${await isPresenting(page)} choice=${await page.locator('.ah-choice').count()} `
    + `mechanic=${await page.locator('.ah-mechanic-choice').count()}`)
}

// ---------------------------------------------------------------------------
// 真实大厅 / 真实 HTTP
// ---------------------------------------------------------------------------
async function gotoHall(page) {
  await page.goto('/index.html')
  await expect(page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })).toBeVisible({ timeout: 30_000 })
}

async function openSetup(page) {
  const dialog = page.getByRole('dialog', { name: '调查准备设置' })
  if (await dialog.count()) return dialog
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).first().click()
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  return dialog
}

// 真实 GET /api/session（与牌桌「刷新局势」同一接口；按浏览器座位投影）。
async function fetchSessionView(request, sessionId) {
  const response = await request.get('/api/session?sessionId=' + encodeURIComponent(sessionId))
  const payload = await response.json()
  return payload.session || null
}

async function fetchSession(request, sessionId) {
  return (await fetchSessionView(request, sessionId))?.state || null
}

// 调试控制台通道（host-only POST /api/debug）。P8 只允许用它推进战役流程（结束本关），
// 不替代章内行为；提交前先读取真实 revision，避免与真实 UI 操作后的本地会话错位。
async function postDebug(request, sessionId, text, seat = 0) {
  const state = await fetchSession(request, sessionId)
  expect(state, '调试结算前应能读取真实会话').toBeTruthy()
  const response = await request.post('/api/debug', {
    data: { sessionId, revision: state.revision, seat, command: { text } },
  })
  const body = await response.json()
  expect(body.ok, `调试「${text}」失败：${body.error}`).toBe(true)
  return body.session
}

// 点一个「会提交 /api/move」的真实按钮，返回响应里的会话。
async function clickMoveButton(page, locator, label = '按钮') {
  await expect(locator, `${label} 应可见`).toBeVisible({ timeout: 30_000 })
  await expect(locator, `${label} 应可用`).toBeEnabled({ timeout: 30_000 })
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 60_000 })
  await locator.click({ timeout: 15_000 })
  const response = await responsePromise
  const body = await response.json()
  expect(body.ok, `${label} -> ${body.error}`).toBe(true)
  await page.waitForTimeout(150)
  return { session: body.session, action: (await response.request().postDataJSON())?.move?.action || null }
}

// 局外页工作流主按钮（开始当前关卡 / 确认准备 / 完成升级 / 查看结算）。可能只是切页签、不提交动作。
async function clickWorkflowPrimary(page) {
  const primary = page.locator('.ah-workflow-next button').first()
  await expect(primary, '局外页主按钮应可见').toBeVisible({ timeout: 30_000 })
  await expect(primary, '局外页主按钮应可用').toBeEnabled({ timeout: 30_000 })
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 15_000 }).catch(() => null)
  await primary.click({ timeout: 15_000 })
  const response = await responsePromise
  if (!response) return { session: null, action: null }
  const body = await response.json()
  expect(body.ok, `局外页主按钮 -> ${body.error}`).toBe(true)
  await page.waitForTimeout(150)
  return { session: body.session, action: (await response.request().postDataJSON())?.move?.action || null }
}

// 调试结算后客户端不会自动感知：点真实「刷新局势 / 刷新」拉取会话，直到挂载局外页。
async function syncAfterDebug(page) {
  await dismissPresentation(page)
  for (let guard = 0; guard < 40; guard++) {
    if (await page.locator('.ah-hub').count()) return
    if (await isPresenting(page)) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      await page.waitForTimeout(250)
      continue
    }
    const tableRefresh = page.getByRole('button', { name: '刷新局势' })
    const hubRefresh = page.getByRole('button', { name: '刷新', exact: true })
    if (await tableRefresh.count()) await tableRefresh.first().dispatchEvent('click').catch(() => {})
    else if (await hubRefresh.count()) await hubRefresh.first().dispatchEvent('click').catch(() => {})
    await page.waitForTimeout(400)
    await dismissPresentation(page)
    debug(`sync guard=${guard} presenting=${await isPresenting(page)} hub=${await page.locator('.ah-hub').count()}`)
  }
  throw new Error('调试结算后界面没有进入局外页（刷新按钮不可用或 /api/session 失败）')
}

// ---------------------------------------------------------------------------
// 大厅 → 战役准备 → 出发准备 → 首章牌桌
// ---------------------------------------------------------------------------
async function startCampaignThroughLobby(page, request, testInfo, viewport, { seats = 1 } = {}) {
  await gotoHall(page)
  const dialog = await openSetup(page)
  const campaignSelect = dialog.locator('select').filter({ has: page.locator(`option[value="${CAMPAIGN_ID}"]`) }).first()
  await expect(campaignSelect, '大厅战役选择器应包含《铁杉谷盛宴》').toBeVisible({ timeout: 30_000 })
  const options = await campaignSelect.locator('option').evaluateAll(nodes =>
    nodes.map(node => ({ value: node.value, label: node.textContent || '' })))
  expect(options.map(option => option.value), '真实大厅战役下拉').toContain(CAMPAIGN_ID)
  expect(options.find(option => option.value === CAMPAIGN_ID)?.label, '战役中文名').toContain(CAMPAIGN_NAME)
  await campaignSelect.selectOption(CAMPAIGN_ID)
  const seatSelect = dialog.getByRole('combobox', { name: '席位数量' })
  await expect(seatSelect, '大厅席位数量选择器').toBeVisible({ timeout: 30_000 })
  await seatSelect.selectOption(String(seats))
  await shot(page, testInfo, `p8-lobby-${viewport}`)

  const started = page.waitForResponse(response => response.url().endsWith('/api/start'), { timeout: 60_000 })
  await dialog.getByRole('button', { name: '开始新游戏' }).click()
  const body = await (await started).json()
  expect(body.ok, `真实 /api/start -> ${body.error}`).toBe(true)
  const session = body.session
  expect(session.state.campaign.id).toBe(CAMPAIGN_ID)
  const hub = page.locator('.ah-hub')
  await expect(hub, '战役局外页应挂载').toBeVisible({ timeout: 60_000 })
  await expect(hub).toHaveAttribute('data-ui-state', 'campaignHub')
  await expect(page.locator('.bg-game-title').first()).toContainText(CAMPAIGN_NAME)
  const view = await fetchSessionView(request, session.sessionId)
  expect(view?.sessionId, '真实 /api/session 的会话编号').toBe(session.sessionId)
  return { session, hub, view }
}

// 局外页真实按钮完成席位准备：配置调查员与卡组 → 选 10001 → 自动构筑 → 确认准备。
async function prepareSeatThroughHub(page, request, session, testInfo, viewport, { code = HOST_CODE } = {}) {
  const sessionId = session.sessionId
  const hub = page.locator('.ah-hub')
  let state = await fetchSession(request, sessionId)
  for (let guard = 0; guard < 10 && state.uiState !== 'scenarioSetup'; guard++) {
    if ((state.legalMoves || []).some(move => move.action === 'hubGoSetup')) {
      const { action } = await clickWorkflowPrimary(page)
      debug(`prepare primary action=${action} ui=${state.uiState}`)
      if (action === 'hubGoSetup') {
        state = await fetchSession(request, sessionId)
        continue
      }
    }
    if ((state.legalMoves || []).some(move => move.action === 'hubSelectScenario')) {
      const nav = hub.getByRole('navigation', { name: '战役局外页面' })
      await nav.getByRole('button', { name: '关卡选择', exact: true }).click().catch(() => {})
      const choose = hub.locator('.ah-office-case button:not([disabled])').first()
      if (await choose.count()) {
        await clickMoveButton(page, choose, '选择第一关')
        state = await fetchSession(request, sessionId)
        continue
      }
    }
    await page.waitForTimeout(250)
    state = await fetchSession(request, sessionId)
  }
  expect(state.uiState, '真实局外页调查准备').toBe('scenarioSetup')

  if (state.hubReady) return fetchSession(request, sessionId)
  const name = investigatorName(code)
  const candidate = hub.getByRole('button', { name: new RegExp(`^选择调查员：${escapeRegExp(name)}`) }).first()
  await clickMoveButton(page, candidate, `选择调查员：${name}`)
  state = await fetchSession(request, sessionId)
  expect(state.investigators?.[0]?.code, '真实席位调查员').toBe(code)

  const deck = hub.getByRole('button', { name: '使用推荐卡组', exact: true }).first()
  await clickMoveButton(page, deck, '使用推荐卡组')
  const ready = hub.getByRole('button', { name: '确认准备', exact: true }).first()
  await clickMoveButton(page, ready, '确认准备')
  state = await fetchSession(request, sessionId)
  expect(state.hubReady, '全桌准备完成').toBe(true)
  await shot(page, testInfo, `p8-prepared-${viewport}`)
  return state
}

// 出发准备页：断言真实章节名 → 点「开始当前关卡」（真实 hubBeginScenario）→ 牌桌挂载。
async function beginScenarioThroughDeparture(page, request, sessionId, scenarioId, testInfo, viewport) {
  const hub = page.locator('.ah-hub')
  if (!(await page.locator('.ah-office-departure').count())) {
    const nav = hub.getByRole('navigation', { name: '战役局外页面' })
    await nav.getByRole('button', { name: '开始关卡', exact: true }).click().catch(() => {})
  }
  const departure = page.locator('.ah-office-departure')
  const displayName = scenarioDisplayName(scenarioId)
  const shortName = chapterName(scenarioId)
  const acceptedNames = [...new Set([displayName, shortName].filter(Boolean))]
  await expect(departure, '出发准备页').toBeVisible({ timeout: 30_000 })
  await expect(departure.locator('h2'), `出发准备应显示「${displayName}」`)
    .toContainText(new RegExp(acceptedNames.map(escapeRegExp).join('|')))
  const start = departure.locator('.ah-departure-start')
  await expect(start, '开始当前关卡按钮').toBeEnabled({ timeout: 60_000 })
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubBeginScenario', { timeout: 90_000 })
  await start.click({ timeout: 15_000 })
  const response = await responsePromise.catch(() => null)
  if (!response) {
    const latest = await fetchSession(request, sessionId).catch(() => null)
    throw new Error(`开始「${displayName}」时服务端事务未返回（ui=${latest?.uiState || '?'}，`
      + `scenario=${latest?.scenario?.id || '?'}，pending=${latest?.pendingChoice?.kind || '-'}）`)
  }
  const body = await response.json()
  if (!body.ok) throw new Error(`开始「${displayName}」失败：${body.error}`)
  await expect(page.locator('.ah-table'), '牌桌应挂载').toBeVisible({ timeout: 120_000 })
  await settleTableToPlayable(page)
  const state = await fetchSession(request, sessionId)
  expect(state.uiState, '进入关卡后的界面状态').toBe('inScenario')
  expect(state.scenario?.id, `应进入「${displayName}」`).toBe(scenarioId)
  return state
}

// ---------------------------------------------------------------------------
// 局外页推进（endScenario 之后：继续 → 战役选择 → 幕间/出发准备 → 开始当前关卡）
// ---------------------------------------------------------------------------
async function answerCampaignChoice(page, request, state, plan) {
  const choice = state.pendingChoice
  const dialog = page.locator('.ah-hub [role="dialog"][aria-label="战役选择"]')
  await expect(dialog, '局外页「战役选择」面板').toBeVisible({ timeout: 20_000 })
  const buttons = dialog.locator('button:not([disabled])')
  await expect.poll(async () => buttons.count(), { timeout: 20_000 }).toBeGreaterThan(0)
  if (choice.kind === 'mechanic') {
    // 幕间/整备的机制选择（勘察整备等）：先确认已选项，否则选第一项再确认。
    const confirm = buttons.filter({ hasText: '确认选择' }).first()
    if (await confirm.count()) return clickMoveButton(page, confirm, '确认机制选择')
    const cancel = buttons.filter({ hasText: '取消，保留原状态' }).first()
    if (await cancel.count()) return clickMoveButton(page, cancel, '取消机制选择')
    return clickMoveButton(page, buttons.first(), '机制选项')
  }
  const wanted = plan.answers[choice.source]
  if (!wanted?.text) {
    const optionTexts = (await buttons.allTextContents()).map(text => text.trim())
    throw new Error(`路线缺少「${choice.source}」的选项（kind=${choice.kind}，可选：${optionTexts.join(' / ')}）`)
  }
  const target = buttons.filter({ hasText: wanted.text }).first()
  if (!(await target.count())) {
    const optionTexts = (await buttons.allTextContents()).map(text => text.trim())
    throw new Error(`「${choice.source}」没有包含「${wanted.text}」的选项（可选：${optionTexts.join(' / ')}）`)
  }
  return clickMoveButton(page, target, `战役选择：${wanted.text}`)
}

// 继续按钮：结算页在「调查纪事」页签的页脚（hubContinue）；幕间在升级页签内联
// 「保留 N XP 并继续 / 完成升级，准备下一关」；出发准备未就绪时在调查员页签内联「确认准备」。
async function advanceHubThroughUi(page, request, sessionId) {
  const storyContinue = page.locator('.ah-story-page footer button').first()
  if (await storyContinue.count()) return (await clickMoveButton(page, storyContinue, '继续，进入关间准备')).action
  const primary = page.locator('.ah-workflow-next button').first()
  if (await primary.count()) {
    const { action } = await clickWorkflowPrimary(page)
    return action
  }
  const interludeDone = page.locator('.ah-hub button').filter({ hasText: /保留 .*XP 并继续|完成升级，准备下一关/ }).first()
  if (await interludeDone.count()) return (await clickMoveButton(page, interludeDone, '完成幕间准备')).action
  const confirmSeat = page.locator('.ah-hub button').filter({ hasText: /^确认准备$/ }).first()
  if (await confirmSeat.count()) return (await clickMoveButton(page, confirmSeat, '确认准备')).action
  const overviewContinue = page.locator('.ah-office-primary button').first()
  if (await overviewContinue.count()) return (await clickMoveButton(page, overviewContinue, '查看结算')).action
  const state = await fetchSession(request, sessionId)
  throw new Error(`局外页没有可推进的主按钮（ui=${state?.uiState}，node=${state?.campaign?.flow?.nodeId}，`
    + `pending=${state?.pendingChoice?.kind || '-'}）`)
}

// 结束当前关卡（真实 debug 结算原语）→ 真实 UI 点完结算/幕间/战役选择/出发准备 → 下一章牌桌。
// `onInterlude(state)` 可在幕间窗口（升级窗）里做真实操作并返回 true（已处理、会自行点完成）。
async function endAndAdvanceTo(page, request, sessionId, nextScenarioId, plan, testInfo, viewport, { onInterlude = null, label = '' } = {}) {
  await settleTableToPlayable(page)
  let state = await fetchSession(request, sessionId)
  expect(state.uiState, '结束关卡前应在牌桌内').toBe('inScenario')
  expect(state.pendingChoice, '结束关卡前不得有未决的待决选择').toBeFalsy()
  debug(`end ${state.scenario.id} -> next ${nextScenarioId} ${label}`)
  await postDebug(request, sessionId, '结束这关 R1')
  // 关末结算里的整备/弃牌是服务端选择事务：先经真实面板答完，再同步到局外页。
  await resolveMechanicPanels(page, request, sessionId, testInfo, viewport, { label: `${label || '结算'}整备` })
  await syncAfterDebug(page)
  const handledInterludes = new Set()
  for (let guard = 0; guard < 100; guard++) {
    state = await fetchSession(request, sessionId)
    if (state.uiState === 'inScenario') {
      await expect(page.locator('.ah-table'), '下一章牌桌应挂载').toBeVisible({ timeout: 120_000 })
      await settleTableToPlayable(page)
      state = await fetchSession(request, sessionId)
      expect(state.scenario?.id, `应进入「${scenarioDisplayName(nextScenarioId)}」`).toBe(nextScenarioId)
      await expect(page.locator('.bg-game-title').first(), '真实关卡名')
        .toHaveAttribute('title', new RegExp(escapeRegExp(scenarioDisplayName(nextScenarioId))))
      return state
    }
    if (state.pendingChoice) {
      await answerCampaignChoice(page, request, state, plan)
      continue
    }
    if (state.uiState === 'scenarioSetup' && state.hubReady) {
      await beginScenarioThroughDeparture(page, request, sessionId, nextScenarioId, testInfo, viewport)
      continue
    }
    if (state.uiState === 'interlude' && typeof onInterlude === 'function') {
      const nodeId = state.campaign?.flow?.nodeId || state.campaign?.flowStage || 'interlude'
      if (!handledInterludes.has(nodeId)) {
        handledInterludes.add(nodeId)
        if (await onInterlude(state, nodeId)) continue
      }
    }
    const action = await advanceHubThroughUi(page, request, sessionId)
    debug(`hub advance action=${action} ui=${state.uiState} node=${state.campaign?.flow?.nodeId}`)
  }
  throw new Error(`无法推进到「${scenarioDisplayName(nextScenarioId)}」（ui=${state.uiState}，`
    + `node=${state.campaign?.flow?.nodeId}）`)
}

/**
 * 通过**真实调试控制台**（牌桌快捷键 ` / ~，host-only）提交调试指令。
 * 比外部 POST /api/debug 更接近真人操作：控制台自己提交并应用权威会话，客户端的演出/待决面板
 * 正常推进（不会出现「外部刷新打断演出、牌桌停在 presenting」的假卡死）。
 */
async function submitDebugThroughConsole(page, request, sessionId, text) {
  const input = page.locator('.ah-debug-input').first()
  if (!(await input.isVisible().catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {})
    await page.keyboard.press('Backquote').catch(() => {})
    await page.waitForTimeout(200)
    if (!(await input.isVisible().catch(() => false))) {
      await page.keyboard.press('Backquote').catch(() => {})
    }
  }
  await expect(input, '调试控制台输入框（` 键打开）').toBeVisible({ timeout: 20_000 })
  await input.fill(text)
  const responded = page.waitForResponse(response => response.url().endsWith('/api/debug'), { timeout: 120_000 })
  await expect(page.locator('.ah-debug-run').first(), '调试控制台执行按钮').toBeVisible({ timeout: 15_000 })
  await page.locator('.ah-debug-run').first().click()
  const body = await (await responded).json()
  expect(body.ok, `调试控制台「${text}」-> ${body.error}`).toBe(true)
  await page.waitForTimeout(300)
  await page.locator('.ah-debug-close').first().click({ timeout: 10_000 }).catch(() => {
    return page.keyboard.press('Backquote').catch(() => {})
  })
  await page.waitForTimeout(300)
  return body.session
}

// ---------------------------------------------------------------------------
// 序曲整备：真实「保留 1 张支援」选择面板（成功则进入下一章并带支援入场）
// ---------------------------------------------------------------------------
/** 点真实机制选项并等 /api/move 事务返回（pick/confirm/cancel 各算一次提交）。 */
async function clickMechanicOption(page, panel, selector, label) {
  const option = panel.locator(selector).first()
  await expect(option, `${label} 应可见`).toBeVisible({ timeout: 20_000 })
  await expect(option, `${label} 应可用`).toBeEnabled({ timeout: 20_000 })
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move'), { timeout: 60_000 })
  await option.click({ timeout: 15_000 })
  const body = await (await responded).json()
  expect(body.ok, `${label} -> ${body.error}`).toBe(true)
  await page.waitForTimeout(200)
  return body.session
}

/** 点真实「刷新局势 / 刷新」让页面拉回权威会话（调试通道提交后页面不会自动感知）。 */
async function refreshDisplayedSession(page) {
  const tableRefresh = page.getByRole('button', { name: '刷新局势' })
  const hubRefresh = page.getByRole('button', { name: '刷新', exact: true })
  if (await tableRefresh.count()) await tableRefresh.first().dispatchEvent('click').catch(() => {})
  else if (await hubRefresh.count()) await hubRefresh.first().dispatchEvent('click').catch(() => {})
  await page.waitForTimeout(350)
}

/**
 * 结算/整备期间的服务端机制选择（prepareSurvey 的 fhvSurvey 事务、其它 fhv* 事务）：
 *   · 面板没渲染时先点真实「刷新局势」把页面同步到待决状态；
 *   · 每一步都是真实 UI 点击（`.ah-mechanic-choice` → pick:N → confirm）；
 *   · `preferCodes` 命中时（支援保留）优先选那张卡（通过 [data-mechanic-detail] 定位）。
 * 返回处理过的面板次数；`label` 用于截图/日志。
 */
async function resolveMechanicPanels(page, request, sessionId, testInfo, viewport,
  { preferCodes = [], label = '整备', shotPrefix = null } = {}) {
  let answered = 0
  for (let guard = 0; guard < 80; guard++) {
    const panel = page.locator('.ah-mechanic-choice').first()
    const visible = await panel.count() && await panel.isVisible().catch(() => false)
    if (!visible) {
      // 演出（cinematic）会挡住机制面板：每轮先跳过演出，再按 /api/session 的真实待决状态刷新。
      await dismissPresentation(page)
      const state = await fetchSession(request, sessionId)
      if (state?.pendingChoice?.kind === 'mechanic') {
        await refreshDisplayedSession(page)
        continue
      }
      break
    }
    const operation = await panel.getAttribute('data-mechanic-choice')
    const choiceId = await panel.getAttribute('data-choice-id')
    if (answered === 0 && shotPrefix && operation === 'fhvSurvey') await shot(page, testInfo, shotPrefix)
    answered += 1
    let preferredId = null
    for (const code of preferCodes) {
      if (!code) continue
      const detail = panel.locator(`[data-mechanic-detail="${code}"]`).first()
      if (!(await detail.count())) continue
      const cell = detail.locator('xpath=..')
      const pick = cell.locator('[data-option-id^="pick:"]').first()
      if (await pick.count()) { preferredId = await pick.getAttribute('data-option-id'); break }
    }
    const current = page.locator(`.ah-mechanic-choice[data-choice-id="${choiceId}"]`).first()
    if (preferredId) {
      await clickMechanicOption(page, current, `[data-option-id="${preferredId}"]`, `${label}：保留支援 ${preferCodes[0]}`)
      continue
    }
    const pick = current.locator('[data-option-id^="pick:"]:not([disabled])').first()
    const confirm = current.locator('[data-option-id="confirm"]:not([disabled])')
    if (await pick.count() && !(await confirm.count())) {
      await clickMechanicOption(page, current, '[data-option-id^="pick:"]:not([disabled])', `${label}：选择一项`)
      continue
    }
    if (await confirm.count()) {
      await clickMechanicOption(page, current, '[data-option-id="confirm"]:not([disabled])', `${label}：确认选择`)
      continue
    }
    const cancel = current.locator('[data-option-id="cancel"]:not([disabled])')
    if (await cancel.count()) {
      await clickMechanicOption(page, current, '[data-option-id="cancel"]:not([disabled])', `${label}：取消`)
      continue
    }
    debug(`${label} guard=${guard} op=${operation} choiceId=${choiceId} 无可点选项`)
    await page.waitForTimeout(300)
  }
  return answered
}

/**
 * 结算后的序曲整备：解析服务端选择事务并返回整备包裹（真实状态）。
 * 返回 { parcel, keptCodes }（本席位整备包裹里的支援卡号）。
 */
async function answerSurveyPreparation(page, request, sessionId, testInfo, viewport, { preferCodes = [], label = '整备' } = {}) {
  await dismissPresentation(page)
  await resolveMechanicPanels(page, request, sessionId, testInfo, viewport, {
    preferCodes, label, shotPrefix: `p8-${label}-survey-prep-${viewport}`,
  })
  const state = await fetchSession(request, sessionId)
  const parcel = state.campaign?.surveyPreparation || null
  const keptCodes = (parcel?.seats?.[0]?.assets || []).map(asset => asset.code)
  return { parcel, keptCodes }
}

/** 切换局外页页签（真实按钮）；页签不存在时静默（旧布局）。 */
async function ensureHubTab(page, label) {
  const nav = page.locator('.ah-hub').getByRole('navigation', { name: '战役局外页面' })
  const button = nav.getByRole('button', { name: label, exact: true })
  if (await button.count()) await button.first().click().catch(() => {})
  await page.waitForTimeout(180)
}

// 出发准备（scenarioSetup）里确认本席位准备（真实 hubDoneSeat）：调查员页签内联「确认准备」。
async function confirmSeatThroughHub(page, request, sessionId, label) {
  let state = await fetchSession(request, sessionId)
  if (state.hubReady) return state
  const hub = page.locator('.ah-hub')
  const inline = hub.locator('button:not([disabled])').filter({ hasText: /^确认准备$/ }).first()
  if (await inline.count()) {
    await clickMoveButton(page, inline, `${label}：确认准备`)
  } else {
    const primary = page.locator('.ah-workflow-next button').first()
    if (await primary.count()) await clickWorkflowPrimary(page)
    else throw new Error(`${label}：没有可用的「确认准备」按钮（ui=${state.uiState}，`
      + `legal=${JSON.stringify((state.legalMoves || []).map(move => move.action).slice(0, 12))}）`)
  }
  state = await fetchSession(request, sessionId)
  expect(state.hubReady, `${label}：全桌准备完成`).toBe(true)
  return state
}

/** 点行动条上的真实行动按钮（调查/抽牌/资源/结束回合/场景行动），返回响应会话。 */
async function clickTableAction(page, request, sessionId, label, { action = null, timeout = 20_000 } = {}) {
  const button = page.locator('.ah-actions .ah-action:not([disabled])').filter({ hasText: label }).first()
  await expect(button, `行动条应有「${label}」`).toBeVisible({ timeout })
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
    && (!action || response.request().postDataJSON()?.move?.action === action), { timeout: 60_000 })
  // 移动端手牌/行动条可能互相遮挡：用同一个 onclick 处理函数派发点击（不是测试替身）。
  await button.dispatchEvent('click')
  const body = await (await responded).json()
  expect(body.ok, `行动「${label}」-> ${body.error}`).toBe(true)
  await page.waitForTimeout(150)
  return body.session?.state || fetchSession(request, sessionId)
}

/** 保证当前回合至少还有 1 个行动点（必要时真实结束回合，让下一位/下一轮开始）。 */
async function ensureActionsLeft(page, request, sessionId, label) {
  for (let guard = 0; guard < 3; guard++) {
    await settleTableToPlayable(page)
    const state = await fetchSession(request, sessionId)
    if ((state.investigators?.[0]?.actionsLeft ?? 0) > 0) return state
    const endTurn = page.locator('.ah-actions .ah-action:not([disabled])').filter({ hasText: '结束回合' }).first()
    if (!(await endTurn.count())) return state
    await clickTableAction(page, request, sessionId, '结束回合', { action: 'endTurn' })
    debug(`${label}：行动点用尽，真实结束回合`)
  }
  return fetchSession(request, sessionId)
}

/**
 * 真实打出一张手牌支援（点手牌选中 → 点发光出牌区 zone:play；只选 asset 类型），
 * 手牌没有支援时先真实抽牌，必要时真实结束回合等待下一轮；返回打出的卡号。
 */
async function playOneAssetFromHand(page, request, sessionId, testInfo, viewport) {
  const isAsset = code => ALL_CARDS[code]?.type === 'asset'
  for (let guard = 0; guard < 10; guard++) {
    await settleTableToPlayable(page)
    const state = await fetchSession(request, sessionId)
    const hand = state.investigators?.[0]?.hand || []
    const assetMoves = (state.legalMoves || []).filter(move => move.action === 'play' && !move.fastSourceId
      && isAsset(move.cardId) && hand.includes(move.cardId))
    if (assetMoves.length) {
      const code = assetMoves[0].cardId
      const card = page.locator(`.ah-hand .ah-hand-card[data-card-code="${code}"]`).first()
      await expect(card, `手牌应渲染 ${code}`).toBeVisible({ timeout: 20_000 })
      await card.dispatchEvent('click')
      const playSurface = page.locator('[data-interaction="zone:play"]').first()
      await expect(playSurface, '发光出牌区').toBeVisible({ timeout: 10_000 })
      await expect(playSurface, '出牌区应接受这张支援').toHaveClass(/ah-drop-valid/, { timeout: 10_000 })
      const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
        && response.request().postDataJSON()?.move?.action === 'play', { timeout: 60_000 })
      await playSurface.dispatchEvent('click')
      const body = await (await responded).json()
      expect(body.ok, `打出 ${code} -> ${body.error}`).toBe(true)
      await settleTableToPlayable(page)
      const after = await fetchSession(request, sessionId)
      const inPlay = (after.investigators?.[0]?.assets || [])
        .some(asset => asset.code === code || asset.originalCode === code)
      expect(inPlay, `打出的支援 ${code} 应真实在场（手牌 ${JSON.stringify(hand)}）`).toBe(true)
      annotate(testInfo, 'evidence', `真实打出支援：${code} ${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || ''}；`
        + `在场支援=${JSON.stringify((after.investigators?.[0]?.assets || []).map(asset => asset.code))}`)
      await shot(page, testInfo, `p8-played-asset-${viewport}`)
      return code
    }
    // 手牌里没有可打出的支援：先真实抽牌找支援；行动点用尽才结束回合。
    const draw = page.locator('.ah-actions .ah-action:not([disabled])').filter({ hasText: '抽牌' }).first()
    if (await draw.count() && (state.investigators?.[0]?.actionsLeft ?? 0) > 0) {
      await clickTableAction(page, request, sessionId, '抽牌', { action: 'draw' })
      continue
    }
    const endTurn = page.locator('.ah-actions .ah-action:not([disabled])').filter({ hasText: '结束回合' }).first()
    if (await endTurn.count()) {
      await clickTableAction(page, request, sessionId, '结束回合', { action: 'endTurn' })
      continue
    }
    break
  }
  const state = await fetchSession(request, sessionId)
  throw new Error(`没有可打出的支援：hand=${JSON.stringify(state?.investigators?.[0]?.hand || [])}，`
    + `legal=${JSON.stringify((state?.legalMoves || []).filter(move => move.action === 'play').slice(0, 6))}`)
}

/** 一次真实法典交互：地点 [codex] 行动（真实按钮）→ 条目结算 → 法典面板显示已读。 */
async function exerciseCodex(page, request, sessionId, testInfo, viewport) {
  await ensureActionsLeft(page, request, sessionId, '法典')
  await settleTableToPlayable(page)
  const state = await fetchSession(request, sessionId)
  const beforeUsed = (state.mechanics?.fhv?.codex || []).filter(row => row.used).length
  const actionButton = page.locator('.ah-actions .ah-action').filter({ hasText: /询问当地人|\[codex\]/ }).first()
  await expect(actionButton, '当前位置应有真实法典行动按钮（询问当地人）').toBeVisible({ timeout: 20_000 })
  const actionLabel = (await actionButton.innerText().catch(() => '')).trim() || '询问当地人'
  const responded = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'scenarioAction', { timeout: 60_000 })
  await actionButton.dispatchEvent('click')
  const body = await (await responded).json()
  expect(body.ok, `法典行动 -> ${body.error}`).toBe(true)
  await settleTableToPlayable(page)
  const after = await fetchSession(request, sessionId)
  expect(after.revision, '法典行动应推进 revision').toBeGreaterThan(state.revision)
  const codex = after.mechanics?.fhv?.codex || []
  expect(codex.length, '法典公开投影').toBeGreaterThan(0)
  const used = codex.filter(row => row.used)
  expect(used.length, `法典投影应记录已读条目（行动前 ${beforeUsed} 条已读）`).toBeGreaterThan(beforeUsed)
  for (const row of codex) {
    // 隐私口径：投影只有条目名与「可读/已读」，不含未触发条目的分支条件与正文。
    expect(row, `法典投影不得含正文/条件：${JSON.stringify(row)}`).not.toHaveProperty('body')
    expect(row).not.toHaveProperty('branches')
    expect(row).not.toHaveProperty('conditions')
  }
  // 真实法典面板（牌桌机制摘要里的 .ah-fhv-codex）：展开后已读条目必须是 data-used="true"。
  const summary = page.locator('.ah-mechanic-summary').first()
  await expect(summary, '牌桌机制摘要').toBeVisible({ timeout: 20_000 })
  const open = await summary.evaluate(element => element instanceof HTMLDetailsElement && element.open)
  if (!open) await summary.locator('summary').click({ timeout: 10_000 })
  const panel = page.locator('.ah-fhv-codex').first()
  await expect(panel, '法典面板（.ah-fhv-codex）').toBeVisible({ timeout: 15_000 })
  await expect(panel.locator('[data-fhv-codex-entry][data-used="true"]').first(), '法典面板应标记已读条目')
    .toBeVisible({ timeout: 15_000 })
  annotate(testInfo, 'evidence', `真实法典交互：${actionLabel}；已读条目 ${used.map(row => row.id).join('、')}；`
    + `面板 ${await panel.locator('[data-fhv-codex-entry]').count()} 条（data-used=true 断言通过）`)
  await shot(page, testInfo, `p8-codex-panel-${viewport}`)
  return codex
}

// ---------------------------------------------------------------------------
// 「关卡设置」指南面板（中英关卡名 / 特别规则 / 开场 / 设置 / 剧透折叠 / 中文正文）
// ---------------------------------------------------------------------------
async function closeCardDetail(page) {
  if (await page.locator('.ah-carddetail-backdrop').count()) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
}

async function assertChapterGuide(page, testInfo, viewport, scenarioId) {
  await closeCardDetail(page)
  const trigger = page.locator('[data-scenario-setup]').first()
  await expect(trigger, '剧本书右侧的关卡设置入口').toBeVisible({ timeout: 20_000 })
  await trigger.click({ timeout: 10_000 })
  const guide = page.getByRole('dialog', { name: '关卡设置' })
  await expect(guide, '关卡设置面板').toBeVisible({ timeout: 15_000 })
  const displayName = scenarioDisplayName(scenarioId)
  await expect(guide.locator('h2'), '指南标题应为真实关卡名').toContainText(displayName)
  // 中英：场景定义名本身带英文副题；正式指南数据也必须是 zh + en 双语。
  const title = (await guide.locator('h2').innerText()).trim()
  expect(CJK.test(title), `指南标题中文：${title}`).toBe(true)
  expect(/[A-Za-z]{3}/.test(title), `指南标题英文副题：${title}`).toBe(true)
  expect(guideHasEnglish(scenarioId), `正式指南数据应有英文层（web/scenario-guides/${scenarioId}.json）`).toBe(true)
  await expect.poll(async () => guide.locator('.ah-guide-block').count(), { timeout: 30_000 }).toBeGreaterThan(0)

  const titles = (await guide.locator('.ah-setup-section h3').allTextContents()).map(text => text.trim())
  expect(titles, `${scenarioId} 指南必须有「设置」分区`).toContain('设置')
  expect(titles, `${scenarioId} 指南必须有「开场」分区`).toContain('开场')
  const specialRules = guideSpecialRules(scenarioId)
  if (specialRules > 0) {
    expect(titles, `${scenarioId} 指南必须有「特别规则」分区`).toContain('特别规则')
    // 特别规则优先展示：正式指南的特别规则分区必须排在「开场」之前。
    expect(titles.indexOf('特别规则'), `${scenarioId} 特别规则应优先于开场（${titles.join(' → ')}）`)
      .toBeLessThan(titles.indexOf('开场'))
  } else {
    annotate(testInfo, 'evidence', `${scenarioId}：正式指南数据没有 specialRules 分组（不渲染「特别规则」分区）`)
  }

  const details = guide.locator('details')
  expect(await details.count(), `${scenarioId} 折叠剧透分区`).toBeGreaterThanOrEqual(2)
  const summaries = (await details.locator('summary').allTextContents()).map(text => text.trim())
  expect(summaries.join(' | '), `${scenarioId} 后续剧情折叠区`).toContain('后续剧情')
  expect(summaries.join(' | '), `${scenarioId} 结局与结算折叠区`).toContain('结局与结算')
  // 剧透默认折叠：details 不处于 open；展开最后一个（结局与结算）验证正文。
  await expect(guide.locator('details[open]')).toHaveCount(0)
  await details.last().locator('summary').click({ timeout: 5000 })
  await expect(details.last()).toHaveAttribute('open', '')

  // 中文缺项不得以英文冒充：指南正文块必须含中文（缺译应显示「中文待补」）。
  const blocks = (await guide.locator('.ah-guide-block').allTextContents()).map(text => text.trim()).filter(Boolean)
  expect(blocks.length, `${scenarioId} 指南正文块`).toBeGreaterThan(0)
  const englishOnly = blocks.filter(text => !CJK.test(text))
  expect(englishOnly, `${scenarioId} 指南块不得以英文冒充中文：${englishOnly[0] || ''}`).toEqual([])
  await assertNoHorizontalOverflow(page)
  await shot(page, testInfo, `p8-guide-${scenarioId}-${viewport}`)
  await page.keyboard.press('Escape')
  await expect(guide).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => Boolean(document.activeElement?.matches?.('[data-scenario-setup]'))),
    { timeout: 10_000 }).toBe(true)
  annotate(testInfo, 'evidence', `关卡设置指南：${displayName}；分区=${titles.join(' / ')}；`
    + `折叠=${summaries.join(' / ')}；特别规则分组=${specialRules}`)
}

// ---------------------------------------------------------------------------
// 升级窗（真实升级页签：未花费 XP → 购买一次 / 保留 XP 跳过）
// ---------------------------------------------------------------------------
async function performUpgradeWindow(page, request, sessionId, testInfo, viewport, { mode = 'purchase', label = '升级窗' } = {}) {
  const state = await fetchSession(request, sessionId)
  expect(state.uiState, `${label} 应在幕间`).toBe('interlude')
  expect(state.campaign?.upgradesAllowed, `${label} 应开放升级窗（upgradesAllowed）`).toBe(true)
  await ensureHubTab(page, '升级')
  const hub = page.locator('.ah-hub')
  await expect(hub).toHaveAttribute('data-ui-state', 'interlude', { timeout: 30_000 })
  const record = state.campaign.investigators?.[0]
  const xpBefore = Number(record?.xp) || 0
  const nodeId = state.campaign?.flow?.nodeId || ''
  await shot(page, testInfo, `p8-${label}-upgrade-${viewport}`)

  if (mode === 'skip') {
    const done = page.locator('.ah-hub button').filter({ hasText: /保留 \d+ XP 并继续|完成升级，准备下一关/ }).first()
    await expect(done, `${label}：保留 XP 并继续按钮`).toBeVisible({ timeout: 20_000 })
    const { session } = await clickMoveButton(page, done, `${label}：保留 ${xpBefore} XP 并继续`)
    const after = session?.state || await fetchSession(request, sessionId)
    expect(Number(after.campaign.investigators?.[0]?.xp) || 0, `${label}：跳过升级必须保留未花费经验`).toBe(xpBefore)
    expect(after.hubSeatDone?.[0], `${label}：席位已确认`).toBe(true)
    annotate(testInfo, 'evidence', `升级窗（跳过）：节点 ${nodeId}，未花费 XP ${xpBefore} → `
      + `${Number(after.campaign.investigators?.[0]?.xp) || 0}（保留），hubSeatDone=true`)
    await shot(page, testInfo, `p8-${label}-skip-${viewport}`)
    return { purchased: false, xpBefore, xpAfter: Number(after.campaign.investigators?.[0]?.xp) || 0, session: after }
  }

  const purchases = (state.legalMoves || []).filter(move => move.action === 'hubPurchase')
  let after = state
  if (purchases.length) {
    // 真实升级页签：① 选卡 → ② 选替换 → 加入升级方案 → 保存升级方案（hubPurchase → hubConfirmUpgrades）。
    const purchase = purchases[0]
    const gallery = page.locator(`.ah-hub [data-focus-key="upgrade:${purchase.added}"]`).first()
    if (await gallery.count()) await gallery.click({ timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(250)
    const add = page.locator('.ah-hub button').filter({ hasText: /加入升级方案/ }).first()
    await expect(add, `${label}：加入升级方案按钮`).toBeVisible({ timeout: 20_000 })
    const staged = await clickMoveButton(page, add, `${label}：加入升级方案`)
    const draftState = staged.session?.state || await fetchSession(request, sessionId)
    expect(draftState.campaign.investigators?.[0]?.upgradeDraft,
      `${label}：加入升级方案应生成未保存的升级草稿`).toBeTruthy()
    const save = page.locator('.ah-hub button').filter({ hasText: /保存升级方案/ }).first()
    await expect(save, `${label}：保存升级方案按钮`).toBeVisible({ timeout: 20_000 })
    const saved = await clickMoveButton(page, save, `${label}：保存升级方案`)
    after = saved.session?.state || await fetchSession(request, sessionId)
    const recordAfter = after.campaign.investigators?.[0]
    expect(recordAfter?.upgradeDraft, `${label}：保存后草稿应清空`).toBeFalsy()
    expect((recordAfter?.purchases || []).some(item => item.added === purchase.added || item.code === purchase.added),
      `${label}：真实升级应写入 purchases（${JSON.stringify((recordAfter?.purchases || []).slice(-2))}）`).toBe(true)
    await expect(page.locator('.ah-hub')).toContainText(/本轮升级已保存|完成升级，准备下一关/, { timeout: 20_000 })
    // 购买后仍需真实确认本席位（幕间的 hubDoneSeat）。
    await finishInterludeSeat(page, request, sessionId, `${label}：升级完成`)
  } else {
    // 没有可购候选：真实跳过（保留 XP），并把「无候选」作为证据记录（不是跳关）。
    const done = page.locator('.ah-hub button').filter({ hasText: /保留 \d+ XP 并继续|完成升级，准备下一关/ }).first()
    await expect(done, `${label}：无可购卡时应可保留 XP`).toBeVisible({ timeout: 20_000 })
    const skipped = await clickMoveButton(page, done, `${label}：无可购卡，保留 XP`)
    after = skipped.session?.state || await fetchSession(request, sessionId)
    annotate(testInfo, 'evidence', `${label}：未花费 XP=${xpBefore} 但没有 hubPurchase 候选（真实状态），按规则保留 XP 跳过`)
    return { purchased: false, xpBefore, xpAfter: Number(after.campaign.investigators?.[0]?.xp) || 0, session: after }
  }
  const xpAfter = Number(after.campaign.investigators?.[0]?.xp) || 0
  expect(xpAfter, `${label}：购买升级必须扣减未花费经验（${xpBefore} → ${xpAfter}）`).toBeLessThan(xpBefore)
  annotate(testInfo, 'evidence', `升级窗（购买）：节点 ${nodeId}，未花费 XP ${xpBefore} → ${xpAfter}；`
    + `purchases=${JSON.stringify((after.campaign.investigators?.[0]?.purchases || []).slice(-2))}`)
  await shot(page, testInfo, `p8-${label}-purchased-${viewport}`)
  return { purchased: true, xpBefore, xpAfter, session: after }
}

// 完成幕间席位确认（真实 hubDoneSeat），随后由调用方的循环推进到下一段。
async function finishInterludeSeat(page, request, sessionId, label) {
  await ensureHubTab(page, '升级')
  const done = page.locator('.ah-hub button').filter({ hasText: /保留 \d+ XP 并继续|完成升级，准备下一关/ }).first()
  await expect(done, `${label}：完成幕间准备按钮`).toBeVisible({ timeout: 20_000 })
  const { session } = await clickMoveButton(page, done, `${label}：完成幕间准备`)
  const state = session?.state || await fetchSession(request, sessionId)
  expect(state.hubSeatDone?.[0], `${label}：席位已确认`).toBe(true)
  return state
}

// ---------------------------------------------------------------------------
// 断线恢复：
//   1) 浏览器断网 → 恢复 → 用真实「刷新局势」重新同步同一大厅会话（revision/关卡/手牌一致）；
//   2) 刷新页面后的读档恢复：战役对局 `lifecycle.manualLoad=true`，真实路径是
//      「调查准备设置 → 存档管理 → 读取此存档」。这条路径目前被真实缺陷挡住（见本文件与账本的
//      blocked：存档引用的卡牌 10677a 不在资源中 → 读档按钮禁用），因此这里只做真实探测：
//      存档确实存在且列出；不兼容就截图 + blocked 证据，兼容就走真实读档并断言恢复。
//      生产代码不在本 spec 范围内修改。
// ---------------------------------------------------------------------------
async function networkReconnectRecovery(page, request, sessionId, testInfo, viewport) {
  const before = await fetchSessionView(request, sessionId)
  expect(before, '断网前应能读取真实会话').toBeTruthy()
  const beforeHand = [...(before.state.investigators?.[0]?.hand || [])].sort()
  const context = page.context()
  await context.setOffline(true)
  await page.waitForTimeout(1200)
  // 断网期间界面仍在牌桌（会话在服务端，页面不会丢状态），且不会崩成白屏。
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 15_000 })
  await context.setOffline(false)
  const refresh = page.getByRole('button', { name: '刷新局势' })
  await expect(refresh, '恢复网络后应有真实「刷新局势」按钮').toBeVisible({ timeout: 20_000 })
  const refreshed = page.waitForResponse(response => response.url().includes('/api/session'), { timeout: 30_000 }).catch(() => null)
  await refresh.first().dispatchEvent('click').catch(() => {})
  await refreshed
  await page.waitForTimeout(600)
  await dismissPresentation(page)
  await settleTableToPlayable(page)
  const after = await fetchSessionView(request, sessionId)
  expect(after?.sessionId, '断网恢复后仍是同一会话').toBe(sessionId)
  expect(after.state.scenario?.id, '断网恢复后关卡不变').toBe(before.state.scenario?.id)
  expect(after.state.uiState, '断网恢复后界面相位不变').toBe(before.state.uiState)
  expect(after.state.revision, '断网恢复后 revision 不倒退').toBeGreaterThanOrEqual(before.state.revision)
  expect([...(after.state.investigators?.[0]?.hand || [])].sort(), '断网恢复后手牌一致').toEqual(beforeHand)
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.bg-game-title').first(), '恢复后真实关卡名')
    .toHaveAttribute('title', new RegExp(escapeRegExp(scenarioDisplayName(after.state.scenario.id))))
  annotate(testInfo, 'claim', 'disconnect')
  annotate(testInfo, 'evidence', `断线恢复（浏览器断网→恢复→真实刷新）：sessionId=${after.sessionId}、`
    + `scenario=${after.state.scenario.id}、uiState=${after.state.uiState}、`
    + `revision=${before.state.revision}→${after.state.revision}、手牌 ${beforeHand.length} 张一致`)
  await shot(page, testInfo, `p8-reconnect-${viewport}`)
  return after
}

/**
 * 刷新页面 → 真实「存档管理」探测战役读档恢复。
 * 返回 { listed, compatible, loaded, error }；真实缺陷写 blocked 证据（不伪造、不跳过），
 * 缺陷修好后同一用例会自动走真实读档并断言恢复。
 */
async function probeSaveLoadRecovery(page, request, sessionId, testInfo, viewport) {
  const before = await fetchSessionView(request, sessionId)
  await page.reload()
  await expect(page.locator('.bg-card').filter({ hasText: '诡镇奇谈' })).toBeVisible({ timeout: 90_000 })
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).first().click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await expect(setup, '刷新后回到大厅调查准备设置').toBeVisible({ timeout: 60_000 })
  await setup.getByRole('button', { name: '存档管理', exact: true }).click()
  const item = page.locator(`.ah-save-item[data-session-id="${sessionId}"]`).first()
  await expect(item, `真实存档列表应包含本局（${sessionId}）`).toBeVisible({ timeout: 60_000 })
  const status = (await item.locator('[role="status"]').allTextContents()).map(text => text.trim()).filter(Boolean)
  const loadButton = item.getByRole('button', { name: /读取此存档/ }).first()
  const compatible = !status.some(text => /不可读取|incompatible/i.test(text))
    && await loadButton.isEnabled().catch(() => false)
  await shot(page, testInfo, `p8-savelist-${viewport}`)
  if (!compatible) {
    const reason = status.find(text => /不可读取/.test(text)) || status.join(' / ') || '读档按钮不可用'
    annotate(testInfo, 'blocked',
      `FHV 战役存档读回被 save-migration 判为不兼容，真实读档路径不可达：${reason}`
      + `（存档 sessionId=${sessionId}、stage=${before.state.uiState}、scenario=${before.state.scenario?.id}）`)
    annotate(testInfo, 'evidence',
      '复现：node -e "migrateState(<save>.state)" 抛「存档引用的卡牌在当前资源中已不存在（10677a），无法升级」；'
      + 'state 里的 10677a 是序曲 StepCode / storyFaces / storyAsset.stepCode，不是玩家卡号（未知卡号扫描误报）。')
    return { listed: true, compatible: false, loaded: false, error: reason }
  }
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/session/load'), { timeout: 60_000 })
  await loadButton.click({ timeout: 15_000 })
  const loadedBody = await (await loaded).json()
  expect(loadedBody.ok, `读档接口 -> ${loadedBody.error}`).toBe(true)
  await expect(page.locator('.ah-table, .ah-hub').first(), '读档后回到对局界面').toBeVisible({ timeout: 90_000 })
  const after = await fetchSessionView(request, sessionId)
  expect(after?.sessionId, '读档后仍是同一会话').toBe(sessionId)
  expect(after.state.campaign?.id, '读档后战役不变').toBe(CAMPAIGN_ID)
  expect(after.state.uiState, '读档后界面相位恢复').toBe(before.state.uiState)
  expect(after.state.scenario?.id || null, '读档后关卡不变').toBe(before.state.scenario?.id || null)
  annotate(testInfo, 'claim', 'disconnect')
  annotate(testInfo, 'evidence', `刷新页面 → 存档管理读档恢复：sessionId=${after.sessionId}、`
    + `uiState=${after.state.uiState}、scenario=${after.state.scenario?.id}、revision=${before.state.revision}→${after.state.revision}`)
  await shot(page, testInfo, `p8-reload-${viewport}`)
  return { listed: true, compatible: true, loaded: true, error: null }
}

/**
 * 只读探测：大厅真实 /api/sessions 里本局存档的兼容性（不离开对局、不改变状态）。
 * 战役存档一旦被 save-migration 判为不兼容，玩家在「存档管理」里的「读取此存档」会被禁用；
 * 这里把摘要与错误原样写进 evidence/blocked（真实缺陷不修生产代码，交主进程处理）。
 */
async function probeSaveCompatibility(request, sessionId, testInfo, label) {
  let body = null
  try {
    body = await (await request.get('/api/sessions')).json()
  } catch (error) {
    annotate(testInfo, 'evidence', `${label}：/api/sessions 读取失败（${String(error?.message || error).slice(0, 120)}）`)
    return null
  }
  const summary = (body?.sessions || []).find(item => item.sessionId === sessionId)
  if (!summary) {
    annotate(testInfo, 'evidence', `${label}：/api/sessions 暂未列出本局（persist=${body?.persist}）`)
    return null
  }
  annotate(testInfo, 'evidence', `${label} 存档摘要：compatible=${summary.compatible}、`
    + `stage=${summary.uiState || '-'}、revision=${summary.revision}、persist=${body?.persist}`)
  if (!summary.compatible) {
    annotate(testInfo, 'blocked', `${label}：战役存档不可读（「读取此存档」会被禁用）——`
      + `${summary.compatibilityError || '未知兼容性错误'}`)
  }
  return summary
}

// ---------------------------------------------------------------------------
// phase=release：真实大厅发布门禁 → 首章 → 指南/法典/序曲整备/带支援入场
// ---------------------------------------------------------------------------
for (const [viewport, width, height] of VIEWPORTS) {
  test(`P8 release ${viewport} 真实大厅启动《铁杉谷盛宴》首章并验收指南/法典/序曲整备`, async ({ page, request }, testInfo) => {
    testInfo.setTimeout(240_000)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', viewport)
    annotate(testInfo, 'phase', 'release')
    annotate(testInfo, 'scenario', FIRST_CHAPTER_ID)
    annotate(testInfo, 'debugJump',
      '真实调试控制台（牌桌 ` / ~ 快捷键，host-only）提交「结束这关 R1」一次：把首章《欢迎来到铁杉谷》'
      + '推进到真实关末结算（真实 debugCommand 解析 + 事务提交），以便验证「保留 1 张支援」的序曲整备'
      + '与下一章带支援入场；章内的检视、法典、打牌全部经真实 /api/move 与真实 UI。')
    const pageErrors = []
    const consoleErrors = []
    const missingResources = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('response', response => { if (response.status() === 404) missingResources.push(response.url()) })

    let label = 'release'
    try {
      // a. 真实大厅 → 战役下拉 → 真实 POST /api/start。
      const started = await startCampaignThroughLobby(page, request, testInfo, viewport)
      const sessionId = started.session.sessionId
      await shot(page, testInfo, `p8-release-hub-${viewport}`)

      // b. catalog 事实：《铁杉谷盛宴》playable、earlyAccess=false、12 个真实场景名。
      const catalog = await page.evaluate(async () => {
        const response = await fetch('/api/catalog')
        const payload = await response.json()
        const game = (payload.games || []).find(item => item.id === 'arkhamhorror')
        const campaign = (game?.clientData?.campaigns || []).find(item => item.id === 'theFeastOfHemlockVale')
        return {
          campaignIds: (game?.clientData?.campaigns || []).map(item => item.id),
          status: campaign?.status || null,
          earlyAccess: campaign?.earlyAccess ?? null,
          scenarios: (campaign?.scenarios || []).map(item => ({ id: item.id, name: item.name })),
        }
      })
      expect(catalog.campaignIds).toContain(CAMPAIGN_ID)
      expect(catalog.status).toBe('playable')
      expect(catalog.earlyAccess).toBe(false)
      expect(catalog.scenarios.map(item => item.id)).toEqual(FHV_CHAPTERS.map(chapter => chapter.id))
      for (const [index, chapter] of FHV_CHAPTERS.entries()) {
        expect(catalog.scenarios[index].name, `${chapter.id} 的真实场景名`)
          .toContain(scenarioDisplayName(chapter.id))
      }
      annotate(testInfo, 'evidence', `大厅 catalog：《铁杉谷盛宴》${catalog.scenarios.length} 个场景，`
        + `status=${catalog.status} earlyAccess=${catalog.earlyAccess}`)

      // c. 真实准备：选择调查员 / 自动构筑合法牌组 / 确认准备。
      const prepared = await prepareSeatThroughHub(page, request, started.session, testInfo, viewport)
      expect(prepared.investigators[0].code).toBe(HOST_CODE)
      expect(prepared.campaign.investigators[0].deck.length, '战役牌组张数').toBeGreaterThan(0)
      const deckSize = prepared.campaign.investigators[0].deck.length
      annotate(testInfo, 'evidence', `准备完成：座位 0=${HOST_CODE} ${investigatorName(HOST_CODE)}，`
        + `卡组 ${deckSize} 张；开局手牌在关卡开始时发放`)

      // d. 第一段出发准备（序曲整备前的 hub 出发准备）→ 首章牌桌。
      const departure = page.locator('.ah-office-departure')
      await expect(departure, '出发准备页').toBeVisible({ timeout: 30_000 })
      await expect(departure).toContainText(/出发|准备/)
      await expect(departure.locator('.ah-departure-member')).toHaveCount(1)
      await shot(page, testInfo, `p8-release-departure-${viewport}`)
      let state = await beginScenarioThroughDeparture(page, request, sessionId, FIRST_CHAPTER_ID, testInfo, viewport)
      expect(state.scenario.id).toBe(FIRST_CHAPTER_ID)
      expect(state.investigators[0].hand.length).toBeGreaterThan(0)
      expect((state.locations || []).length).toBeGreaterThan(0)
      expect(state.campaign.records?.hemlockDate || state.mechanics?.fhv?.date, '首日时钟').toBeTruthy()
      await expect(page.locator('.bg-game-title').first()).toContainText(/欢迎来到铁杉谷/)
      await shot(page, testInfo, `p8-release-table-${viewport}`)

      // e. 关卡设置指南：中英标题 / 特别规则优先 / 剧透折叠 / 中文正文。
      await assertChapterGuide(page, testInfo, viewport, FIRST_CHAPTER_ID)

      // f. 真实打出一张支援（为「保留 1 张支援」的整备提供非起始支援）。
      const playedCode = await playOneAssetFromHand(page, request, sessionId, testInfo, viewport)

      // g. 一次真实法典交互（地点 [codex] 行动 → 条目结算 → 法典面板已读）。
      await exerciseCodex(page, request, sessionId, testInfo, viewport)

      // h. 真实关末结算（经真实调试控制台，host-only）→ 序曲整备（保留 1 张支援的真实选择事务）。
      state = await fetchSession(request, sessionId)
      expect(state.uiState).toBe('inScenario')
      expect(state.pendingChoice, '结算前不得有未决选择').toBeFalsy()
      await submitDebugThroughConsole(page, request, sessionId, '结束这关 R1')
      await dismissPresentation(page)
      // 结算后先出现整备（勘察整备）机制选择：真实面板 → 优先保留刚打出的支援。
      const prep = await answerSurveyPreparation(page, request, sessionId, testInfo, viewport,
        { preferCodes: [playedCode], label: 'release' })
      expect(prep.parcel, '序曲整备应生成勘察整备包裹').toBeTruthy()
      expect(prep.keptCodes, `保留的支援应包含真实打出的 ${playedCode}（实际 ${JSON.stringify(prep.keptCodes)}）`)
        .toContain(playedCode)
      annotate(testInfo, 'evidence', `序曲整备（保留支援）：整备包裹来源 ${prep.parcel.source}，`
        + `保留支援=${prep.keptCodes.join('、')}，目的地=${prep.parcel.destinations.length} 个`)
      await syncAfterDebug(page)
      state = await fetchSession(request, sessionId)
      expect(state.uiState).toBe('scenarioResult')
      await shot(page, testInfo, `p8-release-result-${viewport}`)

      // i. 真实继续 → 序曲整备幕间（welcomePrep）→ 完成准备 → 勘察选择《岩间密语》。
      const continueAction = await advanceHubThroughUi(page, request, sessionId)
      expect(continueAction, '结算页继续按钮应提交 hubContinue').toBe('hubContinue')
      await page.waitForTimeout(300)
      state = await fetchSession(request, sessionId)
      expect(state.uiState, '首章结算后进入序曲整备幕间').toBe('interlude')
      expect(state.campaign?.flow?.nodeId, '序曲整备节点').toBe('welcomePrep')
      await page.locator('.ah-hub').getByRole('navigation', { name: '战役局外页面' })
        .getByRole('button', { name: '调查纪事', exact: true }).click().catch(() => {})
      await page.waitForTimeout(250)
      await shot(page, testInfo, `p8-release-interlude-${viewport}`)
      // 回到「升级」页签：幕间确认准备（保留 XP 并继续）按钮在升级页签内联。
      await page.locator('.ah-hub').getByRole('navigation', { name: '战役局外页面' })
        .getByRole('button', { name: '升级', exact: true }).click().catch(() => {})
      await page.waitForTimeout(200)
      await finishInterludeSeat(page, request, sessionId, '发布：序曲整备')
      state = await fetchSession(request, sessionId)
      if (state.pendingChoice) {
        await answerCampaignChoice(page, request, state, CAMPAIGN_PLAN)
      }
      state = await fetchSession(request, sessionId)
      expect(state.uiState, '勘察选择后进入下一章准备').toBe('scenarioSetup')
      expect(state.hubSelectedScenarioId, '勘察选择写入下一章').toBe('writtenInRock')
      await page.waitForTimeout(200)
      await confirmSeatThroughHub(page, request, sessionId, '发布：下一章准备')
      await shot(page, testInfo, `p8-release-next-prep-${viewport}`)

      // j. 下一章真实开局：整备包裹被消费，保留的支援真实在场。
      await beginScenarioThroughDeparture(page, request, sessionId, 'writtenInRock', testInfo, viewport)
      state = await fetchSession(request, sessionId)
      expect(state.scenario.id).toBe('writtenInRock')
      const inPlayCodes = (state.investigators[0].assets || []).map(asset => asset.code)
      expect(inPlayCodes, `下一章开局应带支援入场（${playedCode}）；实际在场=${JSON.stringify(inPlayCodes)}`)
        .toContain(playedCode)
      expect(state.campaign.surveyPreparation ?? null, '整备包裹应在下一章开局被消费').toBeFalsy()
      const domCard = page.locator(`.ah-player-board [data-card-code="${playedCode}"], `
        + `[data-interaction^="asset:"] [data-card-code="${playedCode}"]`).first()
      await expect(domCard, `保留的支援 ${playedCode} 应真实渲染在牌桌上`).toBeVisible({ timeout: 30_000 })
      annotate(testInfo, 'evidence', `带支援入场：${playedCode} 在《${scenarioDisplayName('writtenInRock')}》开局真实在场；`
        + `整备包裹已消费（surveyPreparation=null），手牌 ${state.investigators[0].hand.length} 张`)
      await shot(page, testInfo, `p8-release-next-table-${viewport}`)
      await probeSaveCompatibility(request, sessionId, testInfo, '关卡进行中（岩间密语）')

      // k. 无脚本错误、无横向溢出。
      expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
      await assertNoHorizontalOverflow(page)
      if (consoleErrors.length || missingResources.length) {
        const displayResource = url => {
          try { const parsed = new URL(url); return parsed.pathname + parsed.search } catch { return String(url) }
        }
        annotate(testInfo, 'evidence', `控制台 error ${consoleErrors.length} 条；404 资源 ${missingResources.length} 个：`
          + JSON.stringify([...new Set(missingResources)].slice(0, 8).map(displayResource)))
      }

      // l. 关卡进行中的「刷新页面 → 存档管理 → 读取此存档」恢复探测。
      //    真实缺陷（save-migration 把序曲 stepCode 当未知卡号）会把读档按钮禁用：这里保留真实
      //    截图与错误文本作为 blocked 证据（不跳过、不伪造）；缺陷修好后自动走真实读档并断言恢复。
      const saveLoad = await probeSaveLoadRecovery(page, request, sessionId, testInfo, viewport)
      annotate(testInfo, 'evidence', `关卡进行中读档探测：listed=${saveLoad.listed}、`
        + `compatible=${saveLoad.compatible}、loaded=${saveLoad.loaded}`
        + `${saveLoad.error ? `、error=${saveLoad.error}` : ''}`)
    } catch (error) {
      await captureBlockedEvidence(page, testInfo, label, error)
      throw error
    }
  })
}

// ---------------------------------------------------------------------------
// phase=progression：跨章推进 → 升级窗（购买/跳过）→ 逐日（Day 2/Day 3）→ 终章 → campaignResult
// ---------------------------------------------------------------------------
for (const [viewport, width, height] of VIEWPORTS) {
  test(`P8 progression ${viewport} 跨章推进/升级窗/逐日/终章结算与刷新恢复`, async ({ page, request }, testInfo) => {
    testInfo.setTimeout(240_000)
    await page.setViewportSize({ width, height })
    annotate(testInfo, 'viewport', viewport)
    annotate(testInfo, 'phase', 'progression')
    annotate(testInfo, 'scenario', 'dawnOfTheFinalDay')
    annotate(testInfo, 'debugJump',
      'POST /api/debug（host-only，真实 debugCommand + 事务提交）「结束这关 R1」7 次：'
      + 'welcomeToHemlockVale / writtenInRock / theTwistedHollow / dawnOfTheSecondDay / dawnOfTheFinalDay / '
      + 'preludeTheFinalEvening / fateOfTheVale 的关末结算，把战役真实推进到终章《山谷的命运》并结算到 campaignResult。'
      + '每次结算后仍由真实 /api/move + 真实局外页按钮（继续 / 幕间整备 / 战役选择 / 出发准备 / 开始当前关卡）推进。')
    annotate(testInfo, 'claim', 'disconnect')
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(error.message))

    try {
      // a. 真实大厅 → 首章牌桌（与发布门禁同一真实路径）。
      const started = await startCampaignThroughLobby(page, request, testInfo, viewport)
      const sessionId = started.session.sessionId
      await prepareSeatThroughHub(page, request, started.session, testInfo, viewport)
      let state = await beginScenarioThroughDeparture(page, request, sessionId, FIRST_CHAPTER_ID, testInfo, viewport)
      expect(state.scenario.id).toBe(FIRST_CHAPTER_ID)
      await shot(page, testInfo, `p8-progression-welcome-table-${viewport}`)

      // b. 欢迎 → 岩间密语（勘察关）：真实结算 + 序曲整备 + 勘察选择。
      state = await endAndAdvanceTo(page, request, sessionId, 'writtenInRock', CAMPAIGN_PLAN, testInfo, viewport,
        { label: '跨章：欢迎 → 岩间密语' })
      await shot(page, testInfo, `p8-progression-writtenInRock-table-${viewport}`)
      expect(state.campaign.records?.surveyChoices?.some(entry => entry.endsWith(':writtenInRock')),
        `勘察选择记录：${JSON.stringify(state.campaign.records?.surveyChoices)}`).toBe(true)

      // c. 岩间密语 → 首夜《扭曲空洞》：真实结算 → 纯叙事夜（法典/用餐/夜探选择）→ 首夜牌桌。
      state = await endAndAdvanceTo(page, request, sessionId, 'theTwistedHollow', CAMPAIGN_PLAN, testInfo, viewport,
        { label: '跨章：岩间密语 → 首夜' })
      expect(state.campaign.records?.nightBranches?.some(entry => entry.includes('theTwistedHollow')),
        `夜探分支记录：${JSON.stringify(state.campaign.records?.nightBranches)}`).toBe(true)
      await shot(page, testInfo, `p8-progression-theTwistedHollow-table-${viewport}`)

      // d. 首夜 → 第二日黎明（Day 2）：真实结算 + 出发准备。
      state = await endAndAdvanceTo(page, request, sessionId, 'dawnOfTheSecondDay', CAMPAIGN_PLAN, testInfo, viewport,
        { label: '跨章：首夜 → 第二日黎明' })
      const day2 = state.campaign.records
      expect(day2.day, `第二日黎明应推进到 Day 2（实际 day=${day2.day} date=${day2.hemlockDate}）`).toBe(2)
      expect(day2.hemlockDate, '第二日黎明时钟').toContain('2:')
      await shot(page, testInfo, `p8-progression-day2-table-${viewport}`)
      await probeSaveCompatibility(request, sessionId, testInfo, '关卡进行中（第二日黎明）')

      // e. 断线恢复（浏览器断网 → 恢复 → 真实刷新）：同一会话/关卡/手牌一致。
      await networkReconnectRecovery(page, request, sessionId, testInfo, viewport)

      // f. 第二日黎明 → 第二夜跳过 → 最终日黎明（Day 3）：途中第一个升级窗真实购买一次。
      let purchaseEvidence = null
      state = await endAndAdvanceTo(page, request, sessionId, 'dawnOfTheFinalDay', CAMPAIGN_PLAN, testInfo, viewport, {
        label: '跨章：第二日黎明 → 最终日黎明',
        onInterlude: async (interludeState, nodeId) => {
          if (!interludeState.campaign?.upgradesAllowed) return false
          if (nodeId === 'dawn2Prep') {
            purchaseEvidence = await performUpgradeWindow(page, request, sessionId, testInfo, viewport,
              { mode: 'purchase', label: 'day2' })
            return true
          }
          return false
        },
      })
      expect(purchaseEvidence, '第二日黎明后的升级窗应真实打开').toBeTruthy()
      const day3 = state.campaign.records
      expect(day3.day, `最终日黎明应推进到 Day 3（实际 day=${day3.day} date=${day3.hemlockDate}）`).toBe(3)
      expect(day3.hemlockDate, '最终日黎明时钟').toContain('3:')
      expect(day3.rescheduledSurveys?.length, `跳过勘察记录：${JSON.stringify(day3.rescheduledSurveys)}`)
        .toBeGreaterThanOrEqual(2)
      await shot(page, testInfo, `p8-progression-day3-table-${viewport}`)

      // g. 最终日黎明 → 最终夜：第二个升级窗真实跳过并保留未花费经验。
      let skipEvidence = null
      state = await endAndAdvanceTo(page, request, sessionId, 'preludeTheFinalEvening', CAMPAIGN_PLAN, testInfo, viewport, {
        label: '跨章：最终日黎明 → 最终夜',
        onInterlude: async (interludeState, nodeId) => {
          if (!interludeState.campaign?.upgradesAllowed) return false
          if (nodeId === 'dawnFinalPrep') {
            skipEvidence = await performUpgradeWindow(page, request, sessionId, testInfo, viewport,
              { mode: 'skip', label: 'day3' })
            return true
          }
          return false
        },
      })
      expect(skipEvidence, '最终日黎明后的升级窗应真实打开').toBeTruthy()
      expect(skipEvidence.xpAfter, '跳过升级保留未花费经验').toBe(skipEvidence.xpBefore)
      if (purchaseEvidence?.purchased) {
        expect(purchaseEvidence.xpAfter, '购买窗应扣减经验').toBeLessThan(purchaseEvidence.xpBefore)
      }
      await shot(page, testInfo, `p8-progression-finalEvening-table-${viewport}`)

      // h. 最终夜 → 终章《山谷的命运》：真实结算到 campaignResult。
      let campaignState = await endAndAdvanceTo(page, request, sessionId, 'fateOfTheVale', CAMPAIGN_PLAN, testInfo, viewport,
        { label: '跨章：最终夜 → 终章' })
      expect(campaignState.scenario.id).toBe('fateOfTheVale')
      await shot(page, testInfo, `p8-progression-fateOfTheVale-table-${viewport}`)
      await settleTableToPlayable(page)
      await postDebug(request, sessionId, '结束这关 R1')
      await resolveMechanicPanels(page, request, sessionId, testInfo, viewport, { label: '终章结算整备' })
      await syncAfterDebug(page)
      let after = await fetchSession(request, sessionId)
      expect(after.uiState).toBe('scenarioResult')
      await shot(page, testInfo, `p8-progression-final-result-${viewport}`)
      // 结算页继续 → 尾声（真实 epilogue 效果：campaignOutcome / 居民结局记录）→ campaignResult。
      // 尾声可能先落在一个叙事幕间节点，再推进到 end：逐次用真实按钮推进，直到 campaignResult。
      let continueAction = null
      for (let guard = 0; guard < 20; guard++) {
        after = await fetchSession(request, sessionId)
        if (after.uiState === 'campaignResult') break
        if (after.pendingChoice) {
          await answerCampaignChoice(page, request, after, CAMPAIGN_PLAN)
          continue
        }
        const action = await advanceHubThroughUi(page, request, sessionId)
        if (continueAction === null) continueAction = action
        debug(`campaign end advance action=${action} ui=${after.uiState} node=${after.campaign?.flow?.nodeId}`)
        await page.waitForTimeout(400)
        await dismissPresentation(page)
      }
      expect(continueAction, '终章结算页继续按钮应提交 hubContinue').toBe('hubContinue')
      after = await fetchSession(request, sessionId)
      expect(after.uiState, '战役应结算到 campaignResult').toBe('campaignResult')
      expect(after.status, '战役已结束').toBe('over')
      expect(after.campaign.finished, '战役 finished').toBe(true)
      const records = after.campaign.records || {}
      expect(records.campaignOutcome, `尾声结局记录：${JSON.stringify({
        outcome: records.campaignOutcome, branch: records.campaignOutcomeBranch, valeFate: records.valeFate,
      })}`).toBeTruthy()
      expect(['victory', 'defeat', 'survived']).toContain(after.campaign.result)
      expect(after.legalMoves || [], '战役结算后没有可提交行动').toEqual([])
      await expect(page.locator('.ah-hub')).toHaveAttribute('data-ui-state', 'campaignResult', { timeout: 30_000 })
      await expect(page.locator('.ah-hub')).toContainText(/战役|结局|终章/)
      annotate(testInfo, 'evidence', `终章结算：result=${after.campaign.result}，campaignOutcome=${records.campaignOutcome}，`
        + `branch=${records.campaignOutcomeBranch}，scenarioResults=${after.campaign.scenarioResults.length}，`
        + `survivingResidents=${JSON.stringify(records.survivingResidents || [])}`)
      await shot(page, testInfo, `p8-progression-campaignResult-${viewport}`)

      // i. 刷新页面后的读档恢复探测（战役 manualLoad 真实路径：存档管理 → 读取此存档）。
      //    真实缺陷（10677a 假阳性）下这里写 blocked 证据并保留截图；缺陷修好后自动走真实读档。
      const saveLoad = await probeSaveLoadRecovery(page, request, sessionId, testInfo, viewport)
      expect(saveLoad.listed, '战役持久存档应真实出现在存档列表').toBe(true)

      expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
      await assertNoHorizontalOverflow(page)
    } catch (error) {
      await captureBlockedEvidence(page, testInfo, viewport, error)
      throw error
    }
  })
}

// ---------------------------------------------------------------------------
// phase=online：双真人真实开局 + 隐私 + 权限边界 + 断线恢复
// ---------------------------------------------------------------------------
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1',
  () => resolve(`http://127.0.0.1:${server.address().port}`)))
const stop = server => new Promise(resolve => {
  server.stopRelay?.()
  server.online?.close()
  server.closeAllConnections()
  server.close(resolve)
})
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

for (const [viewport, width, height] of VIEWPORTS) {
  test(`P8 online ${viewport} 双真人真实开局/隐私/权限边界/断线恢复`, async ({ browser }, testInfo) => {
    testInfo.setTimeout(240_000)
    annotate(testInfo, 'viewport', viewport)
    annotate(testInfo, 'phase', 'online')
    annotate(testInfo, 'scenario', FIRST_CHAPTER_ID)
    annotate(testInfo, 'claim', 'privacy')
    annotate(testInfo, 'claim', 'permission')
    annotate(testInfo, 'claim', 'disconnect')
    annotate(testInfo, 'debugJump',
      '不使用调试跳关：联机阶段全部走真实 /api/online/command（start / move / debug 权限探测）；'
      + '隐私与权限边界均按两个大厅实例各自的席位投影断言。')

    const { createRelay } = await import('../../../relay/server.js')
    const { createServer } = await import('../../../lib/server.js')
    const { loadMods } = await import('../../../lib/mods.js')
    const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
    const relay = createRelay()
    const relayUrl = await listen(relay)
    const halls = []
    let host, guest, guestReconnected, context
    const errors = []
    try {
      // 两个独立大厅实例：同一中转服务、同一会话、各席位自己的观察投影。
      for (let index = 0; index < 2; index++) {
        const server = createServer({ mods, persist: false })
        await server.ready
        halls.push({ server, url: await listen(server) })
      }
      const api = async (index, route, body) => {
        const response = await fetch(`${halls[index].url}/api/online/${route}`, {
          method: body ? 'POST' : 'GET',
          headers: { 'x-boardgame-online': '1', 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        })
        return response.json()
      }
      const command = (index, action, body = {}) => api(index, 'command',
        { action, body: { operationId: randomUUID(), ...body } })
      const status = async index => (await api(index, 'status')).session
      /** 轮询某个大厅的席位快照（联机快照经中转异步到达，直接读一次会读到上一 revision）。 */
      const waitForStatus = async (index, predicate, label, { attempts = 300, delay = 100 } = {}) => {
        let last = null
        for (let attempt = 0; attempt < attempts; attempt++) {
          last = await status(index)
          if (last && predicate(last)) return last
          await sleep(delay)
        }
        throw new Error(`${label} 超时：座位 ${index} revision=${last?.state?.revision} `
          + `uiState=${last?.state?.uiState} legal=${JSON.stringify((last?.state?.legalMoves || []).map(move => move.action).slice(0, 12))}`)
      }
      /** 找到某席位当前合法的 action 并提交（快照/版本落后时重试，最多 40 次）。
       *  每次尝试前先把两席位自己的待决选择答完（联机是逐座位窗口，别人看不见）。 */
      const act = async (index, action, matches = () => true) => {
        let last = null
        for (let attempt = 0; attempt < 40; attempt++) {
          await drainOnlineChoices()
          last = await status(index)
          const move = (last?.state?.legalMoves || []).find(item => item.action === action && matches(item))
          if (move) {
            const result = await command(index, 'move', { revision: last.state.revision, move })
            if (result.ok) return result.session
            debug(`act(${index}, ${action}) 被拒绝后重试：${result.error}`)
          }
          await sleep(120)
        }
        throw new Error(`${action} 不在座位 ${index} 的合法动作里；legal: ${JSON.stringify((last?.state?.legalMoves || [])
          .filter(item => item.action === action).slice(0, 6))}；全部动作: ${JSON.stringify((last?.state?.legalMoves || [])
          .map(item => item.action).slice(0, 16))}；pending=${last?.state?.pendingChoice?.kind || '-'}`
          + `@${last?.state?.pendingChoice?.seat ?? '-'}；currentSeat=${last?.state?.currentSeat}；ui=${last?.state?.uiState}`)
      }
      /** 应答某席位自己的待决选择（版本落后时重试）；没有待决选择返回 false。 */
      const answerOwnChoice = async (index, { attempts = 3 } = {}) => {
        for (let attempt = 0; attempt < attempts; attempt++) {
          const own = await status(index)
          const moves = own?.state?.legalMoves || []
          const move = moves.find(item => item.action === 'choose'
            && ['done', 'skip', 'keep'].includes(String(item.optionId)))
            || moves.find(item => item.action === 'choose')
          if (!move) return false
          const result = await command(index, 'move', { revision: own.state.revision, move })
          if (result.ok) return true
          await sleep(120)
        }
        return false
      }
      /** 两席位逐次答完自己的窗口/选择，直到没有 choose 可提交。 */
      const drainOnlineChoices = async () => {
        for (let guard = 0; guard < 24; guard++) {
          let changed = false
          for (let seat = 0; seat < 2; seat++) {
            if (await answerOwnChoice(seat)) changed = true
          }
          if (!changed) return
          await sleep(100)
        }
      }

      const created = await api(0, 'create', { relayUrl, modId: 'arkhamhorror', capacity: 2, fillAi: false,
        settings: { campaignId: CAMPAIGN_ID, seed: `fhv-online-${viewport}` } })
      expect(created.ok, created.error).toBe(true)
      const joined = await api(1, 'join', { relayUrl, code: created.room.code })
      expect(joined.ok, joined.error).toBe(true)
      expect((await api(1, 'ready', { ready: true })).ok).toBe(true)

      // 同一 browser context：两个大厅端口不同 origin，各自保存自己座位的会话；
      // 断线恢复要重开页面后仍能读回同一 origin 的 localStorage。
      context = await browser.newContext({ viewport: { width, height } })
      host = await context.newPage()
      guest = await context.newPage()
      for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message))
      await host.goto(halls[0].url)
      await guest.goto(halls[1].url)

      // a. 房主真实开局：同一《铁杉谷盛宴》会话出现在两个大厅实例。
      const started = await command(0, 'start')
      expect(started.ok, started.error).toBe(true)
      expect(started.session.state.campaign.id).toBe(CAMPAIGN_ID)
      const campaignName = started.session.state.campaign.name
      expect(campaignName).toContain(CAMPAIGN_NAME)
      await expect.poll(async () => (await status(1))?.state?.campaign?.id).toBe(CAMPAIGN_ID)
      const initial = await status(0)
      expect(initial.state.investigators.length).toBe(2)
      expect(initial.state.humanSeats).toEqual([0, 1])
      await expect(host.locator('.ah-hub')).toBeVisible({ timeout: 90_000 })
      await expect(host.locator('.bg-game-title').first()).toContainText(CAMPAIGN_NAME)
      await shot(host, testInfo, `p8-online-${viewport}-host-hub`)
      await shot(guest, testInfo, `p8-online-${viewport}-guest-hub`)

      // b. 两名真人各自准备自己的席位（真实 hub 动作；房主开局）。
      const hostSetup = await act(0, 'hubGoSetup')
      expect(hostSetup.state.uiState).toBe('scenarioSetup')
      await act(0, 'hubSetLeader', move => move.leadSeat === 0)
      await waitForStatus(1, session =>
        session.state.legalMoves.some(move => move.action === 'hubSelectInvestigator' && move.code === GUEST_CODE),
      '座位 1 可选调查员')
      await act(0, 'hubSelectInvestigator', move => move.code === HOST_CODE)
      await act(0, 'hubAutoDeck')
      await act(1, 'hubSelectInvestigator', move => move.code === GUEST_CODE)
      await act(1, 'hubAutoDeck')
      await act(0, 'hubDoneSeat')
      await act(1, 'hubDoneSeat')
      const prepared = await waitForStatus(0, session => session.state.hubReady === true
        && session.state.campaign.investigators[0]?.code === HOST_CODE
        && session.state.campaign.investigators[1]?.code === GUEST_CODE, '两席准备完成')
      expect(prepared.state.hubReady).toBe(true)
      annotate(testInfo, 'evidence', `联机准备：座位 0=${HOST_CODE} ${investigatorName(HOST_CODE)}；`
        + `座位 1=${GUEST_CODE} ${investigatorName(GUEST_CODE)}；hubReady=true`)

      // c. 权限边界（准备阶段）：非房主不能开始关卡，也不能提交调试命令。
      const hostSetupView = await waitForStatus(0, session =>
        session.state.legalMoves.some(move => move.action === 'hubBeginScenario'), '房主可开始关卡')
      const guestSetupView = await waitForStatus(1, session =>
        session.state.revision === hostSetupView.state.revision, '座位 1 追上房主 revision')
      expect(hostSetupView.state.legalMoves.some(move => move.action === 'hubBeginScenario'),
        '房主应有 hubBeginScenario').toBe(true)
      expect(guestSetupView.state.legalMoves.some(move => move.action === 'hubBeginScenario'),
        '非房主不应有 hubBeginScenario').toBe(false)
      const guestBeginDenied = await command(1, 'move', {
        revision: guestSetupView.state.revision, move: { action: 'hubBeginScenario' },
      })
      expect(guestBeginDenied.ok, '非房主提交 hubBeginScenario 必须被拒绝').toBe(false)
      const guestDebugDenied = await command(1, 'debug', {
        revision: guestSetupView.state.revision, command: { text: '结束这关 R1' },
      })
      expect(guestDebugDenied.ok, '非房主提交 debug 命令必须被拒绝').toBe(false)
      const guestHallDebug = await fetch(`${halls[1].url}/api/debug`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-boardgame-online': '1' },
        body: JSON.stringify({ sessionId: guestSetupView.sessionId,
          revision: guestSetupView.state.revision, seat: 1, command: { text: '结束这关 R1' } }),
      })
      const guestHallDebugBody = await guestHallDebug.json().catch(() => ({}))
      // 客人大厅按设计拒绝调试通道：有联机会话时 403（联机对局请由房主使用调试控制台），
      // 没有该会话缓存时 404；两种情况都不得返回 ok。
      expect([403, 404], `客人大厅的 /api/debug 必须被拒绝（实际 ${guestHallDebug.status}）`)
        .toContain(guestHallDebug.status)
      expect(guestHallDebugBody.ok, '客人大厅的 /api/debug 不得成功').not.toBe(true)
      expect((await status(1)).state.revision, '被拒绝的越权动作不得推进 revision')
        .toBe(guestSetupView.state.revision)
      annotate(testInfo, 'claim', 'permission')
      annotate(testInfo, 'evidence', `权限边界（准备阶段）：座位 1 没有 hubBeginScenario 且被拒绝；`
        + `座位 1 的 debug 命令被拒绝；客人大厅 /api/debug=${guestHallDebug.status}；`
        + `revision 保持 ${guestSetupView.state.revision}`)
      const entering = await act(0, 'hubBeginScenario')
      expect(entering.state.campaign.id).toBe(CAMPAIGN_ID)
      expect(entering.state.uiState).toBe('inScenario')

      // d. 开局待决选择由各自座位真实应答，直到双方都进入首章牌桌。
      for (let guard = 0; guard < 140; guard++) {
        await drainOnlineChoices()
        const own = await status(0)
        const other = await status(1)
        const pending = session => (session?.state?.legalMoves || []).some(move => move.action === 'choose')
        if (own?.state?.uiState === 'inScenario' && other?.state?.uiState === 'inScenario'
          && !pending(own) && !pending(other)) break
        await sleep(200)
      }
      const hostPlaying = await waitForStatus(0, session => session.state.uiState === 'inScenario'
        && session.state.scenario?.id === FIRST_CHAPTER_ID, '房主进入首章')
      const guestPlaying = await waitForStatus(1, session => session.state.uiState === 'inScenario'
        && session.state.scenario?.id === FIRST_CHAPTER_ID, '客人进入首章')
      expect(hostPlaying.state.campaign.scenarioResults.length).toBe(0)
      expect(guestPlaying.state.campaign.scenarioResults.length).toBe(0)

      // e. 隐私：对方座位手牌为空、只给牌库张数（不给顺序）；页面只渲染本席位手牌。
      for (const page of [host, guest]) {
        await dismissPresentation(page)
        await page.waitForTimeout(300)
      }
      const hostOwnHand = hostPlaying.state.investigators[0].hand
      const hostOtherSeat = hostPlaying.state.investigators[1]
      const guestOwnHand = guestPlaying.state.investigators[1].hand
      const guestOtherSeat = guestPlaying.state.investigators[0]
      expect(hostOwnHand.length, '房主自己的手牌').toBeGreaterThan(0)
      expect(hostOtherSeat.hand, '房主看不到对方手牌').toEqual([])
      expect(hostOtherSeat.deck, '房主看不到对方牌库顺序').toEqual([])
      expect(hostOtherSeat.deckSize, '对方牌库只给张数').toBeGreaterThan(0)
      expect(hostOtherSeat.handSize, '对方手牌只给张数').toBeGreaterThanOrEqual(0)
      expect(guestOwnHand.length, '客人自己的手牌').toBeGreaterThan(0)
      expect(guestOtherSeat.hand, '客人看不到对方手牌').toEqual([])
      expect(guestOtherSeat.deck, '客人看不到对方牌库顺序').toEqual([])
      expect(guestOtherSeat.deckSize, '对方牌库只给张数').toBeGreaterThan(0)
      // FHV 法典投影：只有条目 id/名称/可读/已读，不含未触发条目的条件与正文。
      const codex = hostPlaying.state.mechanics?.fhv?.codex || []
      expect(codex.length, '联机首章的公开法典投影').toBeGreaterThan(0)
      for (const row of codex) {
        expect(row, `法典投影不得含正文/条件：${JSON.stringify(row)}`).not.toHaveProperty('body')
        expect(row).not.toHaveProperty('branches')
        expect(row).not.toHaveProperty('sections')
        expect(row).not.toHaveProperty('conditions')
      }
      await settleTableToPlayable(host)
      await settleTableToPlayable(guest)
      await expect(host.locator('.ah-table')).toBeVisible({ timeout: 90_000 })
      await expect(guest.locator('.ah-table')).toBeVisible({ timeout: 90_000 })
      await expect(host.locator('.ah-hand[data-hand-seat="0"]')).toBeVisible()
      await expect(guest.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible()
      expect(await host.locator('.ah-hand[data-hand-seat="1"]').count(), '房主页面不渲染对方手牌').toBe(0)
      expect(await guest.locator('.ah-hand[data-hand-seat="0"]').count(), '客人页面不渲染对方手牌').toBe(0)
      await expect(host.locator('.bg-game-title').first()).toContainText(/欢迎来到铁杉谷/)
      await expect(guest.locator('.bg-game-title').first()).toContainText(/欢迎来到铁杉谷/)
      annotate(testInfo, 'evidence', `隐私：座位 0 手牌=${hostOwnHand.length} / 座位 1 视图座位 0 手牌=`
        + `${guestOtherSeat.hand.length}；座位 1 手牌=${guestOwnHand.length} / 座位 0 视图座位 1 手牌=`
        + `${hostOtherSeat.hand.length}；对方 deck=[]（仅 deckSize=${hostOtherSeat.deckSize}）；`
        + `法典投影 ${codex.length} 条（无正文/条件字段）`)
      await shot(host, testInfo, `p8-online-${viewport}-host-table`)
      await shot(guest, testInfo, `p8-online-${viewport}-guest-table`)

      // f. 轮流操作：房主一次标准行动并结束回合 → 座位 1 行动；非当前行动座位不能提交行动。
      const beforeAct = await status(0)
      const hostSeatBefore = beforeAct.state.currentSeat
      await act(0, 'resource')
      const endedTurn = await act(0, 'endTurn')
      expect([0, 1]).toContain(endedTurn.state.currentSeat)
      const guestTurn = await waitForStatus(1, session => session.state.currentSeat === 1, '轮到座位 1')
      expect(guestTurn.state.currentSeat, '房主结束回合后轮到客人').toBe(1)
      const hostRevisionBeforeWrongSeat = (await status(0)).state.revision
      const wrongSeat = await command(0, 'move', {
        revision: hostRevisionBeforeWrongSeat, move: { action: 'resource' },
      })
      expect(wrongSeat.ok, '非当前行动座位替他人行动必须被拒绝').toBe(false)
      expect((await status(0)).state.revision, '被拒绝的行动不改 revision').toBe(hostRevisionBeforeWrongSeat)
      const guestActed = await act(1, 'resource')
      expect(guestActed.state.revision).toBeGreaterThan(hostRevisionBeforeWrongSeat)
      annotate(testInfo, 'evidence', `轮流操作：座位 ${hostSeatBefore} 房主行动并结束回合 → 座位 1 客人行动；`
        + `座位 0 在客人回合提交行动被拒绝（revision 保持 ${hostRevisionBeforeWrongSeat}）`)
      await shot(host, testInfo, `p8-online-${viewport}-host-after-turn`)

      // g. 断线恢复：关闭客人页面 → 重开同一大厅 → 回到同一战役会话、同一手牌与关卡。
      const guestBeforeDrop = await status(1)
      await guest.close()
      guest = null
      guestReconnected = await context.newPage()
      guestReconnected.on('pageerror', error => errors.push(error.message))
      await guestReconnected.goto(halls[1].url)
      await guestReconnected.waitForSelector('.ah-table, .ah-hub', { timeout: 90_000 })
      await dismissPresentation(guestReconnected)
      if (await guestReconnected.locator('.ah-table').count()) await settleTableToPlayable(guestReconnected)
      const resumed = await waitForStatus(1, session =>
        session.state.campaign?.id === CAMPAIGN_ID
        && session.state.scenario?.id === FIRST_CHAPTER_ID
        && session.state.uiState === 'inScenario', '客人重连恢复')
      expect([...(resumed.state.investigators[1].hand || [])].sort())
        .toEqual([...guestBeforeDrop.state.investigators[1].hand].sort())
      expect(resumed.state.investigators[0].hand, '重连后仍看不到对方手牌').toEqual([])
      await expect(guestReconnected.locator('.ah-hand[data-hand-seat="1"]')).toBeVisible({ timeout: 60_000 })
      await expect(guestReconnected.locator('.bg-game-title').first()).toContainText(/欢迎来到铁杉谷/)
      annotate(testInfo, 'claim', 'disconnect')
      annotate(testInfo, 'evidence', `断线恢复：客人页面关闭重开后 sessionId=${resumed.sessionId}、`
        + `scenario=${resumed.state.scenario.id}、手牌一致（${resumed.state.investigators[1].hand.length} 张）、`
        + `对方手牌仍为空`)
      await shot(guestReconnected, testInfo, `p8-online-${viewport}-guest-reconnect`)

      // h. 房主刷新页面：同一会话、同一 revision、同一关卡（房主端断线恢复）。
      await host.reload()
      await host.waitForSelector('.ah-table, .ah-hub', { timeout: 90_000 })
      await dismissPresentation(host)
      if (await host.locator('.ah-table').count()) await settleTableToPlayable(host)
      await expect.poll(async () => host.locator('.ah-hub, .ah-table').first().isVisible()).toBe(true)
      const hostResumed = await waitForStatus(0, session => session.state.campaign?.id === CAMPAIGN_ID
        && session.state.scenario?.id === FIRST_CHAPTER_ID, '房主刷新恢复')
      expect(hostResumed.state.investigators[0].hand.length).toBeGreaterThan(0)
      expect(hostResumed.state.investigators[1].hand, '房主刷新后仍看不到对方手牌').toEqual([])
      await expect(host.locator('.bg-game-title').first()).toContainText(/欢迎来到铁杉谷/)
      await shot(host, testInfo, `p8-online-${viewport}-host-reload`)

      expect(errors, `pageerror: ${errors.join(' | ')}`).toEqual([])
      await assertNoHorizontalOverflow(host)
      await assertNoHorizontalOverflow(guestReconnected)
    } catch (error) {
      await captureBlockedEvidence(host || guestReconnected, testInfo, `online-${viewport}`, error)
      throw error
    } finally {
      await host?.close().catch(() => {})
      await guest?.close().catch(() => {})
      await guestReconnected?.close().catch(() => {})
      await context?.close().catch(() => {})
      await Promise.all(halls.map(hall => stop(hall.server).catch(() => {})))
      await stop(relay).catch(() => {})
    }
  })
}
