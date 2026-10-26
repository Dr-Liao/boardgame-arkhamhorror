// 万象无终（TCU）第 3 步 P4 浏览器验收：规则书目录、搜索、关联跳转与移动端返回。
//
// 路线图 §5.3 要求：规则书搜索、关联跳转、移动端返回要有 Playwright 用例，桌面 1440 与移动 390
// 各至少一张截图，截图放 artifacts/tcu-migration/。
// 证据出口：本文件把截图 attach 出去，由 tools/playwright-tcu-reporter.mjs 汇总成
// audit/tcu-browser-acceptance.json（**由 runner 生成，不得手写**），审计工具只读该文件。

import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §3：阶段截图放在仓库根目录 artifacts/，不进入游戏运行目录。
const output = fileURLToPath(new URL('../../../artifacts/tcu-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

async function start(page) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  return page.locator('.ah-hub')
}

const TCU_TOPICS = [
  'tcuCampaign', 'tcuHaunted', 'tcuSpectral', 'tcuCircle', 'tcuTarot', 'tcuTarotSlot',
  'tcuBonded', 'tcuMemento', 'tcuWatcher', 'tcuPrologue', 'tcuBreaches', 'tcuChaos',
  'tcuHeretics', 'tcuCosmos', 'tcuBraziers', 'tcuCampaignAssets',
]

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`M4 万象无终规则目录、搜索与返回在${label}端可用`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await start(page)
    await page.keyboard.press('F1')
    const book = page.getByRole('dialog', { name: '游戏规则书' })
    const search = book.getByRole('searchbox', { name: '搜索规则' })
    const nav = book.getByRole('navigation', { name: '规则目录' })
    const article = book.locator('[data-rule-topic]')
    // 规则书默认打开置顶的基础规则，且「入门」分组排在 A–Z 之前。
    await expect(article).toHaveAttribute('data-rule-topic', 'basics')
    await expect(article).toContainText('基础规则')
    await expect(nav.locator('.ah-rule-index-group').first()).toHaveClass(/ah-rule-index-pinned/)
    await expect(nav.locator('.ah-rule-index-pinned [data-rule-id="basics"]')).toBeVisible()
    // 置顶基础规则本身就是默认阅读页，单独留一张桌面/移动证据。
    const basicsShot = `${output}p4-rulebook-basics-${label}.png`
    await page.screenshot({ path: basicsShot, animations: 'disabled' })
    test.info().annotations.push({ type: 'screenshot', description: basicsShot })
    // 目录完整性：16 条万象无终条目全部进入目录（拼音索引）。
    await expect(nav.locator('[data-rule-id^="tcu"]')).toHaveCount(TCU_TOPICS.length)
    // 搜索：印刷词 → 条目。
    await search.fill('闹鬼')
    await expect(nav.locator('[data-rule-id="tcuHaunted"]')).toBeVisible()
    await nav.locator('[data-rule-id="tcuHaunted"]').click()
    await expect(article).toHaveAttribute('data-rule-topic', 'tcuHaunted')
    await expect(article).toContainText('调查检定')
    await expect(article).toContainText('闹鬼能力')
    // 关联跳转：闹鬼 → 幽灵界。
    await book.locator('.ah-rulebook-related').getByRole('button', { name: '幽灵界、幽灵地点与第二遭遇牌堆' }).click()
    await expect(article).toHaveAttribute('data-rule-topic', 'tcuSpectral')
    await expect(article).toContainText('第二遭遇牌堆')
    // 返回上一条（移动端的主要回退路径）。
    await book.getByRole('button', { name: '← 返回上一条' }).click()
    await expect(article).toHaveAttribute('data-rule-topic', 'tcuHaunted')
    // 搜索另一条：火盆；确认条目写的是规则，而不是实现位置。
    await search.fill('火盆')
    await nav.locator('[data-rule-id="tcuBraziers"]').click()
    await expect(article).toContainText('机关盒')
    await expect(article).toContainText('火盆')
    // 战役总览要写明章节中文名与基础袋构成。
    await search.fill('万象无终')
    await nav.locator('[data-rule-id="tcuCampaign"]').click()
    // 规则书只写规则：四个难度与 13 枚基础袋，不写发布状态或实现账本。
    await expect(article).toContainText('四个难度')
    await expect(article).toContainText('聚合幻灭')
    await expect(article).toContainText('13 枚')
    // 移动端不能横向溢出（桌面同样按 1px 容差检查）。
    expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const shot = `${output}p4-rulebook-${label}.png`
    await page.screenshot({ path: shot, animations: 'disabled' })
    // 截图路径通过 annotation 交给 tools/playwright-tcu-reporter.mjs（runner 生成账本，不手写）；
    // 不用 attach：Playwright 会把附件复制进 test-results/，那不是可提交的证据。
    test.info().annotations.push({ type: 'screenshot', description: shot })
    await book.getByRole('button', { name: '关闭规则书' }).click()
    await expect(book).toHaveCount(0)
  })
}

for (const [label, width, height, code, ruleId] of [
  ['desktop', 1440, 950, '05043', 'tcuHaunted'],
  ['mobile', 390, 844, '05228', 'tcuBraziers'],
]) {
  test(`M4 万象无终卡牌规则链接在${label}端可达并恢复详情焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const hub = await start(page)
    await hub.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill(code)
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    // 目录卡也要能直达万象无终条目，而不是落到别的循环。
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
