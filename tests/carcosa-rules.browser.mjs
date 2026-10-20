import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §2：阶段截图放在仓库根目录 artifacts/，不进入游戏运行目录。
const output = fileURLToPath(new URL('../../../artifacts/carcosa-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

async function start(page) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  return page.locator('.ah-hub')
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M4 卡尔克萨规则目录、搜索与返回在${label}端可用`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await start(page)
    await page.keyboard.press('F1')
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    const search = book.getByRole('searchbox', { name: '搜索规则' })
    const nav = book.getByRole('navigation', { name: '规则目录' })
    await search.fill('卡尔克萨')
    await expect(nav.locator('[data-rule-id="carcosaCampaign"]')).toBeVisible()
    await nav.locator('[data-rule-id="carcosaCampaign"]').click()
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'carcosaCampaign')
    await expect(book.locator('[data-rule-topic]')).toContainText('八章')
    await expect(book.locator('[data-rule-topic]')).toContainText('M5')
    await book.locator('.ah-rulebook-related').getByRole('button', { name: '邪秽誓约与隐私馈赠' }).click()
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'carcosaAsylum')
    await book.getByRole('button', { name: '← 返回上一条' }).click()
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'carcosaCampaign')
    await search.fill('隐私')
    await nav.locator('[data-rule-id="hidden"]').click()
    await expect(book.locator('[data-rule-topic]')).toContainText('不能被打出')
    await expect(book.locator('[data-rule-topic]')).toContainText('遭遇弃牌堆')
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `${output}m4-rulebook-${label}.png`, animations: 'disabled' })
    await book.getByRole('button', { name: '关闭规则书' }).click()
    await expect(book).toHaveCount(0)
  })
}

for (const [label, width, height, code] of [
  ['desktop', 1440, 950, '03186'],
  ['mobile', 390, 844, '03340'],
]) {
  test(`M4 卡尔克萨卡牌规则链接在${label}端可达并恢复详情焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const hub = await start(page)
    await hub.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill(code)
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    const hiddenLink = detail.locator('.ah-card-rule-links [data-rule-id="hidden"]')
    await expect(hiddenLink).toBeVisible()
    await hiddenLink.click()
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'hidden')
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(book).toHaveCount(0)
    await expect(detail).toBeVisible()
    expect(await detail.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await detail.getByRole('button', { name: '关闭卡牌详情' }).click()
    await expect(catalog).toBeVisible()
  })
}
