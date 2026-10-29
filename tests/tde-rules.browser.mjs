// 食梦者（TDE）第 3 步 P4 浏览器验收：规则书目录、搜索、关联跳转与移动端返回。
//
// 路线图 §6 / §11.2 要求：规则书桌面 1440 与移动 390 各至少一条真实操作路径 + 截图；
// 关键词条目要能搜到、能跳转、能返回。截图放仓库根的 artifacts/tde-migration/。
// 证据出口：本文件把截图 attach 出去，由 tools/playwright-tde-reporter.mjs 汇总成
// audit/tde-browser-acceptance.json（**由 runner 生成，不得手写**），审计工具只读该文件。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §3：阶段截图放在仓库根目录 artifacts/，不进入游戏运行目录。
const output = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

async function start(page) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  return page.locator('.ah-hub')
}

// 17 条 TDE 规则条目（与 content/campaigns/theDreamEaters/keywords.js 的 TDE_RULE_IDS 一致）。
const TDE_TOPICS = [
  'tdeCampaign', 'tdeDreamQuest', 'tdeWebOfDreams', 'tdeChaos', 'tdeRecords', 'tdeEpilogue',
  'tdeMyriad', 'tdeSwarming', 'tdeVeiled', 'tdeResearched', 'tdeBonded',
  'tdeDreamGate', 'tdeInfestationBag', 'tdeAlarmLevel', 'tdeSignsOfTheGods', 'tdeStoryAssets',
  'tdeLocationDoom',
]

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M4 食梦者规则目录、搜索与返回在${label}端可用`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await start(page)
    await page.keyboard.press('F1')
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    const search = book.getByRole('searchbox', { name: '搜索规则' })
    const nav = book.getByRole('navigation', { name: '规则目录' })
    const article = book.locator('[data-rule-topic]')
    // 目录完整性：17 条食梦者条目全部进入目录（拼音索引）。
    await expect(nav.locator('[data-rule-id^="tde"]')).toHaveCount(TDE_TOPICS.length)
    // 搜索：中文关键词 → 条目。
    await search.fill('蜂拥')
    await expect(nav.locator('[data-rule-id="tdeSwarming"]')).toBeVisible()
    await nav.locator('[data-rule-id="tdeSwarming"]').click()
    await expect(article).toHaveAttribute('data-rule-topic', 'tdeSwarming')
    await expect(article).toContainText('头领')
    await expect(article).toContainText('不能被击败')
    // 关联跳转：蜂拥 → 战役总览。
    await book.locator('.ah-rulebook-related').getByRole('button', { name: '《食梦者》战役与双线结构' }).click()
    await expect(article).toHaveAttribute('data-rule-topic', 'tdeCampaign')
    await expect(article).toContainText('梦境门外')
    await expect(article).toContainText('17、17、18、19')
    // 返回上一条（移动端的主要回退路径）。
    await book.getByRole('button', { name: '← 返回上一条' }).click()
    await expect(article).toHaveAttribute('data-rule-topic', 'tdeSwarming')
    // 搜索另一条：掩藏；确认条目写的是规则，而不是实现位置。
    await search.fill('掩藏')
    await nav.locator('[data-rule-id="tdeVeiled"]').click()
    await expect(article).toContainText('没有未揭示面')
    await expect(article).toContainText('没有线索')
    // 移动端不能横向溢出（桌面同样按 1px 容差检查）。
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const shot = `${output}p4-rulebook-${label}.png`
    await page.screenshot({ path: shot, animations: 'disabled' })
    // 截图路径通过 annotation 交给 tools/playwright-tde-reporter.mjs（runner 生成账本，不手写）。
    test.info().annotations.push({ type: 'screenshot', description: shot })
    await book.getByRole('button', { name: '关闭规则书' }).click()
    await expect(book).toHaveCount(0)
  })
}

for (const [label, width, height, code, ruleId, phrase] of [
  ['desktop', 1440, 950, '06020', 'tdeMyriad', '3 张'],
  ['mobile', 390, 844, '06236', 'tdeResearched', '战役日志'],
]) {
  test(`M4 食梦者卡牌规则链接在${label}端可达并恢复详情焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const hub = await start(page)
    await hub.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill(code)
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    // 目录卡也要能直达食梦者条目，而不是落到别的循环。
    const link = detail.locator(`.ah-card-rule-links [data-rule-id="${ruleId}"]`)
    await expect(link).toBeVisible()
    await link.click()
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    await expect(book.locator('[data-rule-topic]')).toHaveAttribute('data-rule-topic', ruleId)
    await expect(book.locator('[data-rule-topic]')).toContainText(phrase)
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(book).toHaveCount(0)
    await expect(detail).toBeVisible()
    expect(await detail.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await detail.getByRole('button', { name: '关闭卡牌详情' }).click()
    await expect(catalog).toBeVisible()
  })
}
