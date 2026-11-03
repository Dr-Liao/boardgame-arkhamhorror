import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TIC_RULE_IDS } from '../web/tic-rules.js'
const output = fileURLToPath(new URL('../../../artifacts/migration/tic/reports/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })
async function start(page) {
  page.on('pageerror', error => console.error('browser page error: ' + error.message))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-hub')).toBeVisible({ timeout: 30_000 })
}
for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  for (const language of ['zh-CN', 'en']) test(`P3 ${viewport} ${language} 规则目录、阅读与返回`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await start(page)
    await page.evaluate(async language => {
      const { setLocale } = await import('/mods/arkhamhorror/i18n.js'); setLocale(language)
      window.dispatchEvent(new CustomEvent('arkham-open-rule', { detail: 'ticBless' }))
    }, language)
    const book = page.locator('.ah-rulebook'), nav = book.locator('nav'), article = book.locator('[data-rule-topic]')
    await expect(book).toBeVisible(); await expect(nav.locator('[data-rule-id^="tic"]')).toHaveCount(TIC_RULE_IDS.length)
    const search = book.locator('input[type=search]')
    await search.fill(language === 'en' ? 'flood' : '淹没')
    await nav.locator('[data-rule-id="ticFlood"]').click()
    await expect(article).toContainText(language === 'en' ? '5 direct damage' : '5 点直接伤害')
    await book.locator('.ah-rulebook-related button').filter({ hasText: language === 'en' ? 'Claiming' : '钥匙的取得' }).click()
    await expect(article).toHaveAttribute('data-rule-topic', 'ticKeys')
    await book.locator('.ah-rulebook-back').click(); await expect(article).toHaveAttribute('data-rule-topic', 'ticFlood')
    expect(await book.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    const path = `${output}${viewport}-${language}.png`; await page.screenshot({ path, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: path })
    await page.keyboard.press('Escape'); await expect(book).toHaveCount(0)
  })
  test(`P3 ${viewport} 卡文直达并恢复详情焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await start(page)
    await page.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill('07019')
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    await detail.locator('.ah-card-rule-links [data-rule-id="ticSeal"]').click()
    const book = page.locator('.ah-rulebook')
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'ticSeal')
    await expect(book).toContainText('封印与释放')
    await page.keyboard.press('Escape'); await expect(detail).toBeVisible()
    expect(await detail.evaluate(el => el.contains(document.activeElement))).toBe(true)
  })
}
