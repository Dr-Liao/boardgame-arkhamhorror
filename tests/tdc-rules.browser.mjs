import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { TDC_RULE_IDS } from '../web/tdc-rules.js'

const output = new URL('../../../artifacts/migration/tdc/reports/screenshots/', import.meta.url)
const screen = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), animations: 'disabled' })

async function start(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-hub')).toBeVisible({ timeout: 30_000 })
}

for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  for (const locale of ['zh-CN', 'en']) {
    test(`P3 ${viewport} ${locale} rulebook`, async ({ page }) => {
      await start(page, width, height)
      await page.evaluate(async locale => {
        const { setLocale } = await import('/mods/arkhamhorror/i18n.js')
        setLocale(locale)
        window.dispatchEvent(new CustomEvent('arkham-open-rule', { detail: 'tdcCampaign' }))
      }, locale)
      const book = page.locator('.ah-rulebook')
      const nav = book.locator('nav')
      const article = book.locator('[data-rule-topic]')
      await expect(nav.locator('[data-rule-id^="tdc"]')).toHaveCount(TDC_RULE_IDS.length)
      await book.locator('input[type=search]').fill(locale === 'en' ? 'Relentless' : '无情')
      await nav.locator('[data-rule-id="tdcRelentless"]').click()
      await expect(article).toHaveAttribute('data-rule-topic', 'tdcRelentless')
      await expect(article).toContainText(locale === 'en' ? 'Canceled attacks count' : '被取消的攻击也计入')
      await book.locator('.ah-rulebook-related button').first().click()
      await expect(article).toHaveAttribute('data-rule-topic', 'tdcAlert')
      await book.locator('.ah-rulebook-back').click()
      await expect(article).toHaveAttribute('data-rule-topic', 'tdcRelentless')
      expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      await screen(page, `${viewport}-${locale}`)
      await page.keyboard.press('Escape')
      await expect(book).toHaveCount(0)
    })
  }

  test(`P3 ${viewport} card link and focus`, async ({ page }) => {
    await start(page, width, height)
    await page.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill('11573')
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const details = page.getByRole('dialog', { name: '卡牌详情' })
    const link = details.locator('.ah-card-rule-links [data-rule-id="tdcRelentless"]')
    await link.click()
    const book = page.locator('.ah-rulebook')
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'tdcRelentless')
    await screen(page, `${viewport}-card-link`)
    await page.keyboard.press('Escape')
    await expect(book).toHaveCount(0)
    await expect(details).toBeVisible()
    await expect(link).toBeFocused()
  })
}
