import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §3：阶段截图放在仓库根目录 artifacts/，不进入游戏运行目录。
const output = fileURLToPath(new URL('../../../artifacts/tfa-migration/', import.meta.url))
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
  test(`M4 失落的时代规则目录、搜索与返回在${label}端可用`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await start(page)
    await page.keyboard.press('F1')
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    const search = book.getByRole('searchbox', { name: '搜索规则' })
    const nav = book.getByRole('navigation', { name: '规则目录' })
    await search.fill('失落的时代')
    await expect(nav.locator('[data-rule-id="tfaCampaign"]')).toBeVisible()
    await nav.locator('[data-rule-id="tfaCampaign"]').click()
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'tfaCampaign')
    await expect(book.locator('[data-rule-topic]')).toContainText('十章')
    await expect(book.locator('[data-rule-topic]')).toContainText('playable')
    await expect(book.locator('[data-rule-topic]')).toContainText('earlyAccess')
    await book.locator('.ah-rulebook-related').getByRole('button', { name: '探索牌库与探索行动' }).click()
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'tfaExploration')
    await book.getByRole('button', { name: '← 返回上一条' }).click()
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', 'tfaCampaign')
    await search.fill('中毒')
    await nav.locator('[data-rule-id="tfaPoison"]').click()
    await expect(book.locator('[data-rule-topic]')).toContainText('04102')
    await expect(book.locator('[data-rule-topic]')).toContainText('自动失败')
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: `${output}m4-rulebook-${label}.png`, animations: 'disabled' })
    await book.getByRole('button', { name: '关闭规则书' }).click()
    await expect(book).toHaveCount(0)
  })
}

for (const [label, width, height, code, ruleId] of [
  ['desktop', 1440, 950, '04102', 'tfaPoison'],
  ['mobile', 390, 844, '04043', 'tfaChaos'],
]) {
  test(`M4 失落的时代卡牌规则链接在${label}端可达并恢复详情焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const hub = await start(page)
    await hub.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill(code)
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    const link = detail.locator(`.ah-card-rule-links [data-rule-id="${ruleId}"]`)
    await expect(link).toBeVisible()
    await link.click()
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', ruleId)
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(book).toHaveCount(0)
    await expect(detail).toBeVisible()
    expect(await detail.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await detail.getByRole('button', { name: '关闭卡牌详情' }).click()
    await expect(catalog).toBeVisible()
  })
}
