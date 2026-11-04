// TIC P7 八章浏览器逐章验收（desktop 1440×950 / mobile 390×844 × zh-CN / en）。
//
// 证据口径（与 Lead 确认）：TIC 战役尚未注册进生产 `content/registered.js`（manifest catalog-only、章节
// development），真实大厅无法选到 TIC 战役。因此本 spec 沿用《食梦者》/《万象无终》的浏览器验收做法
// （tests/tde-browser-shell.mjs、tests/tcu-scenarios.browser.mjs）：
//   · 在 spec（Node）进程用开发态注册的真实内容模块 + 真实引擎建出**八章真实章节 state**
//     （复用 tests/tic-chapter-fixture.mjs#chapterFixture，与 Node 逐章测试同一套 setup）；
//   · 用生产投影 `viewState` 生成与 `/api/session` 同形的会话状态，`page.route` 拦截 `/api/start`、
//     `/api/session` 注入给**真实 web/ 界面**（不 seed 文案、不改 content）；
//   · 跳过「大厅选战役」这一步，其余全部是生产实现：真实幕/议程/地点/指南、真实语言切换、真实重试、
//     真实焦点管理。报告与账本里明确记录该口径限制。
//
// 每章每视口每语言一条用例，断言：
//   1) 进入关卡：真实 TIC 章节 state 渲染出牌桌、标题命中章节名、revision=1、无 pageerror；
//   2) 关卡设置入口位置：按钮在剧本书右侧、混乱标记提示卡下方，且不溢出视口；
//   3) 指南加载：首次 503 → 「加载失败」+ 重试按钮 → 重新加载成功（2 次请求）；
//   4) 特别规则可见（正文来自 web/scenario-guides/<id>.json 的真实中/英正文）；
//   5) 后续剧情/结局默认折叠，全部可展开且内容来自指南正文；
//   6) 中英切换：切到另一语言后指南标题/正文同步切换，再切回；
//   7) 键盘关闭与焦点返回：Escape 关闭后入口按钮重新获得焦点；
//   8) 截图 annotation（scenario/viewport 供 tools/playwright-tic-reporter.mjs 归集逐章覆盖）。
import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'

const outputs = fileURLToPath(new URL('../../../artifacts/migration/tic/p7/workers/w4/screenshots/', import.meta.url))
mkdirSync(outputs, { recursive: true })

const LOCALE = { 'zh-CN': 'zh-CN', en: 'en' }
const GUIDE_TEXT = Object.fromEntries(chapters.map(chapter => [chapter.id,
  JSON.parse(readFileSync(new URL(`../web/scenario-guides/${chapter.id}.json`, import.meta.url), 'utf8'))]))

// 指南 JSON 的正文是递归块（title/children/text）；取一句足够长、无标记符的正文作为断言片段。
const flattenGuideText = blocks => (blocks || []).flatMap(block => [
  typeof block?.text === 'string' ? block.text : '',
  ...flattenGuideText(block?.children),
]).join(' ')
function guideSnippet(blocks, lang, fallback = '') {
  const text = flattenGuideText(blocks).replace(/\s+/g, ' ').trim() || fallback
  const pick = text.split(/(?<=[。！？.!?])\s*/).map(part => part.trim())
    .find(part => part.length >= (lang === 'en' ? 32 : 12) && !/[\[\]{}<>*]/.test(part))
  return (pick || text).slice(0, lang === 'en' ? 42 : 20)
}
function guideLocale(chapterId, lang) {
  const locale = GUIDE_TEXT[chapterId]?.locales?.[lang === 'en' ? 'en' : 'zh'] || {}
  return {
    specialRules: locale.specialRules || [],
    story: locale.story || [],
    resolutions: locale.resolutions || [],
  }
}

// 每章只建一次真实 state（spec 进程缓存；Playwright tic config workers=1）。
const STATES = new Map()
function chapterState(chapterId) {
  if (!STATES.has(chapterId)) STATES.set(chapterId, chapterFixture(chapterId, 1))
  return STATES.get(chapterId)
}
function projectChapterView(state) {
  state.revision = 1
  state.status = 'playing'
  state.hubFlow = false
  state.uiState = 'inScenario'
  state.pendingChoice = null
  state.legalMoves = legalMoves(state)
  const view = viewState(state, 0, { includeStatic: true })
  view.uiState = 'inScenario'
  view.pendingChoice = null
  view.revision = 1
  if (!view.log) view.log = []
  return view
}
const chapterFacts = (chapterId, chapter) => {
  const state = chapterState(chapterId)
  return {
    name: state.scenario?.name || chapter.name,
    nameEn: state.scenario?.nameEn || chapter.nameEn,
    scenarioId: state.scenario?.id || chapterId,
    location: (state.locations.find(location => location.id === state.investigators[0]?.location)
      || state.locations[0] || {}).name || '',
    locationsOnTable: state.locations.length,
  }
}

async function setLocale(page, lang) {
  await page.evaluate(async locale => {
    const catalog = await import('/mods/arkhamhorror/catalog.js')
    catalog.setHostLocale(locale)
  }, LOCALE[lang])
}

/** 把真实 TIC 章节 state 注入真实 app 的 /api/start + /api/session。 */
async function openInjectedTable(page, chapterId) {
  const view = projectChapterView(chapterState(chapterId))
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let session = null
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    const response = await route.fetch({
      postData: JSON.stringify({
        ...body,
        settings: {
          ...body.settings,
          seed: `tic-browser-acceptance-${chapterId}`,
          playerCount: 1,
          teammates: 0,
          opponents: [],
          legacyAutoStart: true,
        },
      }),
    })
    const payload = await response.json()
    if (payload.ok) {
      session = payload.session
      session.sessionId = `tic-browser-acceptance-${chapterId}`
      session.state = view
      session.events = []
      session.busy = false
    }
    await route.fulfill({ response, json: payload })
  }, { times: 1 })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session, busy: false } }))
  // 验收只读面板，不提交行动；/api/move 一律回放当前会话，避免任何 UI 跳过演出的请求打真服务器。
  await page.route('**/api/move', route => route.fulfill({ json: { ok: true, session, revision: 1, events: [] } }))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), locator => locator.click())
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  return { errors, view }
}

function setupDialog(page, lang) {
  return page.getByRole('dialog', { name: lang === 'en' ? 'Scenario setup' : '关卡设置', exact: true })
}
async function openGuideFromTable(page, lang) {
  const button = page.locator('[data-scenario-setup]')
  await expect(button).toHaveCount(1)
  if (lang === 'en') await expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  await button.focus()
  await page.keyboard.press('Enter')
  const panel = setupDialog(page, lang)
  await expect(panel).toBeVisible()
  return { button, panel }
}

for (const chapter of chapters) {
  const facts = chapterFacts(chapter.id, chapter)
  for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
    for (const lang of ['zh-CN', 'en']) {
      test(`P7 TIC ${chapter.name} ${viewport} ${lang} 实机关卡设置入口与完整指南验收`, async ({ page }, testInfo) => {
        testInfo.setTimeout(120_000)
        await page.setViewportSize({ width, height })
        const { errors } = await openInjectedTable(page, chapter.id)
        await setLocale(page, lang)
        const zh = lang === 'zh-CN'
        const guide = guideLocale(chapter.id, lang)
        const otherLang = zh ? 'en' : 'zh-CN'
        const otherGuide = guideLocale(chapter.id, otherLang)

        // 1) 进入关卡：真实 TIC state（标题命中章节名，牌桌可见、revision=1）。
        await expect(page.locator('.ah-table').first()).toHaveAttribute('data-revision', '1')
        const title = page.locator('.bg-game-title').first()
        await expect(title).toBeVisible()
        await expect(title).toContainText(zh ? facts.name : (facts.nameEn || facts.name))

        // 2) 关卡设置入口位置：剧本书右侧、混乱标记提示卡下方、不溢出视口。
        const [book, card, entry] = await Promise.all(['.ah-story-book', '.ah-reference-card', '[data-scenario-setup]']
          .map(selector => page.locator(selector).first().boundingBox()))
        expect(book, '剧本书可见').not.toBeNull()
        expect(card, '混乱标记提示卡可见').not.toBeNull()
        expect(entry, '关卡设置入口可见').not.toBeNull()
        expect(entry.x).toBeGreaterThanOrEqual(book.x + book.width)
        expect(entry.y).toBeGreaterThanOrEqual(card.y + card.height - 1)
        expect(entry.x + entry.width).toBeLessThanOrEqual(width)
        expect(entry.y + entry.height).toBeLessThanOrEqual(height)
        expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
        await page.evaluate(() => Promise.all([...document.images].map(image => image.decode().catch(() => {}))))
        const tableShot = `${outputs}tic-chapter-${chapter.id}-${viewport}-${lang}-table.png`
        await page.screenshot({ path: tableShot, animations: 'disabled' })
        testInfo.annotations.push({ type: 'screenshot', description: tableShot })

        // 3) 首次加载指南失败 → 重试成功（真实 HTTP 503 注入，重试后走真实指南 JSON）。
        let guideRequests = 0
        await page.route(`**/scenario-guides/${chapter.id}.json`, async route => {
          guideRequests += 1
          if (guideRequests === 1) return route.fulfill({ status: 503, body: 'Unavailable' })
          return route.continue()
        })
        await page.locator('[data-scenario-setup]').click()
        let panel = setupDialog(page, lang)
        await expect(panel).toBeVisible()
        await expect(panel.getByRole('status')).toContainText(zh ? '加载失败' : 'could not be loaded')
        await panel.getByRole('button', { name: zh ? '重新加载指南' : 'Reload guide' }).click()
        await expect(panel.getByRole('status')).toHaveCount(0)
        expect(guideRequests).toBe(2)
        await expect(panel.getByText(zh ? '特别规则' : 'Special rules', { exact: true })).toBeVisible()
        if (guide.specialRules.length) await expect(panel).toContainText(guideSnippet(guide.specialRules, lang))
        if (guide.story.length) await expect(panel).toContainText(guideSnippet(guide.story, lang))

        // 4) 后续剧情/结局默认折叠，全部可展开且正文来自指南。
        const spoilers = panel.locator('details')
        const spoilerKinds = [guide.story.length ? 'story' : null, guide.resolutions.length ? 'resolutions' : null].filter(Boolean)
        await expect(spoilers).toHaveCount(spoilerKinds.length)
        await expect(panel.locator('details[open]')).toHaveCount(0)
        for (const [index, kind] of spoilerKinds.entries()) {
          const detail = spoilers.nth(index)
          await detail.locator('summary').click()
          await expect(detail).toHaveAttribute('open', '')
          await expect(detail).toContainText(guideSnippet(guide[kind], lang))
        }
        const guideShot = `${outputs}tic-chapter-${chapter.id}-${viewport}-${lang}-guide.png`
        await page.screenshot({ path: guideShot, animations: 'disabled' })
        testInfo.annotations.push({ type: 'screenshot', description: guideShot })

        // 5) 键盘关闭与焦点返回：Escape 关闭后入口按钮重新获得焦点。
        await page.keyboard.press('Escape')
        await expect(panel).toHaveCount(0)
        await expect(page.locator('[data-scenario-setup]')).toBeFocused()

        // 6) 中英切换：切到另一语言后打开面板，标题与特别规则正文同步切换，再切回。
        await setLocale(page, otherLang)
        panel = setupDialog(page, otherLang)
        const otherEntry = page.locator('[data-scenario-setup]')
        await otherEntry.click()
        await expect(panel).toBeVisible()
        await expect(panel.getByText(otherLang === 'en' ? 'Special rules' : '特别规则', { exact: true })).toBeVisible()
        if (otherGuide.specialRules.length) await expect(panel).toContainText(guideSnippet(otherGuide.specialRules, otherLang))
        await page.keyboard.press('Escape')
        await expect(panel).toHaveCount(0)
        await setLocale(page, lang)
        expect(errors).toEqual([])
        testInfo.annotations.push({ type: 'scenario', description: chapter.id })
        testInfo.annotations.push({ type: 'viewport', description: viewport })
      })
    }
  }
}
