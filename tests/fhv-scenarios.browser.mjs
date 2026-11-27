// 九循环《铁杉谷盛宴》（The Feast of Hemlock Vale）P7 战役浏览器验收（桌面 1440×900 / 移动 390×844）。
//
// 口径（与 TSK/EotE P7 相同）：
//   · 真实大厅 / 真实 HTTP / 真实引擎：不做内容注册、不做状态注入、不 page.route 改写 /api/start；
//   · 每视口 12 章各 1 条用例（标题 `P7 <viewport> <scenarioId> …`），每条都从真实大厅重新开局：
//     调查准备设置（战役《铁杉谷盛宴》、1 个席位）→ 真实 /api/start → 局外页真实按钮
//     （配置调查员与卡组 hubGoSetup → 选择调查员：威尔森·理查德 → 自动构筑合法牌组 → 确认准备）
//     → 出发准备（真实 hubBeginScenario）→ 牌桌；
//   · 跨章推进只用既有调试结算原语 `{action:'debug',kind:'endScenario'}`（host-only POST /api/debug，
//     与 TSK 同款）：它结束的是**真实引擎里的当前关卡**，后续「继续 → 战役选择 → 出发准备 → 开始当前关卡」
//     全部走真实局外页按钮；不用跳关、不用章内夹具替代大厅路线；
//   · 每条用例断言：真实关卡名/当前章、关卡设置指南（特别规则/开场/设置/后续剧情/结局与结算，
//     中文不得以英文冒充）、一次真实局内行为（检定 / 地点移动 / 遭遇抽牌 / 幕或议程推进之一）、
//     截图（annotation type=screenshot，路径 …/screenshots/<viewport>-<scenarioId>.png）。
//
// 12 个 ScenarioStep 的桌面/移动两条路线（按 content/campaigns/theFeastOfHemlockVale/parts.js 的
// nextStep/route 语义；夜 1/夜 2 分支各固定走「寻找伯蒂 / 跟随马奎兹」，另有把 day2/night2/day3
// 勘察「跳过本次勘察」的稳定路线，用来把后段（最终日黎明/最终夜/终章）推上真实牌桌）：
//   · 直接勘察：欢迎序曲 → 当日勘察选择 → <目标勘察关>；
//   · 首夜固定：欢迎 → 岩间密语 → 首夜（跳过法典 / 不再吃 / 寻找伯蒂）→ 扭曲空洞 → 第二日黎明；
//   · 第二夜固定：… → 第二日黎明 → 深沼之物 → 第二夜（跟随马奎兹）→ 最长一夜；
//   · 后段稳定路线：… → 第二日黎明 → 跳过勘察 → 第二夜 → 夜探（夜间收集）→ 跳过夜探
//     → 最终日黎明 → 跳过勘察 → 最终夜 → 终章。
//
// 证据账本：audit/fhv-scenarios-browser.json（tools/playwright-fhv-p7-reporter.mjs）。
import { selectCampaign } from './playwright/campaign-picker.mjs'
import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { chapters as FHV_CHAPTERS } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
// 真实关卡显示名来自场景定义（shared.js#chapters.name 只是 P7 身份表短名：例如
// preludeTheFinalEvening 的显示名是「最终之夜」而短名是「最终夜」；出发准备/牌桌标题/指南标题
// 都读 state.scenario.name，所以 UI 断言必须用场景定义的名字）。
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

const output = fileURLToPath(new URL('../../../artifacts/migration/fhv/p7/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const CAMPAIGN_ID = 'theFeastOfHemlockVale'
const CAMPAIGN_NAME = '铁杉谷盛宴'
// 5 位正式调查员之一（P5）：10001/10004/10009/10012/10015。
const INVESTIGATOR_CODE = '10001'
const INVESTIGATOR_NAME = ALL_CARDS[INVESTIGATOR_CODE]?.nameZh || ALL_CARDS[INVESTIGATOR_CODE]?.name || INVESTIGATOR_CODE
const FIRST_CHAPTER_ID = FHV_CHAPTERS[0].id
const VIEWPORTS = Object.freeze([['desktop', 1440, 900], ['mobile', 390, 844]])
const CJK = /[\u4e00-\u9fff]/
const debug = message => { if (process.env.FHV_P7_DEBUG === '1') console.log('[FHV P7]', message) }
const CHAPTER_BY_ID = new Map(FHV_CHAPTERS.map(chapter => [chapter.id, chapter]))
const chapterOf = id => CHAPTER_BY_ID.get(id) || { id, name: id }
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
const chapterName = id => chapterOf(id).name
// 场景定义里的真实显示名（牌桌标题 / 出发准备 h2 / 关卡设置 h2 都是它）。
const scenarioDisplayName = id => SCENARIO_MODULES[id]?.scenario?.name || chapterName(id)
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 账本口径的 12 个 ScenarioStep（顺序 = CampaignSteps.hs = shared.js#chapters，reporter 用同一张表）。
const EXPECTED_CHAPTERS = Object.freeze([
  'welcomeToHemlockVale', 'writtenInRock', 'hemlockHouse', 'theSilentHeath', 'theLostSister',
  'theThingInTheDepths', 'theTwistedHollow', 'dawnOfTheSecondDay', 'theLongestNight',
  'dawnOfTheFinalDay', 'preludeTheFinalEvening', 'fateOfTheVale',
])
if (FHV_CHAPTERS.length !== EXPECTED_CHAPTERS.length
  || FHV_CHAPTERS.some((chapter, index) => chapter.id !== EXPECTED_CHAPTERS[index])) {
  throw new Error(`FHV 章节表与 P7 账本不一致：${FHV_CHAPTERS.map(chapter => chapter.id).join(',')}`)
}

// 各章指南的「特别规则」是否由正式指南数据提供（web/scenario-guides/<id>.json 的 zh 层）。
// 依据参考工程：theSilentHeath / fateOfTheVale 的冒险指南没有 specialRules 分组；面板只在有内容时
// 渲染「特别规则」分区，因此用真实数据决定是否断言该分区，不把「没有印刷特别规则」误判成缺陷。
const GUIDE_SPECIAL_RULES = new Map()
for (const chapter of FHV_CHAPTERS) {
  try {
    const guide = JSON.parse(readFileSync(fileURLToPath(new URL(`../web/scenario-guides/${chapter.id}.json`, import.meta.url)), 'utf8'))
    GUIDE_SPECIAL_RULES.set(chapter.id, (guide.locales?.zh?.specialRules || []).length)
  } catch {
    GUIDE_SPECIAL_RULES.set(chapter.id, 0)
  }
}

// ---------------------------------------------------------------------------
// 截图与基础断言
// ---------------------------------------------------------------------------
const screenshotPath = name => `${output}${name}.png`
const shot = (page, testInfo, name, { fullPage = false } = {}) => {
  const path = screenshotPath(name)
  testInfo.annotations.push({ type: 'screenshot', description: path })
  return page.screenshot({ path, animations: 'disabled', fullPage })
}

async function assertNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

// ---------------------------------------------------------------------------
// 演出 / 待决选择收敛（真实 UI 点击，TSK 同口径）
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
// 直到可操作。`timeout` 是收敛上限：服务端事务卡住时不把整条用例拖到 180s 超时。
async function settleTableToPlayable(page, { timeout = 45_000 } = {}) {
  const deadline = Date.now() + timeout
  await page.waitForTimeout(400)
  let stable = 0
  for (let guard = 0; guard < 300 && stable < 5 && Date.now() < deadline; guard++) {
    if (guard % 25 === 0) {
      debug(`settle guard=${guard} stable=${stable} presenting=${await isPresenting(page)} choice=${await page.locator('.ah-choice').count()} mechanic=${await page.locator('.ah-mechanic-choice').count()} cinematic=${await page.locator('.ah-cinematic').count()}`)
    }
    if (await isPresenting(page)) {
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) await skip.first().click({ timeout: 3000, force: true }).catch(() => {})
      stable = 0
      await page.waitForTimeout(180)
      continue
    }
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) { await skip.first().click({ timeout: 3000, force: true }).catch(() => {}); stable = 0; await page.waitForTimeout(120); continue }
    const next = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
    if (await next.count()) { await next.first().click({ timeout: 3000, force: true }).catch(() => {}); stable = 0; await page.waitForTimeout(120); continue }
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
      stable = 0; await page.waitForTimeout(160); continue
    }
    // 地点/敌人作为待决目标（FHV 初始工事、猎杀袋、法典目标等）：点地图上的 ah-choice-target。
    const choiceTarget = page.locator('.ah-choice-target[data-choice-target]').first()
    if (await choiceTarget.count()) {
      await choiceTarget.click({ timeout: 5000 }).catch(() => {})
      stable = 0; await page.waitForTimeout(180); continue
    }
    // 检定前/回合收尾的「免费能力窗口」：让过（skip）优先，否则会误点成场景能力或快速卡。
    if (process.env.FHV_P7_DEBUG === '1' && guard % 10 === 0 && await page.locator('.ah-choice').count()) {
      const info = await page.locator('.ah-choice').first().evaluate(element => ({
        kind: element.dataset.choiceKind,
        html: element.outerHTML.replace(/\s+/g, ' ').slice(0, 500),
        options: [...element.querySelectorAll('.ah-choice-option')].slice(0, 4).map(button => {
          const style = getComputedStyle(button)
          const box = button.getBoundingClientRect()
          return { optionId: button.dataset.optionId, text: (button.textContent || '').trim().slice(0, 16),
            display: style.display, visibility: style.visibility, disabled: button.disabled,
            box: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] }
        }),
      })).catch(() => null)
      console.log('[FHV P7] choice info:', JSON.stringify(info))
    }
    const skipWindow = page.locator('.ah-choice [data-option-id="skip"]:not([disabled])').first()
    if (await skipWindow.count()) { await skipWindow.click({ timeout: 5000 }).catch(() => {}); stable = 0; await page.waitForTimeout(140); continue }
    const done = page.locator('.ah-choice [data-option-id="done"]:not([disabled])')
    if (await done.count()) { await done.first().click({ timeout: 5000 }).catch(() => {}); stable = 0; await page.waitForTimeout(160); continue }
    const option = page.locator('.ah-choice .ah-choice-option:not([disabled])')
    if (await option.count()) { await option.first().click({ timeout: 5000 }).catch(() => {}); stable = 0; await page.waitForTimeout(160); continue }
    // 待决面板已出现但选项还没渲染（会话视图里的 legalMoves 是暂停前的旧快照）：点「刷新局势」
    // 让服务端按当前 pendingChoice 重算 legalMoves，选项会随真实 /api/session 响应出现。
    if (await page.locator('.ah-choice').count()) {
      const empty = (await page.locator('.ah-choice [data-option-id]').count()) === 0
      if (process.env.FHV_P7_DEBUG === '1' && guard % 10 === 0) {
        const info = await page.locator('.ah-choice').first().evaluate(element => ({
          kind: element.dataset.choiceKind,
          html: element.outerHTML.replace(/\s+/g, ' ').slice(0, 700),
          options: [...element.querySelectorAll('.ah-choice-option')].slice(0, 4).map(button => {
            const style = getComputedStyle(button)
            const box = button.getBoundingClientRect()
            return { optionId: button.dataset.optionId, text: (button.textContent || '').trim().slice(0, 16),
              display: style.display, visibility: style.visibility, disabled: button.disabled,
              box: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] }
          }),
        })).catch(() => null)
        console.log('[FHV P7] choice info:', JSON.stringify(info))
      }
      const refresh = page.getByRole('button', { name: '刷新局势' })
      if (empty && await refresh.count()) {
        await refresh.first().dispatchEvent('click').catch(() => {})
        stable = 0; await page.waitForTimeout(600); continue
      }
    }
    if (await page.locator('.ah-cinematic, .ah-choice, .ah-mechanic-choice').count()) { stable = 0; await page.waitForTimeout(220); continue }
    stable += 1
    await page.waitForTimeout(180)
  }
  debug(`settle done presenting=${await isPresenting(page)} choice=${await page.locator('.ah-choice').count()} mechanic=${await page.locator('.ah-mechanic-choice').count()}`)
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

// 真实 GET /api/session（与牌桌「刷新局势」同一接口）。
async function fetchSession(request, sessionId) {
  const response = await request.get('/api/session?sessionId=' + encodeURIComponent(sessionId))
  const payload = await response.json()
  return payload.session?.state || null
}

// 调试控制台通道（host-only POST /api/debug）。P7 只允许用它推进战役流程（结束本关），
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
// 牌桌可能处于「行动演出中」（.ah-table.ah-presenting）且结算层挡住指针：先跳过演出/收敛，
// 再用 dispatchEvent 走同一个 onclick（真实刷新按钮的处理函数，不是测试替身）。
async function syncAfterDebug(page) {
  await dismissPresentation(page)
  for (let guard = 0; guard < 30; guard++) {
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
    debug(`sync guard=${guard} presenting=${await isPresenting(page)} hub=${await page.locator('.ah-hub').count()} status=${JSON.stringify((await page.locator('.bg-game-status').first().innerText().catch(() => '')).slice(0, 30))}`)
  }
  throw new Error('调试结算后界面没有进入局外页（刷新按钮不可用或 /api/session 失败）')
}

// ---------------------------------------------------------------------------
// 战役路线（parts.js 的 nextStep/route 语义；跨章用 endScenario 真实推进）
// ---------------------------------------------------------------------------
const ANSWER = Object.freeze({
  skipCodex: Object.freeze({ text: '跳过' }),
  noMoreFood: Object.freeze({ text: '不要再吃' }),
  rescheduleSurvey: Object.freeze({ text: '跳过本次勘察' }),
  searchForBertie: Object.freeze({ text: '寻找伯蒂' }),
  followDrMarquez: Object.freeze({ text: '跟随马奎兹' }),
  gatherMoreInformation: Object.freeze({ text: '在夜间收集' }),
})
const surveyAnswer = scenarioId => Object.freeze({ text: chapterName(scenarioId) })
const route = (path, answers = {}) => Object.freeze({ path: Object.freeze(path), answers: Object.freeze(answers) })

// 序曲（欢迎）→ 当日勘察选择 → 目标勘察关。
const directSurveyRoute = scenarioId => route([FIRST_CHAPTER_ID, scenarioId], {
  surveyChoiceDay1: surveyAnswer(scenarioId),
})

// 欢迎 → 岩间密语 → 首夜（寻找伯蒂）→ 扭曲空洞 → 第二日黎明。
const NIGHT1_PATH = Object.freeze([FIRST_CHAPTER_ID, 'writtenInRock', 'theTwistedHollow', 'dawnOfTheSecondDay'])
const NIGHT1_ANSWERS = Object.freeze({
  surveyChoiceDay1: surveyAnswer('writtenInRock'),
  firstEveningCodex: ANSWER.skipCodex,
  firstEveningMeal: ANSWER.noMoreFood,
  firstEveningChoice: ANSWER.searchForBertie,
})

// 第二夜固定分支：加打深沼之物，再跟随马奎兹进入最长一夜。
const LONGEST_NIGHT_ROUTE = route(
  [...NIGHT1_PATH, 'theThingInTheDepths', 'theLongestNight'],
  {
    ...NIGHT1_ANSWERS,
    surveyChoiceDay2: surveyAnswer('theThingInTheDepths'),
    secondEveningCodex: ANSWER.skipCodex,
    secondEveningChoice: ANSWER.followDrMarquez,
  },
)

// 后段稳定路线：两次「跳过本次勘察」把时钟推到第三日/最终夜，真实进入最终日黎明、最终夜与终章。
const LATE_GAME_ROUTE = route(
  [...NIGHT1_PATH, 'dawnOfTheFinalDay', 'preludeTheFinalEvening', 'fateOfTheVale'],
  {
    ...NIGHT1_ANSWERS,
    surveyChoiceDay2: ANSWER.rescheduleSurvey,
    secondEveningCodex: ANSWER.skipCodex,
    secondEveningChoice: ANSWER.gatherMoreInformation,
    surveyChoiceNight2: ANSWER.rescheduleSurvey,
    surveyChoiceDay3: ANSWER.rescheduleSurvey,
  },
)

const truncateRoute = (plan, target) => {
  const index = plan.path.indexOf(target)
  if (index < 0) throw new Error(`${target} 不在路线 ${plan.path.join(' → ')}`)
  return route(plan.path.slice(0, index + 1), plan.answers)
}
const ROUTES = Object.freeze({
  welcomeToHemlockVale: route([FIRST_CHAPTER_ID]),
  writtenInRock: directSurveyRoute('writtenInRock'),
  hemlockHouse: directSurveyRoute('hemlockHouse'),
  theSilentHeath: directSurveyRoute('theSilentHeath'),
  theLostSister: directSurveyRoute('theLostSister'),
  theThingInTheDepths: directSurveyRoute('theThingInTheDepths'),
  theTwistedHollow: truncateRoute(route(NIGHT1_PATH, NIGHT1_ANSWERS), 'theTwistedHollow'),
  dawnOfTheSecondDay: route(NIGHT1_PATH, NIGHT1_ANSWERS),
  theLongestNight: truncateRoute(LONGEST_NIGHT_ROUTE, 'theLongestNight'),
  dawnOfTheFinalDay: truncateRoute(LATE_GAME_ROUTE, 'dawnOfTheFinalDay'),
  preludeTheFinalEvening: truncateRoute(LATE_GAME_ROUTE, 'preludeTheFinalEvening'),
  fateOfTheVale: LATE_GAME_ROUTE,
})
for (const chapter of FHV_CHAPTERS) {
  const plan = ROUTES[chapter.id]
  if (!plan) throw new Error(`缺少 ${chapter.id} 的 P7 路线`)
  if (plan.path[0] !== FIRST_CHAPTER_ID || plan.path.at(-1) !== chapter.id) {
    throw new Error(`${chapter.id} 路线未覆盖目标：${plan.path.join(' → ')}`)
  }
}
const targetPath = chapterId => ROUTES[chapterId].path

// ---------------------------------------------------------------------------
// 大厅 → 战役准备 → 出发准备 → 首章牌桌
// ---------------------------------------------------------------------------
async function startCampaignThroughLobby(page, request, testInfo, viewport) {
  await gotoHall(page)
  const dialog = await openSetup(page)
  await selectCampaign(page, dialog, CAMPAIGN_ID)
  await expect(dialog.locator('.ah-campaign-summary')).toContainText(CAMPAIGN_NAME)
  const seatSelect = dialog.getByRole('combobox', { name: '席位数量' })
  await expect(seatSelect, '大厅席位数量选择器').toBeVisible({ timeout: 30_000 })
  await seatSelect.selectOption('1')
  await shot(page, testInfo, `${viewport}-lobby`)

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
  return { session, hub }
}

// 局外页真实按钮完成席位准备：配置调查员与卡组 → 选 10001 → 自动构筑 → 确认准备。
async function prepareSeatThroughHub(page, request, session, testInfo, viewport) {
  const sessionId = session.sessionId
  const hub = page.locator('.ah-hub')
  let state = await fetchSession(request, sessionId)
  for (let guard = 0; guard < 8 && state.uiState !== 'scenarioSetup'; guard++) {
    if ((state.legalMoves || []).some(move => move.action === 'hubGoSetup')) {
      const { action } = await clickWorkflowPrimary(page)
      debug(`prepare primary action=${action}`)
      if (action === 'hubGoSetup') { state = await fetchSession(request, sessionId); continue }
    }
    if ((state.legalMoves || []).some(move => move.action === 'hubSelectScenario')) {
      const nav = hub.getByRole('navigation', { name: '战役局外页面' })
      await nav.getByRole('button', { name: '关卡选择', exact: true }).click().catch(() => {})
      const choose = hub.locator('.ah-office-case button:not([disabled])').first()
      if (await choose.count()) { await clickMoveButton(page, choose, '选择第一关'); state = await fetchSession(request, sessionId); continue }
    }
    await page.waitForTimeout(250)
    state = await fetchSession(request, sessionId)
  }
  expect(state.uiState, '真实局外页调查准备').toBe('scenarioSetup')

  const candidate = hub.getByRole('button', { name: new RegExp(`^选择调查员：${escapeRegExp(INVESTIGATOR_NAME)}`) }).first()
  await clickMoveButton(page, candidate, `选择调查员：${INVESTIGATOR_NAME}`)
  state = await fetchSession(request, sessionId)
  expect(state.investigators?.[0]?.code, '真实席位调查员').toBe(INVESTIGATOR_CODE)

  const recommended = '**/api/mods/arkhamhorror/arkhamdb/recommended?*'
  const offline = route => route.fulfill({ status: 503, json: { ok: false, error: '离线验收' } })
  await page.route(recommended, offline)
  try {
    const deck = hub.getByRole('button', { name: '使用推荐卡组', exact: true }).first()
    await clickMoveButton(page, deck, '使用推荐卡组')
  } finally {
    await page.unroute(recommended, offline)
  }
  state = await fetchSession(request, sessionId)
  if (state.legalMoves.some(move => move.action === 'hubConfirmDeck')) {
    const confirm = hub.getByRole('button', { name: '最终确认牌组', exact: true }).first()
    await clickMoveButton(page, confirm, '最终确认牌组')
  }
  const ready = hub.getByRole('button', { name: '确认准备', exact: true }).first()
  await clickMoveButton(page, ready, '确认准备')
  state = await fetchSession(request, sessionId)
  expect(state.hubReady, '全桌准备完成').toBe(true)
  await shot(page, testInfo, `${viewport}-ready`)
}

// 出发准备页：断言真实章节名 → 点「开始当前关卡」（真实 hubBeginScenario）→ 牌桌挂载。
async function beginScenarioThroughDeparture(page, request, sessionId, chapter, testInfo, viewport) {
  const hub = page.locator('.ah-hub')
  if (!(await page.locator('.ah-office-departure').count())) {
    const nav = hub.getByRole('navigation', { name: '战役局外页面' })
    await nav.getByRole('button', { name: '开始关卡', exact: true }).click().catch(() => {})
  }
  const departure = page.locator('.ah-office-departure')
  const displayName = scenarioDisplayName(chapter.id)
  const shortName = chapterName(chapter.id)
  // 「出发准备」标题优先用场景定义名（含英文副题），但共享章节表短名也接受：
  // preludeTheFinalEvening 的定义名是「最终之夜 · The Final Evening」、共享表短名是「最终夜」，
  // 两个 UI 读点都可能出现，断言两者任一即可（不弱化：仍必须命中真实章节名）。
  const acceptedNames = [...new Set([displayName, shortName].filter(Boolean))]
  await expect(departure, '出发准备页').toBeVisible({ timeout: 30_000 })
  await expect(departure.locator('h2'), `出发准备应显示「${displayName}」`)
    .toContainText(new RegExp(acceptedNames.map(escapeRegExp).join('|')))
  const start = departure.locator('.ah-departure-start')
  await expect(start, '开始当前关卡按钮').toBeEnabled({ timeout: 60_000 })
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/move')
    && response.request().postDataJSON()?.move?.action === 'hubBeginScenario', { timeout: 60_000 })
  await start.click({ timeout: 15_000 })
  const response = await responsePromise.catch(() => null)
  if (!response) {
    // 服务端在关卡 setup 里卡住/崩溃时 /api/move 不会返回：保留现场，按真实失败上报（不跳关）。
    const latest = await request.get('/api/session?sessionId=' + encodeURIComponent(sessionId), { timeout: 5000 })
      .then(item => item.json()).then(body => body.session?.state || null).catch(() => null)
    throw new Error(`开始「${displayName}」时服务端事务未返回（ui=${latest?.uiState || '?'}，`
      + `scenario=${latest?.scenario?.id || '?'}，pending=${latest?.pendingChoice?.kind || '-'}）`)
  }
  const body = await response.json()
  if (!body.ok) {
    // 真实引擎/观察投影失败：不改走调试跳关，保留证据后按真实失败上报。
    throw new Error(`开始「${displayName}」失败：${body.error}`)
  }
  await expect(page.locator('.ah-table'), '牌桌应挂载').toBeVisible({ timeout: 120_000 })
  await settleTableToPlayable(page)
  const state = await fetchSession(request, sessionId)
  expect(state.uiState, '进入关卡后的界面状态').toBe('inScenario')
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
    throw new Error(`路线缺少「${choice.source}」的选项（kind=${choice.kind}，prompt=${String(choice.prompt || '').slice(0, 80)}，可选：${optionTexts.join(' / ')}）`)
  }
  const target = buttons.filter({ hasText: wanted.text }).first()
  if (!(await target.count())) {
    const optionTexts = (await buttons.allTextContents()).map(text => text.trim())
    throw new Error(`「${choice.source}」没有包含「${wanted.text}」的选项（可选：${optionTexts.join(' / ')}）`)
  }
  return clickMoveButton(page, target, `战役选择：${wanted.text}`)
}

// 继续按钮：结算页在「调查纪事」页签的页脚（hubContinue）；幕间在升级页签内联
// 「保留 N XP 并继续 / 完成升级，准备下一关」（工作流主按钮在该页签被刻意隐藏）；
// 出发准备未就绪时在调查员页签内联「确认准备」。
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
  throw new Error(`局外页没有可推进的主按钮（ui=${state?.uiState}，node=${state?.campaign?.flow?.nodeId}，pending=${state?.pendingChoice?.kind || '-'}）`)
}

// 结束当前关卡（真实 debug 结算原语）→ 真实 UI 点完结算/幕间/战役选择/出发准备 → 下一章牌桌。
async function endAndAdvanceTo(page, request, sessionId, nextChapter, plan, testInfo, viewport) {
  await settleTableToPlayable(page)
  let state = await fetchSession(request, sessionId)
  expect(state.uiState, '结束关卡前应在牌桌内').toBe('inScenario')
  expect(state.scenario?.id, '结束关卡前应在预期章节').toBeTruthy()
  expect(state.pendingChoice, '结束关卡前不得有未答复的待决选择').toBeFalsy()
  debug(`end ${state.scenario.id} -> next ${nextChapter.id}`)
  await postDebug(request, sessionId, '结束这关 R1')
  await syncAfterDebug(page)
  for (let guard = 0; guard < 80; guard++) {
    state = await fetchSession(request, sessionId)
    if (state.uiState === 'inScenario') {
      await expect(page.locator('.ah-table'), '下一章牌桌应挂载').toBeVisible({ timeout: 120_000 })
      await settleTableToPlayable(page)
      state = await fetchSession(request, sessionId)
      expect(state.scenario?.id, `应进入「${scenarioDisplayName(nextChapter.id)}」`).toBe(nextChapter.id)
      await expect(page.locator('.bg-game-title').first(), '真实关卡名')
        .toHaveAttribute('title', new RegExp(escapeRegExp(scenarioDisplayName(nextChapter.id))))
      return state
    }
    if (state.pendingChoice) {
      await answerCampaignChoice(page, request, state, plan)
      continue
    }
    if (state.uiState === 'scenarioSetup' && state.hubReady) {
      await beginScenarioThroughDeparture(page, request, sessionId, nextChapter, testInfo, viewport)
      continue
    }
    const action = await advanceHubThroughUi(page, request, sessionId)
    debug(`hub advance action=${action} ui=${state.uiState} node=${state.campaign?.flow?.nodeId}`)
  }
  throw new Error(`无法推进到「${scenarioDisplayName(nextChapter.id)}」（ui=${state.uiState}，node=${state.campaign?.flow?.nodeId}）`)
}

// ---------------------------------------------------------------------------
// 章内真实行为：检定 / 地点移动 / 遭遇抽牌 / 幕或议程推进（至少一项）
// ---------------------------------------------------------------------------
async function exerciseChapter(page, request, testInfo, sessionId) {
  await settleTableToPlayable(page)
  const before = await fetchSession(request, sessionId)
  const roundBefore = before.round ?? 1
  const discardBefore = (before.encounterDiscard || []).length
  const seatBefore = before.currentSeat ?? 0
  const locationBefore = before.investigators?.[seatBefore]?.location ?? before.investigators?.[0]?.location
  const actBefore = before.actIndex ?? 0
  const agendaBefore = before.agendaIndex ?? 0
  let tested = false

  // 1) 真实调查检定：点「调查」动作 → 检定前免费能力窗口（让过）→ 投入窗口 → 开始检定 → 收敛。
  const investigate = page.locator('.ah-actions .ah-action').filter({ hasText: '调查' }).first()
  if (await investigate.count()) {
    debug('exercise: investigate')
    await investigate.dispatchEvent('click')
    let commitVisible = false
    for (let guard = 0; guard < 12; guard++) {
      const commit = page.locator('.ah-choice[data-choice-kind="commit"]')
      if (await commit.count()) { commitVisible = true; break }
      const skipWindow = page.locator('.ah-choice [data-option-id="skip"]:not([disabled])').first()
      if (await skipWindow.count()) {
        debug(`exercise: pass player window guard=${guard}`)
        const response = page.waitForResponse(item => item.url().endsWith('/api/move'), { timeout: 20_000 }).catch(() => null)
        await skipWindow.click({ timeout: 5000 }).catch(() => {})
        await response
        await page.waitForTimeout(200)
        continue
      }
      await page.waitForTimeout(300)
    }
    debug(`exercise: commitVisible=${commitVisible} choice=${await page.locator('.ah-choice').count()}`)
    if (commitVisible) {
      const commit = page.locator('.ah-choice[data-choice-kind="commit"]')
      const card = commit.locator('.ah-choice-option:not([data-option-id="done"]):not([disabled])').first()
      if (await card.count()) await card.click({ timeout: 5000 }).catch(() => {})
      const done = commit.locator('[data-option-id="done"]')
      await expect(done.first(), '完成投入').toBeVisible({ timeout: 10_000 })
      await done.first().dispatchEvent('click')
      tested = true
      await settleTableToPlayable(page)
    }
  }

  // 2) 没有检定窗口时：真实结束回合（敌军/神话阶段抽遭遇牌）。
  let state = await fetchSession(request, sessionId)
  debug(`exercise: after investigate pending=${state.pendingChoice?.kind || '-'} actions=${await page.locator('.ah-actions .ah-action').count()} choice=${await page.locator('.ah-choice').count()}`)
  let moved = (state.investigators?.[seatBefore]?.location ?? state.investigators?.[0]?.location) !== locationBefore
  let drewEncounter = (state.encounterDiscard || []).length > discardBefore || (state.round ?? 1) > roundBefore
  let advancedAct = (state.actIndex ?? 0) !== actBefore || (state.agendaIndex ?? 0) !== agendaBefore
  if (!tested && !moved && !drewEncounter && !advancedAct) {
    const endTurn = page.locator('.ah-actions .ah-action').filter({ hasText: '结束回合' }).first()
    debug(`exercise: endTurn count=${await endTurn.count()}`)
    if (await endTurn.count()) {
      await endTurn.dispatchEvent('click')
      await settleTableToPlayable(page)
      state = await fetchSession(request, sessionId)
      drewEncounter = (state.encounterDiscard || []).length > discardBefore || (state.round ?? 1) > roundBefore
      advancedAct = (state.actIndex ?? 0) !== actBefore || (state.agendaIndex ?? 0) !== agendaBefore
    }
  }
  // 3) 其它真实局内行为（地点移动）也接受：只要局面可证实地变化。
  if (!tested && !moved && !drewEncounter && !advancedAct) {
    const mapTargets = page.locator('.ah-map-node[data-move-target]')
    if (await mapTargets.count()) {
      const from = state.investigators?.[seatBefore]?.location
      await mapTargets.first().dispatchEvent('click')
      await page.waitForTimeout(250)
      const detailButton = page.getByRole('button', { name: '查看地点详情' }).first()
      if (await detailButton.count()) {
        await detailButton.dispatchEvent('click')
        const moveAction = page.locator('.ah-location-detail-actions .ah-action:not([disabled])').filter({ hasText: /移动|前往|出发/ }).first()
        if (await moveAction.count()) { await moveAction.dispatchEvent('click'); await settleTableToPlayable(page) }
      }
      state = await fetchSession(request, sessionId)
      moved = state.investigators?.[seatBefore]?.location !== from
    }
  }

  const evidence = {
    scenario: state.scenario?.id,
    test: tested,
    location: `${locationBefore} → ${state.investigators?.[seatBefore]?.location ?? state.investigators?.[0]?.location}`,
    round: `${roundBefore} → ${state.round ?? 1}`,
    encounterDiscard: `${discardBefore} → ${(state.encounterDiscard || []).length}`,
    act: `${actBefore} → ${state.actIndex ?? 0}`,
    agenda: `${agendaBefore} → ${state.agendaIndex ?? 0}`,
  }
  testInfo.annotations.push({ type: 'evidence', description: `局内真实行为：${JSON.stringify(evidence)}` })
  expect(tested || moved || drewEncounter || advancedAct,
    `局内没有发生真实检定/地点移动/遭遇抽牌/幕或议程推进：${JSON.stringify(evidence)}`).toBe(true)
}

// ---------------------------------------------------------------------------
// 「关卡设置」指南面板（特别规则/开场/设置/后续剧情/结局与结算；中文不得以英文冒充）
// ---------------------------------------------------------------------------
async function closeCardDetail(page) {
  if (await page.locator('.ah-carddetail-backdrop').count()) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }
}

async function assertChapterGuide(page, testInfo, viewport, chapter) {
  await closeCardDetail(page)
  const trigger = page.locator('[data-scenario-setup]').first()
  await expect(trigger, '剧本书右侧的关卡设置入口').toBeVisible({ timeout: 20_000 })
  await trigger.click({ timeout: 10_000 })
  const guide = page.getByRole('dialog', { name: '关卡设置' })
  await expect(guide, '关卡设置面板').toBeVisible({ timeout: 15_000 })
  await expect(guide.locator('h2'), '指南标题应为真实关卡名').toContainText(scenarioDisplayName(chapter.id))
  await expect.poll(async () => guide.locator('.ah-guide-block').count(), { timeout: 30_000 }).toBeGreaterThan(0)

  const titles = (await guide.locator('.ah-setup-section h3').allTextContents()).map(text => text.trim())
  debug(`guide ${chapter.id} sections=${titles.join(',')}`)
  expect(titles, `${chapter.id} 指南必须有「设置」分区`).toContain('设置')
  expect(titles, `${chapter.id} 指南必须有「开场」分区`).toContain('开场')
  const expectedSpecialRules = GUIDE_SPECIAL_RULES.get(chapter.id) || 0
  if (expectedSpecialRules > 0) {
    expect(titles, `${chapter.id} 指南必须有「特别规则」分区`).toContain('特别规则')
  } else {
    testInfo.annotations.push({ type: 'evidence', description: `${chapter.id}：正式指南数据没有 specialRules 分组（不渲染「特别规则」分区）` })
  }

  const details = guide.locator('details')
  expect(await details.count(), `${chapter.id} 折叠剧透分区`).toBeGreaterThanOrEqual(2)
  const summaries = (await details.locator('summary').allTextContents()).map(text => text.trim())
  expect(summaries.join(' | '), `${chapter.id} 后续剧情折叠区`).toContain('后续剧情')
  expect(summaries.join(' | '), `${chapter.id} 结局与结算折叠区`).toContain('结局与结算')
  // 剧透默认折叠：details 不处于 open；展开最后一个（结局与结算）验证正文。
  await expect(guide.locator('details[open]')).toHaveCount(0)
  await details.last().locator('summary').click({ timeout: 5000 })
  await expect(details.last()).toHaveAttribute('open', '')

  // 中文缺项不得以英文冒充：指南正文块必须含中文（缺译应显示「中文待补」，由指南生成器保证）。
  const blocks = (await guide.locator('.ah-guide-block').allTextContents()).map(text => text.trim()).filter(Boolean)
  expect(blocks.length, `${chapter.id} 指南正文块`).toBeGreaterThan(0)
  const englishOnly = blocks.filter(text => !CJK.test(text))
  expect(englishOnly, `${chapter.id} 指南块不得以英文冒充中文：${englishOnly[0] || ''}`).toEqual([])
  await assertNoHorizontalOverflow(page)
  await shot(page, testInfo, `${viewport}-${chapter.id}-guide`)
  await page.keyboard.press('Escape')
  await expect(guide).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => Boolean(document.activeElement?.matches?.('[data-scenario-setup]'))),
    { timeout: 10_000 }).toBe(true)
}

async function exerciseEmissaryView(page, request, testInfo, sessionId, viewport) {
  const emissary = page.locator('.ah-enemy[data-timed-enemy-view]').first()
  const details = page.locator('.ah-carddetail-modal')
  const acceptView = () => page.waitForResponse(response => response.url().endsWith('/api/card-view')
    && response.request().postDataJSON()?.viewing === true)
  const stopView = () => page.waitForResponse(response => response.url().endsWith('/api/card-view')
    && response.request().postDataJSON()?.viewing === false)
  if (viewport === 'desktop') {
    await emissary.hover()
    const zoom = acceptView()
    await page.keyboard.down('Alt')
    expect((await (await zoom).json()).durationMs).toBe(15_000)
    await expect(page.locator('.ah-card-zoom .ah-carddetail-view-warning')).toContainText('15 秒')
    const stoppedZoom = stopView()
    await page.keyboard.up('Alt')
    expect((await (await stoppedZoom).json()).ok).toBe(true)
  }
  const first = acceptView()
  await emissary.dispatchEvent('click')
  expect((await (await first).json()).durationMs).toBe(15_000)
  await expect(details.getByRole('status')).toContainText('15 秒')
  const stopped = stopView()
  await details.getByRole('button', { name: '关闭卡牌详情' }).click()
  expect((await (await stopped).json()).ok).toBe(true)
  expect((await fetchSession(request, sessionId)).investigators[0].defeated).toBe(false)

  const second = acceptView()
  await emissary.dispatchEvent('click')
  expect((await (await second).json()).durationMs).toBe(15_000)
  await shot(page, testInfo, `${viewport}-cosmic-emissary-gaze`)
  await expect.poll(async () => {
    const current = await fetchSession(request, sessionId)
    return current.investigators[0]?.defeated
  }, { timeout: 25_000, intervals: [1000] }).toBe(true)
  await expect.poll(async () => page.locator('.ah-carddetail-view-warning').count(), { timeout: 6000 }).toBe(0)
}

// ---------------------------------------------------------------------------
// 失败证据（内容/UI 真实缺陷时不跳过、不伪造，保留现场截图与界面错误文本）
// ---------------------------------------------------------------------------
async function captureBlockedEvidence(page, testInfo, viewport, chapter, error) {
  testInfo.annotations.push({ type: 'blocked', description: `${chapter.id}: ${String(error?.message || error).slice(0, 400)}` })
  try {
    const alert = await page.locator('[role="alert"]').first().innerText().catch(() => '')
    if (alert) testInfo.annotations.push({ type: 'evidence', description: `界面错误提示：${alert.trim().slice(0, 300)}` })
    const path = screenshotPath(`${viewport}-${chapter.id}-blocked`)
    await page.screenshot({ path, animations: 'disabled' })
    testInfo.annotations.push({ type: 'screenshot', description: path })
  } catch {
    // 页面已关闭/崩溃时不掩盖原始错误。
  }
}

// ---------------------------------------------------------------------------
// 用例：每视口 12 章各 1 条（真实大厅 → 真实引擎 → 真实关卡设置面板）
// ---------------------------------------------------------------------------
for (const [viewport, width, height] of VIEWPORTS) {
  for (const chapter of FHV_CHAPTERS) {
    test(`P7 ${viewport} ${chapter.id} 真实大厅进入${chapter.name}并验收关卡指南与局内真实行为`, async ({ page, request }, testInfo) => {
      // 后段章节（首夜之后）要真实点完更多结算/幕间/出发准备步骤，给足时间；其余仍按 180s。
      const longRoute = ['theTwistedHollow', 'dawnOfTheSecondDay', 'theLongestNight', 'dawnOfTheFinalDay',
        'preludeTheFinalEvening', 'fateOfTheVale'].includes(chapter.id)
      testInfo.setTimeout(Number(process.env.FHV_P7_TEST_TIMEOUT) || (longRoute ? 300_000 : 180_000))
      testInfo.annotations.push({ type: 'scenario', description: chapter.id })
      await page.setViewportSize({ width, height })
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      let sessionId = null
      try {
        const started = await startCampaignThroughLobby(page, request, testInfo, viewport)
        sessionId = started.session.sessionId
        await prepareSeatThroughHub(page, request, started.session, testInfo, viewport)
        let state = await beginScenarioThroughDeparture(page, request, sessionId, chapterOf(FIRST_CHAPTER_ID), testInfo, viewport)
        expect(state.scenario?.id, '首章应为《欢迎来到铁杉谷》').toBe(FIRST_CHAPTER_ID)
        await expect(page.locator('.bg-game-title').first())
          .toHaveAttribute('title', new RegExp(escapeRegExp(scenarioDisplayName(FIRST_CHAPTER_ID))))

        // 跨章：逐章 endScenario → 真实局外页点选 → 下一章；同时断言每一步都真的进入了路线上的下一章。
        const path = targetPath(chapter.id)
        const plan = ROUTES[chapter.id]
        for (const nextId of path.slice(1)) {
          const nextChapter = chapterOf(nextId)
          state = await endAndAdvanceTo(page, request, sessionId, nextChapter, plan, testInfo, viewport)
          expect(state.scenario?.id, `跨章后应进入「${scenarioDisplayName(nextId)}」`).toBe(nextId)
          debug(`entered ${nextId}`)
        }
        expect(state.scenario?.id, '最终应停留在目标章节').toBe(chapter.id)
        testInfo.annotations.push({ type: 'evidence', description: `真实路线：${path.join(' → ')}` })

        // 目标章断言：真实关卡名 + 局内真实行为 + 关卡设置指南 + 证据截图。
        await expect(page.locator('.bg-game-title').first(), '真实关卡名')
          .toHaveAttribute('title', new RegExp(escapeRegExp(scenarioDisplayName(chapter.id))))
        expect(state.campaign?.id, '真实战役').toBe(CAMPAIGN_ID)
        await exerciseChapter(page, request, testInfo, sessionId)
        await assertChapterGuide(page, testInfo, viewport, chapter)
        await shot(page, testInfo, `${viewport}-${chapter.id}`)
        await assertNoHorizontalOverflow(page)
        if (chapter.id === 'fateOfTheVale') await exerciseEmissaryView(page, request, testInfo, sessionId, viewport)
        expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
      } catch (error) {
        await captureBlockedEvidence(page, testInfo, viewport, chapter, error)
        throw error
      }
    })
  }
}

// ---------------------------------------------------------------------------
// P7 收口记录（2026-11-17；最终全量 24/24 通过，账本 audit/fhv-scenarios-browser.json status=passed）。
// 本轮真实大厅/HTTP/引擎路线上一度阻塞、随后由内容/共享 web 侧修复并经本 spec 复跑通过的缺陷：
//  · hemlockHouse：layout.js#layout 曾把函数 floorOfCell 放进 layout 对象，observation.js
//    `structuredClone(layout)` 抛 could not be cloned → 已改为只导出函数、不进 layout。
//  · theSilentHeath / theLostSister：setupLocations 曾把引擎 `shuffle(list, rng)` 当单参函数调用
//    （shuffleWith）→ 已按 rng 契约修复。
//  · theLongestNight / preludeTheFinalEvening：setupEnemies 的 `helper.info` 未绑定曾抛
//    `state.log.push of undefined` → 已改为 `helper.info(state, events, text)`。
//  · theLongestNight 的 5 个 `kind:'location'` 待决选择（初始工事屏障/诱饵/陷阱/屏障相邻/诱饵改放）：
//    界面曾把选项作为地图实体 offer 隐藏、而 game-ui.js#choiceTargetMove 只支持 `kind:'target'`，
//    玩家软锁 → 已支持实体目标 kind，本 spec 用地图 `ah-choice-target` 真实点击回答。
//  · preludeTheFinalEvening 结局 4 的剧情 info/桌面快照曾抛 RangeError: Maximum call stack size
//    exceeded，导致只能经它进入的 fateOfTheVale 阻塞 → 已修复。
//  · 四段序曲的关卡指南一度只有 specialRules/story（缺开场/设置/结局与结算）→ 指南数据已补齐；
//    theSilentHeath / fateOfTheVale 的正式指南源没有 specialRules 分组，本 spec 按真实数据跳过
//    该分区断言，其余 10 章严格断言「特别规则/开场/设置/后续剧情/结局与结算」。
// 本 spec 不含任何夹具/状态注入/内容注册旁路：跨章只用 `{action:'debug',kind:'endScenario'}`
// 结束真实关卡，之后全部走真实局外页按钮（继续 / 幕间准备 / 战役选择 / 出发准备 / 开始当前关卡）。
// ---------------------------------------------------------------------------
