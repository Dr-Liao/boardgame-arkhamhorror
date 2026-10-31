// 选项链接卡牌时的浏览器验收（2026-10-31 P0 打磨）：
//   · 待决选择里链接卡牌的选项画整张卡面，并在右上角给「详情」按钮（选项按钮与详情按钮是兄弟节点，
//     button 不能嵌 button）；
//   · 点选项 = 提交一条 legalMoves 里的 choose；点「详情」= 打开 .ah-carddetail-modal，不提交；
//   · 按住 Alt 悬停卡面出现 .ah-card-zoom[data-zoom-for]，松开收起；
//   · 桌面 1440 与移动 390 都不横向溢出，移动端「详情」仍可点。
//
// 夹具沿用 direct-cards.browser.mjs：改写 /api/start 返回的 session.state，再用 /api/session?*
// 与 /api/move 的 mock 保持刷新与提交。
//
// 主用例按实机口径（迷失时空 02325/02326）：内容层在 api.choose 的选项里直接下发 cardCode，
// 而观察投影的 view.cards 不保证含这些遭遇地点卡（embeddedExtra defs 不扫 encounterDiscard），
// 所以夹具**只给选项 cardCode、不往 st.cards 塞这两张卡**，验证牌面靠服务端 cardCode 下发；
// 另有一个兜底用例给「只有卡名、没有 cardCode」的旧内容，验证唯一卡名精确匹配。两种情况都不得改变提交动作。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../artifacts/arkham-polish/', import.meta.url))

const DESKTOP = { width: 1440, height: 950 }
const MOBILE = { width: 390, height: 844 }
const PROMPT = '选择一个被弃掉的地点，结算其显现能力。'
// 选项顺序即 legalMoves 顺序：无尽之桥（02326）、菱柱瀑布（02325）。
const OFFERS = [
  { id: '0', label: '无尽之桥', code: '02326' },
  { id: '1', label: '菱柱瀑布', code: '02325' },
]
const CARDS = {
  '02325': { code: '02325', name: '菱柱瀑布', nameZh: '菱柱瀑布', type: 'location' },
  '02326': { code: '02326', name: '无尽之桥', nameZh: '无尽之桥', type: 'location' },
}

// 实机口径：选项带 cardCode，视图 cards 里没有这两张遭遇地点卡。
// 兜底口径（旧内容）：选项只有卡名，视图 cards 有卡面，界面按唯一卡名精确匹配。
function seedLocationSearch(st, { withCardCode = true } = {}) {
  st.pendingChoice = {
    id: 'location-search', kind: 'location', seat: 0, prompt: PROMPT,
    options: OFFERS.map(({ id, label, code }) => ({ id, label, ...(withCardCode ? { cardCode: code } : {}) })),
  }
  st.legalMoves = OFFERS.map(({ id, label }) => ({ action: 'choose', choiceId: 'location-search', optionId: id, label }))
  if (!withCardCode) Object.assign(st.cards, CARDS)
}
function seedLocationSearchByName(st) { seedLocationSearch(st, { withCardCode: false }) }

async function fixture(page) {
  let session
  const submitted = []
  await page.route('**/api/start', async route => {
    const response = await route.fetch({
      postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'choice-card-offers' } }),
    })
    const payload = await response.json()
    session = payload.session
    const st = session.state
    st.pendingChoice = null
    st.currentSeat = 0
    st.phase = 'investigation'
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, busy: false, session } }))
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    submitted.push(body)
    session.state.revision++
    session.state.pendingChoice = null
    session.state.legalMoves = []
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-player-board')).toBeVisible()
  await page.getByRole('button', { name: '跳过演出' }).click()
  return {
    get session() { return session },
    submitted,
    async update(change) {
      change(session.state)
      session.state.revision++
      const skipScene = page.getByRole('button', { name: '跳过演出' })
      if (await skipScene.count()) await skipScene.first().click()
      await page.getByRole('button', { name: '刷新局势' }).click()
      await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(session.state.revision))
    },
  }
}

// 启动到「待决选择 = location-search」并确认两个选项都已渲染成视觉选项。
// seed 默认是实机口径（选项带 cardCode、视图无卡面），兜底用例传 seedLocationSearchByName。
async function openOffers(page, seed = seedLocationSearch) {
  await page.addInitScript(() => localStorage.setItem('arkham-presentation', JSON.stringify({ sound: false, fast: true })))
  const f = await fixture(page)
  await f.update(seed)
  const panel = page.getByRole('region', { name: '待决选择' })
  await expect(panel).toHaveAttribute('data-choice-id', 'location-search')
  await expect(panel).toContainText(PROMPT)
  const choices = panel.locator('.ah-visual-choices')
  await expect(choices).toBeVisible()
  await expect(choices.locator('.ah-visual-cell')).toHaveCount(OFFERS.length)
  return { f, panel, choices }
}

// DOM 契约：每个 .ah-visual-cell 直接包含一个 has-art 的选项按钮 + 兄弟 .ah-offer-details > 详情按钮；
// 卡面 data-art-code / aria-label 与详情 data-offer-detail / aria-label 都对应选项链接的卡。
async function expectOfferCards(choices) {
  await expect(choices.locator('.ah-visual-option.has-art')).toHaveCount(OFFERS.length)
  await expect(choices.locator('.ah-offer-detail')).toHaveCount(OFFERS.length)
  const cells = choices.locator('.ah-visual-cell')
  const structure = await cells.evaluateAll(nodes => nodes.map(cell => {
    const option = cell.querySelector(':scope > button.ah-choice-option.ah-visual-option.has-art')
    const details = cell.querySelector(':scope > .ah-offer-details')
    const buttons = details ? [...details.querySelectorAll(':scope > .ah-offer-detail')] : []
    const art = option?.querySelector('.ah-offer-cards .ah-table-art')
    return {
      optionId: option?.dataset.optionId || null,
      optionDisabled: !!option?.disabled,
      artCode: art?.dataset.artCode || null,
      artLabel: art?.getAttribute('aria-label') || '',
      detailCount: buttons.length,
      detailCode: buttons[0]?.dataset.offerDetail || null,
      detailLabel: buttons[0]?.getAttribute('aria-label') || '',
    }
  }))
  expect(structure.map(item => ({
    optionId: item.optionId, optionDisabled: item.optionDisabled, artCode: item.artCode, artLabel: item.artLabel,
    detailCount: item.detailCount, detailCode: item.detailCode,
  }))).toEqual(OFFERS.map(offer => ({
    optionId: offer.id, optionDisabled: false, artCode: offer.code, artLabel: offer.label,
    detailCount: 1, detailCode: offer.code,
  })))
  // 「详情」按钮的可访问名称必须带上卡名（移动端文字标签会被视觉隐藏，靠 aria-label 区分），
  // 并声明为打开对话框；卡面图必须真实加载出来，不能只是占位框。
  for (const [index, offer] of OFFERS.entries()) {
    expect(structure[index].detailLabel, `详情按钮 aria-label 应含卡名 ${offer.label}`).toContain(offer.label)
  }
  await expect(choices.locator('.ah-offer-detail').first()).toHaveAttribute('aria-haspopup', 'dialog')
  await expect.poll(() => choices.evaluate(element => [...element.querySelectorAll('.ah-offer-cards .ah-table-art')]
    .every(art => art.dataset.imageState === 'displayable' && art.querySelector('img')?.naturalWidth > 0))).toBe(true)
}

async function choicesLayout(choices) {
  return choices.evaluate(element => {
    const box = element.getBoundingClientRect()
    return { overflow: element.scrollWidth - element.clientWidth, left: box.left, right: box.right, viewport: innerWidth }
  })
}

test('选项链接卡牌时显示整卡与详情：Alt 放大卡面，点详情不提交、点选项提交 choose', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize(DESKTOP)
  const { f, choices } = await openOffers(page)
  // 实机口径复核：选项带 cardCode，但观察投影的 cards 里没有这两张遭遇地点卡——
  // 卡面必须由服务端 cardCode 撑起来；若以后删掉内容层 cardCode，本用例会变红。
  expect(f.session.state.pendingChoice.options.map(option => option.cardCode)).toEqual(OFFERS.map(offer => offer.code))
  expect(f.session.state.cards).not.toHaveProperty('02326')
  expect(f.session.state.cards).not.toHaveProperty('02325')
  await expectOfferCards(choices)
  const layout = await choicesLayout(choices)
  expect(layout.overflow).toBe(0)
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.right).toBeLessThanOrEqual(layout.viewport + 1)
  await page.evaluate(async () => Promise.all([...document.images].map(image => image.decode().catch(() => {}))))
  mkdirSync(output, { recursive: true })
  await page.screenshot({ path: output + 'choice-card-offers-desktop.png', animations: 'disabled' })

  // 按住 Alt 悬停卡面：放大图出现且标着对应卡号；松开 Alt 收起。
  const zoom = page.locator('.ah-card-zoom')
  await expect(zoom).toHaveCount(0)
  const firstArt = choices.locator('.ah-visual-cell').nth(0).locator('.ah-offer-cards .ah-table-art')
  await firstArt.hover()
  await page.keyboard.down('Alt')
  await expect(zoom).toBeVisible()
  await expect(zoom).toHaveAttribute('data-zoom-for', OFFERS[0].code)
  await expect(zoom.locator('.ah-card-zoom-art .ah-table-art')).toBeVisible()
  await expect(zoom.locator('h3')).toContainText(OFFERS[0].label)
  await page.keyboard.up('Alt')
  await expect(zoom).toHaveCount(0)
  expect(f.submitted).toHaveLength(0)

  // 点「详情」= 打开卡牌详情弹窗，不提交选择。
  await choices.locator('.ah-visual-cell').nth(1).locator('.ah-offer-detail').click()
  const modal = page.locator('.ah-carddetail-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(OFFERS[1].label)
  expect(f.submitted).toHaveLength(0)
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await expect(modal).toHaveCount(0)
  expect(f.submitted).toHaveLength(0)

  // 键盘可达：聚焦「详情」按 Enter 同样打开详情，且不提交选择。
  const detail = choices.locator('.ah-visual-cell').nth(1).locator('.ah-offer-detail')
  await detail.focus()
  await page.keyboard.press('Enter')
  await expect(modal).toBeVisible()
  expect(f.submitted).toHaveLength(0)
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await expect(modal).toHaveCount(0)

  // 关闭详情后点选项按钮：提交一条合法 choose，optionId 与所点卡面一致。
  const response = page.waitForResponse('**/api/move')
  await choices.locator('.ah-visual-cell').nth(1).locator('button.ah-visual-option[data-option-id="1"]').click()
  const payload = await (await response).json()
  expect(payload.ok).toBe(true)
  expect(f.submitted).toHaveLength(1)
  expect(f.submitted[0].move).toMatchObject({ action: 'choose', choiceId: 'location-search', optionId: '1' })
  await expect(page.getByRole('region', { name: '待决选择' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('移动端 390 下选项整卡与详情按钮不横向溢出且详情可点、不提交', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const { f, choices } = await openOffers(page)
  await expectOfferCards(choices)

  await page.setViewportSize(MOBILE)
  await expect(choices).toBeVisible()
  const layout = await choicesLayout(choices)
  expect(layout.overflow).toBe(0)
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.right).toBeLessThanOrEqual(layout.viewport + 1)
  const cells = choices.locator('.ah-visual-cell')
  await expect(cells.locator('.ah-visual-option.has-art')).toHaveCount(OFFERS.length)
  const detail = cells.nth(0).locator('.ah-offer-detail')
  await expect(detail).toBeVisible()
  await expect(detail).toBeInViewport()
  await page.evaluate(async () => Promise.all([...document.images].map(image => image.decode().catch(() => {}))))
  mkdirSync(output, { recursive: true })
  await page.screenshot({ path: output + 'choice-card-offers-mobile.png', animations: 'disabled' })

  // 移动端「详情」收成图标胶囊但仍可点：打开卡牌详情，不提交选择。
  await detail.click()
  const modal = page.locator('.ah-carddetail-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(OFFERS[0].label)
  expect(f.submitted).toHaveLength(0)
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await expect(modal).toHaveCount(0)
  expect(errors).toEqual([])
})

// 旧内容兼容：选项没下发 cardCode 时，界面按「唯一完整卡名」兜底挂卡面；仍不改变提交动作。
test('选项只有卡名没有 cardCode 时按唯一卡名兜底显示整卡与详情', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize(DESKTOP)
  const { f, choices } = await openOffers(page, seedLocationSearchByName)
  expect(f.session.state.pendingChoice.options.every(option => option.cardCode == null)).toBe(true)
  await expectOfferCards(choices)
  expect(f.submitted).toHaveLength(0)
  await choices.locator('.ah-visual-cell').nth(0).locator('.ah-offer-detail').click()
  const modal = page.locator('.ah-carddetail-modal')
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(OFFERS[0].label)
  expect(f.submitted).toHaveLength(0)
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  await expect(modal).toHaveCount(0)
  expect(errors).toEqual([])
})
