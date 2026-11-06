// 快速能力询问（收尾玩家窗口里的手牌快速卡）浏览器验收（2026-11-06）。
//
// 请求：快速卡询问触发时不再浮出牌桌中央的「视觉选项面板」，改成高亮手牌本身、点牌即打出。
// 这里用 /api/start 的 mock 直接种一个真实的 playerWindow 形状（选项 id 与
// src/engine/encounter.js#playerWindow 一致）：
//   · 单个候选：高亮手牌 + 底栏提示，点牌直接提交 choose（桌面用键盘 Enter、移动端点按）；
//   · 卢克的「如同位于连接地点」多份变体：点牌弹出贴着那张牌的动作浮层选具体打法；
//   · 两种视口都不出现 .ah-visual-choices 面板，也不横向溢出，截图存 artifacts/arkham-polish/。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../artifacts/arkham-polish/', import.meta.url))
mkdirSync(output, { recursive: true })

const FAST_LABEL = '⚡ 快速打出「捷径」（2 资源）'
const FAST_ASIF_LABEL = '⚡ 快速打出「捷径」（如同位于「河流峡谷」）（2 资源）'

function seedFastPrompt(st, { asIf = false } = {}) {
  const options = [
    { id: 'skip', label: '让过' },
    { id: 'fast-card:02022', label: FAST_LABEL },
    ...(asIf ? [{ id: 'fast-card:02022:asif:river', label: FAST_ASIF_LABEL, cardCode: '02022' }] : []),
  ]
  st.pendingChoice = {
    id: 'fast-prompt', kind: 'playerWindow', seat: 0, canSkip: true,
    prompt: '检定开始、投入前：可以使用免费触发能力，或让过。',
    options,
  }
  st.legalMoves = options.map(option => ({ action: 'choose', choiceId: 'fast-prompt', optionId: option.id, label: option.label }))
}

// 用真实 /api/start 打出 1 人局，再改写返回的观察投影：手牌一张「捷径」（02022）+
// 一个 playerWindow。卡面定义补进 view.cards，保证手牌小卡与卡片详情都能画出来。
async function fixture(page, { asIf = false, copies = 1 } = {}) {
  let session
  const submitted = []
  await page.route('**/api/start', async route => {
    const response = await route.fetch({
      postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'fast-card-prompt' } }),
    })
    const payload = await response.json()
    session = payload.session
    const st = session.state
    st.pendingChoice = null
    st.currentSeat = 0
    st.phase = 'investigation'
    Object.assign(st.cards, {
      '02022': { code: '02022', name: '捷径', nameZh: '捷径', nameEn: 'Shortcut', type: 'event', cost: 2, klass: 'seeker', hasReactionPrompt: true },
    })
    st.investigators[0].hand = Array.from({ length: copies }, () => '02022')
    st.investigators[0].resources = 5
    seedFastPrompt(st, { asIf })
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, busy: false, session } }))
  await page.route('**/api/move', async route => {
    submitted.push(route.request().postDataJSON())
    session.state.revision++
    session.state.pendingChoice = null
    session.state.legalMoves = []
    await route.fulfill({ json: { ok: true, session } })
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('arkham-presentation', JSON.stringify({ sound: false, fast: true })))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-player-board')).toBeVisible({ timeout: 30_000 })
  const skipScene = page.getByRole('button', { name: '跳过演出' })
  if (await skipScene.count()) await skipScene.first().click()
  await expect(page.locator('.ah-choice')).toBeVisible()
  return { submitted, errors, card: page.locator('.ah-hand-card[data-interaction="hand:0:0"]') }
}

async function expectHighlightedCard(page, card) {
  // 选项面板消失：候选挂回手牌后不再有视觉选项格子 / 卡片 / 详情胶囊。
  await expect(page.locator('.ah-visual-choices')).toHaveCount(0)
  await expect(page.locator('.ah-visual-cell')).toHaveCount(0)
  await expect(page.locator('.ah-offer-detail')).toHaveCount(0)
  // 手牌高亮成「可快速打出」：不可用态撤掉，带快速询问标记与选项 id。
  await expect(card).toBeVisible()
  await expect(card).toHaveClass(/ah-fast-prompt/)
  await expect(card).toHaveClass(/ah-direct-choice/)
  await expect(card).toHaveAttribute('data-card-available', 'true')
  await expect(card).toHaveAttribute('data-option-id', 'fast-card:02022')
  await expect(card).toHaveAttribute('data-fast-prompt', 'true')
  await expect(card).toHaveAttribute('aria-description', '快速打出：点按这张牌立即打出')
  expect(await card.getAttribute('title')).toContain(FAST_LABEL)
  // 高亮是真实样式（不是只加 class）：金色描边 + 光晕在 reduced-motion 下仍保留。
  const style = await card.evaluate(element => ({
    outline: getComputedStyle(element).outlineColor,
    shadow: getComputedStyle(element).boxShadow,
    cursor: getComputedStyle(element).cursor,
  }))
  expect(style.outline).not.toBe('rgba(0, 0, 0, 0)')
  expect(style.shadow).not.toBe('none')
  expect(style.cursor).toBe('pointer')
  // 底栏仍保留说明与让过 / 本局不再询问；提醒点牌即打出。
  const panel = page.locator('.ah-choice')
  await expect(panel).toContainText('检定开始、投入前：可以使用免费触发能力，或让过。')
  await expect(panel.locator('.ah-fast-prompt-hint')).toContainText('点按高亮的手牌即可快速打出')
  await expect(panel.getByRole('button', { name: '让过' })).toBeVisible()
  await expect(panel.getByRole('button', { name: '本局不再询问' })).toBeVisible()
  // 快速卡候选没有画回面板：控制按钮只剩「让过」一枚，没有额外的视觉选项按钮。
  await expect(panel.locator('.ah-choice-option')).toHaveCount(1)
}

async function screenshot(page, name) {
  const path = `${output}${name}.png`
  await page.screenshot({ path, animations: 'disabled' })
  test.info().annotations.push({ type: 'screenshot', description: path })
}

for (const [viewport, width, height, opener] of [
  ['desktop', 1440, 950, 'keyboard'],
  ['mobile', 390, 844, 'tap'],
]) {
  test(`快速能力询问：高亮手牌、点牌直接打出（${viewport} ${width}）`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const { submitted, errors, card } = await fixture(page)
    await expectHighlightedCard(page, card)
    await screenshot(page, `fast-card-prompt-${viewport}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

    if (opener === 'keyboard') {
      await card.focus()
      await page.keyboard.press('Enter')
    } else {
      await card.click()
    }
    await expect.poll(() => submitted.length).toBe(1)
    expect(submitted[0].move).toMatchObject({ action: 'choose', choiceId: 'fast-prompt', optionId: 'fast-card:02022' })
    // 点牌 = 提交合法动作，不会顺带打开卡牌详情。
    await expect(page.locator('.ah-carddetail-modal')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('快速能力询问：如同位于连接地点的多份变体在牌面浮层选择打法（desktop 1440）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  const { submitted, errors, card } = await fixture(page, { asIf: true })
  await expectHighlightedCard(page, card)
  // 两张候选都挂同一张牌：点牌不直接结算，而是弹出贴着手牌的动作浮层。
  const cardBox = await card.boundingBox()
  await card.click()
  const popover = page.locator('.ah-card-action-popover')
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('button', { name: new RegExp(FAST_LABEL) })).toBeVisible()
  await expect(popover.getByRole('button', { name: new RegExp(FAST_ASIF_LABEL) })).toBeVisible()
  const popoverBox = await popover.boundingBox()
  // 浮层贴着那张手牌（在牌上方），而不是牌桌中央的模态框。
  expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(cardBox.y + 2)
  expect(Math.abs((popoverBox.x + popoverBox.width / 2) - (cardBox.x + cardBox.width / 2))).toBeLessThan(cardBox.width)
  await screenshot(page, 'fast-card-prompt-asif-desktop')
  await popover.getByRole('button', { name: new RegExp(FAST_ASIF_LABEL) }).click()
  await expect.poll(() => submitted.length).toBe(1)
  expect(submitted[0].move).toMatchObject({ action: 'choose', choiceId: 'fast-prompt', optionId: 'fast-card:02022:asif:river' })
  expect(errors).toEqual([])
})

test('快速能力询问：同名副本共用一份候选，两张手牌都能点（desktop 1440）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  const { submitted, errors } = await fixture(page, { copies: 2 })
  // 引擎按卡号只给一份 fast-card 候选，但牌桌上的两张同名副本都要高亮、都能点。
  const first = page.locator('.ah-hand-card[data-interaction="hand:0:0"]')
  const second = page.locator('.ah-hand-card[data-interaction="hand:0:1"]')
  await expect(first).toHaveClass(/ah-fast-prompt/)
  await expect(second).toHaveClass(/ah-fast-prompt/)
  await expect(second).toHaveAttribute('data-option-id', 'fast-card:02022')
  await expect(second).toHaveAttribute('data-card-available', 'true')
  await expect(page.locator('.ah-visual-choices')).toHaveCount(0)
  await second.click()
  await expect.poll(() => submitted.length).toBe(1)
  expect(submitted[0].move).toMatchObject({ action: 'choose', optionId: 'fast-card:02022' })
  expect(errors).toEqual([])
})

test('快速能力询问：「本局不再询问」关闭唯一快速卡后窗口自动让过（desktop 1440）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 })
  const { submitted, errors, card } = await fixture(page)
  await expectHighlightedCard(page, card)
  await page.getByRole('button', { name: '本局不再询问' }).click()
  // 关闭后唯一候选被过滤，整窗按既有 auto-pass 口径自动提交让过；手牌不再高亮。
  await expect.poll(() => submitted.length).toBe(1)
  expect(submitted[0].move).toMatchObject({ action: 'choose', choiceId: 'fast-prompt', optionId: 'skip' })
  await expect(card).not.toHaveClass(/ah-fast-prompt/)
  expect(errors).toEqual([])
})
