import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/hub-office', import.meta.url))
mkdirSync(output, { recursive: true })

async function settleArt(page) {
  await expect.poll(() => page.locator('.ah-office .ah-table-art[data-image-state="pending"]').evaluateAll(els => els.filter(el => {
    const r = el.getBoundingClientRect()
    if (r.top >= innerHeight || r.bottom <= 0) return false
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      if (/auto|hidden|scroll/.test(getComputedStyle(parent).overflowY)) {
        const p = parent.getBoundingClientRect(); if (r.top >= p.bottom || r.bottom <= p.top) return false
      }
    }
    return true
  }).length)).toBe(0)
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
}
async function capture(page, name) {
  await settleArt(page)
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: output + name + '.png', animations: 'disabled' })
}
async function open(page) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  return setup
}

test('调查员按职业颜色筛选、按扩展包分组并展示档案', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const setup = await open(page)
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await expect(hub.getByText('还没有选择调查员')).toBeVisible()
  await expect(hub.getByRole('button', { name: /选择调查员：罗兰/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(hub.locator('.ah-investigator-pack')).toHaveCount(4)
  await expect(hub.getByRole('heading', { name: '核心包', exact: true })).toBeVisible()
  await expect(hub.getByRole('heading', { name: '敦威治遗产', exact: true })).toBeVisible()
  await expect(hub.getByRole('heading', { name: '卡尔克萨之路', exact: true })).toBeVisible()
  await expect(hub.getByRole('heading', { name: '失落的时代', exact: true })).toBeVisible()
  await expect(hub.getByText('The Path to Carcosa', { exact: true })).toHaveCount(0)
  await expect(hub.getByText('The Forgotten Age', { exact: true })).toHaveCount(0)
  const packFilter = hub.getByLabel('筛选扩展包', { exact: true })
  await expect(packFilter.locator('option')).toHaveText(['所有扩展包', '核心包（5）', '敦威治遗产（5）', '卡尔克萨之路（6）', '失落的时代（5）'])
  await expect(hub.locator('.ah-office-candidate')).toHaveCount(21)
  await packFilter.focus()
  await packFilter.selectOption('tfa')
  await expect(packFilter).toBeFocused()
  await expect(hub.locator('.ah-investigator-pack')).toHaveCount(1)
  await expect(hub.getByRole('heading', { name: '失落的时代', exact: true })).toBeVisible()
  await expect(hub.locator('.ah-office-candidate')).toHaveCount(5)
  await packFilter.selectOption('all')
  await expect(hub.locator('.ah-investigator-pack')).toHaveCount(4)
  await expect(hub.locator('.ah-office-candidate')).toHaveCount(21)
  await hub.getByRole('button', { name: '探求者', exact: true }).click()
  await expect(hub.locator('.ah-office-candidate')).toHaveCount(4)
  await expect(packFilter.locator('option')).toHaveText(['所有扩展包', '核心包（1）', '敦威治遗产（1）', '卡尔克萨之路（1）', '失落的时代（1）'])
  await hub.getByRole('button', { name: '全部', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await expect(hub.getByRole('button', { name: /选择调查员：罗兰/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(hub.getByRole('heading', { name: '调查员能力' })).toBeVisible()
  await expect(hub.getByText('生命', { exact: true })).toBeVisible()
  await expect(hub.getByText('理智', { exact: true })).toBeVisible()
  await expect(hub.getByText('查看构筑规则')).toBeVisible()
  await expect(hub.getByRole('button', { name: '查看完整人物档案' })).toBeVisible()
  await hub.getByText('查看构筑规则').click()
  const signatures = hub.locator('.ah-investigator-signature-link')
  await expect(signatures).toHaveCount(2)
  expect(await signatures.first().evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline')
  await signatures.first().click()
  await expect(page.getByRole('dialog', { name: '卡牌详情' })).toBeVisible()
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
})

test('普通动效下局外选择保留已加载图片、面板可见性与构筑滚动位置', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const setup = await open(page)
  await settleArt(page)
  await setup.locator('img.ah-office-decor').first().evaluate(el => { window.retainedDecor = el })
  const playerCount = setup.getByText(/玩家人数|席位数量/).locator('..').locator('select')
  await playerCount.focus()
  await playerCount.selectOption('2')
  await expect(playerCount).toBeFocused()
  expect(await page.evaluate(() => window.retainedDecor.isConnected)).toBe(true)
  await playerCount.selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await settleArt(page)
  await hub.evaluate(el => { window.retainedHubMedia = [...el.querySelectorAll('.ah-table-art, .ah-office-decor')] })
  let release
  await page.route('**/api/move', async route => {
    await new Promise(resolve => { release = resolve })
    await route.continue()
  }, { times: 1 })
  await hub.getByRole('button', { name: '困难', exact: true }).click()
  await expect.poll(() => typeof release).toBe('function')
  const stable = () => page.evaluate(async () => {
    for (let frame = 0; frame < 5; frame++) {
      await new Promise(requestAnimationFrame)
      const pane = document.querySelector('.ah-hub-pane')
      if (getComputedStyle(pane).opacity !== '1' || getComputedStyle(pane).animationName !== 'none') return false
      if (!window.retainedHubMedia.every(el => el.isConnected)) return false
    }
    return true
  })
  expect(await stable()).toBe(true)
  release()
  await expect(hub.getByRole('button', { name: '困难', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await stable()).toBe(true)
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await expect(hub.locator('.bg-game-status')).toHaveText('调查准备')
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await expect(hub.getByRole('button', { name: /选择调查员：罗兰/ })).toBeEnabled()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await hub.getByRole('button', { name: /手动构筑/ }).click()
  const modal = page.locator('.ah-db-modal')
  await settleArt(page)
  const card = modal.locator('.ah-db-card button:enabled').first()
  await card.locator('.ah-table-art').evaluate(el => { window.retainedCard = el })
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('1/30')
  await expect(card).toBeFocused()
  expect(await page.evaluate(() => window.retainedCard.isConnected && window.retainedCard.dataset.imageState === 'displayable')).toBe(true)
  const pool = modal.locator('.ah-hub-card-pool')
  await pool.evaluate(el => { el.scrollTop = 120; window.builderScroll = el.scrollTop })
  expect(await page.evaluate(() => window.builderScroll)).toBeGreaterThan(0)
  // Trigger a local filter without scrolling its control into view first.
  await modal.getByRole('button', { name: '全部', exact: true }).evaluate(el => el.click())
  expect(await pool.evaluate(el => el.scrollTop)).toBe(await page.evaluate(() => window.builderScroll))
  expect(await page.evaluate(() => window.retainedCard.isConnected)).toBe(true)
  await modal.getByRole('button', { name: '技能', exact: true }).evaluate(el => el.click())
  expect(await pool.evaluate(el => el.scrollTop)).toBe(0)
  await page.locator('.bg-backdrop').click({ position: { x: 2, y: 2 } })
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: '取消', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(modal.getByRole('button', { name: '导入 ArkhamDB' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(modal.getByRole('button', { name: '取消', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
  await expect(hub.getByRole('button', { name: /手动构筑/ })).toBeFocused()
})
for (const width of [1440, 390]) {
  test(`调查事务所：${width} 布局、图片、选人与构筑交互`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const setup = await open(page)
    await capture(page, `entry-${width}`)
    const setupArt = [
      setup.locator('img[src$="hub-desk.webp"]'),
      setup.locator('img[src$="campaigns/nightOfTheZealot/hub/office-hero.webp"]'),
    ]
    for (const img of setupArt) expect(await img.evaluate(img => img.complete && img.naturalWidth === 1536)).toBe(true)
    await setup.getByRole('button', { name: '开始新游戏' }).click()
    const hub = page.locator('.ah-hub')
    await settleArt(page)
    await expect(hub.locator('.ah-content-packs')).not.toHaveAttribute('open')
    await expect(hub.locator('.bg-game-status')).toHaveText('战役准备')
    await capture(page, `overview-${width}`)
    expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    for (const [label, file] of [['关卡选择', 'routes'], ['战役记录', 'records']]) {
      await hub.getByRole('button', { name: label, exact: true }).click()
      await capture(page, `${file}-${width}`)
      expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    }
    await hub.getByRole('button', { name: '战役总览', exact: true }).click()
    await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
    await expect(hub.locator('.ah-investigator-pack')).toHaveCount(4)
    await expect(hub.getByRole('heading', { name: '核心包', exact: true })).toBeVisible()
    await expect(hub.getByRole('heading', { name: '敦威治遗产', exact: true })).toBeVisible()
    await expect(hub.getByRole('heading', { name: '卡尔克萨之路', exact: true })).toBeVisible()
    await expect(hub.getByRole('heading', { name: '失落的时代', exact: true })).toBeVisible()
    await expect(hub.getByText('The Path to Carcosa', { exact: true })).toHaveCount(0)
    await expect(hub.getByText('The Forgotten Age', { exact: true })).toHaveCount(0)
    const packFilter = hub.getByLabel('筛选扩展包', { exact: true })
    await packFilter.focus()
    await packFilter.selectOption('tfa')
    await expect(packFilter).toBeFocused()
    await expect(hub.locator('.ah-investigator-pack')).toHaveCount(1)
    await expect(hub.locator('.ah-office-candidate')).toHaveCount(5)
    expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await capture(page, `investigators-tfa-${width}`)
    await packFilter.selectOption('all')
    await expect(hub.locator('.ah-investigator-pack')).toHaveCount(4)
    await hub.getByRole('button', { name: '探求者', exact: true }).click()
    await expect(hub.locator('.ah-office-candidate')).toHaveCount(4)
    await hub.getByRole('button', { name: '全部', exact: true }).click()
    await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
    await expect(hub.getByRole('heading', { name: '调查员能力' })).toBeVisible()
    await expect(hub.getByText('生命', { exact: true })).toBeVisible()
    await expect(hub.getByText('理智', { exact: true })).toBeVisible()
    await settleArt(page)
    await capture(page, `investigators-${width}`)
    expect(await hub.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
    await hub.getByRole('button', { name: /手动构筑/ }).click()
    const modal = page.locator('.ah-db-modal')
    await settleArt(page)
    const first = modal.locator('.ah-db-card button').first()
    await expect(first.locator('img').first()).toBeVisible()
    if (width === 1440) {
      await first.dragTo(modal.getByRole('complementary', { name: '当前牌组' }))
      await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('1/30')
      await first.click()
      await expect(first).toBeDisabled()
      await modal.getByRole('button', { name: /移除/ }).first().click()
      await expect(first).toBeEnabled()
      await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('1/30')
    } else {
      await first.click()
      await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('1/30')
    }
    await modal.getByRole('button', { name: '技能', exact: true }).click()
    await expect(modal.locator('.ah-db-card')).not.toHaveCount(0)
    await modal.getByRole('textbox', { name: '搜索卡牌' }).fill('没有这张卡')
    await expect(modal.getByText('没有符合条件的卡牌')).toBeVisible()
    await modal.getByRole('textbox', { name: '搜索卡牌' }).fill('')
    await modal.getByRole('button', { name: '全部', exact: true }).click()
    await capture(page, `builder-${width}`)
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(modal.getByRole('button', { name: '保存牌组' })).toBeDisabled()
    for (let i = 0; i < 29; i++) await modal.locator('.ah-db-card > button:enabled').first().click()
    await expect(modal.getByRole('button', { name: '保存牌组' })).toBeEnabled()
    await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('30/30')
    await modal.getByRole('button', { name: '保存牌组' }).click()
    await expect(modal).toHaveCount(0)
    await expect(hub.locator('.ah-deck-next-action')).toContainText('牌组已保存')
    await expect(hub.locator('.ah-deck-next-action').getByRole('button', { name: '确认准备' })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('开局页脚的规则书入口不再压住「开始新游戏」，按钮保持在弹窗内', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await expect(setup).toBeVisible()
  // 浮动入口在开局界面隐藏，改由页脚按钮打开规则书，避免盖住页脚按钮。
  await expect(page.locator('.ah-rulebook-launcher')).toBeHidden()
  const footer = setup.locator('.bg-modal-foot')
  const modalBox = await setup.boundingBox(), footerBox = await footer.boundingBox()
  const startBox = await footer.getByRole('button', { name: '开始新游戏' }).boundingBox()
  // 页脚铺满右侧面板，操作按钮靠右且留出与弹窗边界一致的内边距。
  expect(footerBox.x + footerBox.width).toBeLessThanOrEqual(modalBox.x + modalBox.width)
  expect(startBox.x + startBox.width).toBeLessThanOrEqual(footerBox.x + footerBox.width - 24)
  expect(startBox.x + startBox.width).toBeLessThan(modalBox.x + modalBox.width)
  await footer.getByRole('button', { name: '规则书', exact: true }).click()
  const book = page.getByRole('dialog', { name: '游戏规则书' })
  await expect(book).toBeVisible()
  await book.getByRole('button', { name: '关闭规则书' }).click()
  await expect(book).toHaveCount(0)
  await expect(footer.getByRole('button', { name: '开始新游戏' })).toBeVisible()
})

test('素材提供真实透明通道，减少动态效果设置生效', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const setup = await open(page)
  for (const asset of ['desk', 'manor', 'casefile']) {
    const result = await page.evaluate(async asset => {
      const img = new Image()
      img.src = `/mods/arkhamhorror/img/ui/hub-${asset}.webp`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.width; canvas.height = img.height
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0)
      return { alpha: context.getImageData(0, 0, 1, 1).data[3], width: img.width }
    }, asset)
    expect(result).toEqual({ alpha: 0, width: 1536 })
  }
  const campaignHero = await page.evaluate(async () => {
    const img = new Image(); img.src = '/mods/arkhamhorror/img/campaigns/nightOfTheZealot/hub/office-hero.webp'; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const context = canvas.getContext('2d'); context.drawImage(img, 0, 0)
    return { alpha: context.getImageData(0, 0, 1, 1).data[3], width: img.width }
  })
  expect(campaignHero).toEqual({ alpha: 0, width: 1536 })
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  expect(await page.locator('.ah-hub-pane').evaluate(el => getComputedStyle(el).animationName)).toBe('none')
})

test('开局封面主图上下虚化：照片边缘渐隐并叠渐进模糊带，桌面图仍是清晰前景', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const setup = await open(page)
  const art = setup.locator('.ah-office-entry-art')
  await expect(art.locator('.ah-office-entry-hero')).toHaveCount(1)
  await expect(art.locator('.ah-office-entry-hero > .ah-office-decor')).toHaveCount(1)
  // 桌面图仍直接挂在封面层上，z-index 高于主图，模糊带不会糊到它。
  await expect(art.locator(':scope > .ah-office-decor')).toHaveCount(1)
  const report = await art.evaluate(el => {
    const hero = el.querySelector('.ah-office-entry-hero')
    const photo = hero.querySelector('.ah-office-decor')
    const desk = el.querySelector(':scope > .ah-office-decor')
    const style = (node, pseudo = null) => getComputedStyle(node, pseudo)
    return {
      photoMask: style(photo).maskImage,
      heroZ: style(hero).zIndex,
      deskZ: style(desk).zIndex,
      bands: [...hero.querySelectorAll('.ah-office-entry-blur')].map(band => ({
        isTop: band.classList.contains('is-top'),
        isBottom: band.classList.contains('is-bottom'),
        blur: style(band).backdropFilter,
        mask: style(band).maskImage,
      })),
      artAfter: { content: style(el, '::after').content, blur: style(el, '::after').backdropFilter },
    }
  })
  // 横向渐隐留在父层，纵向渐隐（上下各约 16%）落在照片自己身上。
  expect(report.photoMask).toContain('linear-gradient')
  expect(report.photoMask).toContain('16%')
  expect(report.photoMask).toContain('84%')
  expect(report.heroZ).toBe('0')
  expect(report.deskZ).toBe('1')
  expect(report.bands).toHaveLength(2)
  expect(report.bands.filter(band => band.isTop)).toHaveLength(1)
  expect(report.bands.filter(band => band.isBottom)).toHaveLength(1)
  for (const band of report.bands) {
    expect(band.blur).toContain('blur(')
    expect(band.mask).toContain('linear-gradient')
  }
  // 整块封面的最底边还有一道轻虚化，避免桌面图在面板边框处硬切。
  expect(report.artAfter.content).toBe('""')
  expect(report.artAfter.blur).toContain('blur(')
})
