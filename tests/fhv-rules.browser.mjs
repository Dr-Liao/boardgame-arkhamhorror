// 九循环《铁杉谷盛宴》（FHV）P3 规则书浏览器验收 spec。
//
// 覆盖四象限（桌面 1440×950 / 移动 390×844 × zh-CN / en）：
//   · 规则目录：`nav [data-rule-id^="fhv"]` 数量 === FHV_RULE_IDS.length；
//   · 搜索 + 阅读：填「Codex」/「法典」后点 fhvCodex，正文必须包含已实现规则文本；
//   · 相关跳转与返回：fhvCodex 的第一条相关条目是 fhvResidents，点「返回」回 fhvCodex；
//   · 版式：规则书无横向滚动；Escape 关闭。
// 另加每个视口的「卡文直达」：全卡图鉴搜 10011（逃逸敌人 Zamacona），点卡牌 → 点规则链接
// 打开规则书 → Escape 关闭后卡牌详情仍可见且焦点回到详情内的规则链接。
//
// 本 spec 不启动 FHV 战役（P3 仍 catalog-only）：只在已有可玩战役的大厅里打开规则书，
// 避免浏览器验收制造「战役已开放」的假证据。证据账本由 tools/playwright-fhv-reporter.mjs 汇总。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FHV_RULE_IDS } from '../web/fhv-rules.js'

const output = fileURLToPath(new URL('../../../artifacts/migration/fhv/reports/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

// 与 TIC/TDE/EotE/TSK 浏览器验收同口径：从大厅卡片进入「调查准备设置」，不依赖默认战役或存档。
async function start(page) {
  page.on('pageerror', error => console.error('browser page error: ' + error.message))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-hub')).toBeVisible({ timeout: 30_000 })
}

async function setLocale(page, language) {
  await page.evaluate(async language => {
    const { setLocale } = await import('/mods/arkhamhorror/i18n.js')
    setLocale(language)
  }, language)
}

for (const [viewport, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  for (const language of ['zh-CN', 'en']) {
    test(`P3 ${viewport} ${language} 规则目录、阅读与返回`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await start(page)
      await page.evaluate(async language => {
        const { setLocale } = await import('/mods/arkhamhorror/i18n.js')
        setLocale(language)
        window.dispatchEvent(new CustomEvent('arkham-open-rule', { detail: 'fhvCodex' }))
      }, language)

      const book = page.locator('.ah-rulebook')
      const nav = book.locator('nav')
      const article = book.locator('[data-rule-topic]')
      await expect(book).toBeVisible()
      await expect(nav.locator('[data-rule-id^="fhv"]')).toHaveCount(FHV_RULE_IDS.length)

      // 搜索命中后从目录进入 fhvCodex；正文必须是从 P3 规则数据真实渲染的已实现文本。
      const search = book.locator('input[type=search]')
      await search.fill(language === 'en' ? 'Codex' : '法典')
      await nav.locator('[data-rule-id="fhvCodex"]').click()
      await expect(article).toHaveAttribute('data-rule-topic', 'fhvCodex')
      const text = await article.innerText()
      if (language === 'en') {
        expect(text.toLowerCase()).toContain('codex')
        expect(text.toLowerCase()).toContain('relationship level')
      } else {
        expect(text).toContain('铁杉谷法典')
        expect(text).toContain('关系等级')
      }

      // 相关条目跳转：fhvCodex 的第一条相关条目是 fhvResidents（居民关系等级与笔记）。
      expect(await book.locator('.ah-rulebook-related button').count()).toBeGreaterThanOrEqual(1)
      await book.locator('.ah-rulebook-related button').first().click()
      await expect(article).toHaveAttribute('data-rule-topic', 'fhvResidents')
      await expect(article).not.toBeEmpty()
      // 返回上一主题（规则书内部历史），必须回到 fhvCodex。
      await book.locator('.ah-rulebook-back').click()
      await expect(article).toHaveAttribute('data-rule-topic', 'fhvCodex')

      // 版式门禁：规则书不得横向滚动（移动端 390 宽度尤其重要）。
      expect(await book.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
      const path = `${output}${viewport}-${language}.png`
      await page.screenshot({ path, animations: 'disabled' })
      test.info().annotations.push(
        { type: 'screenshot', description: path },
        { type: 'viewport', description: viewport },
        { type: 'language', description: language },
        { type: 'check', description: 'noHorizontalScroll' },
      )
      // Escape 关闭规则书。
      await page.keyboard.press('Escape')
      await expect(book).toHaveCount(0)
    })
  }

  test(`P3 ${viewport} 卡文直达并恢复详情焦点`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await start(page)
    // 卡图鉴/详情对话框的标题跟随语言；固定 zh-CN 让选择器确定（不依赖浏览器上次语言）。
    await setLocale(page, 'zh-CN')
    await page.getByRole('button', { name: '全卡图鉴' }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill('10011')
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    await expect(detail).toBeVisible()

    // 契约：每张 10 段卡都连 fhvCampaign；10011（逃逸敌人 Zamacona）另有逃逸条目。
    await expect(detail.locator('.ah-card-rule-links [data-rule-id="fhvCampaign"]')).toHaveCount(1)
    const target = detail.locator('.ah-card-rule-links [data-rule-id="fhvElusive"]')
    await expect(target).toHaveCount(1)
    const topic = await target.getAttribute('data-rule-id')
    expect(topic).toBe('fhvElusive')
    await target.click()

    const book = page.locator('.ah-rulebook')
    const article = book.locator('[data-rule-topic]')
    await expect(book).toBeVisible()
    await expect(article).toHaveAttribute('data-rule-topic', topic)
    await expect(article).not.toBeEmpty()
    const path = `${output}${viewport}-card-link.png`
    await page.screenshot({ path, animations: 'disabled' })
    test.info().annotations.push(
      { type: 'screenshot', description: path },
      { type: 'viewport', description: viewport },
      { type: 'language', description: 'zh-CN' },
      { type: 'check', description: 'cardLink' },
    )

    // 关闭规则书后回到卡牌详情，且焦点恢复到详情内触发它的规则链接（键盘可达性）。
    await page.keyboard.press('Escape')
    await expect(book).toHaveCount(0)
    await expect(detail).toBeVisible()
    expect(await detail.evaluate(element => element.contains(document.activeElement))).toBe(true)
  })
}
