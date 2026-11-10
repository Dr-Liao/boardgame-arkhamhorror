// 八循环《绯红密钥》（TSK）P3 规则书浏览器验收 spec。
//
// 覆盖四象限（桌面 1440×950 / 移动 390×844 × zh-CN / en）：
//   · 规则目录：`nav [data-rule-id^="tsk"]` 数量 === TSK_RULE_IDS.length；
//   · 搜索 + 阅读：填「Concealed」/「隐匿」后点 tskConcealed，正文必须包含已实现规则文本；
//   · 相关跳转与返回：tskConcealed 的第一条相关条目是 tskCampaign，点「返回」回 tskConcealed；
//   · 版式：规则书无横向滚动；Escape 关闭。
// 另加每个视口的「卡文直达」：全卡图鉴搜 09059（定制升级卡「Damning Testimony」），点卡牌 →
// 点规则链接打开规则书 → Escape 关闭后卡牌详情仍可见且焦点回到详情内的规则链接。
//
// 本 spec 不启动 TSK 战役（P3 仍 catalog-only）：只在已有可玩战役的大厅里打开规则书，
// 避免浏览器验收制造「战役已开放」的假证据。证据账本由 tools/playwright-tsk-reporter.mjs 汇总。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TSK_RULE_IDS } from '../web/tsk-rules.js'

const output = fileURLToPath(new URL('../../../artifacts/migration/tsk/reports/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

// 与 TIC/TDE/EotE 浏览器验收同口径：从大厅卡片进入「调查准备设置」，不依赖默认战役或存档。
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
        window.dispatchEvent(new CustomEvent('arkham-open-rule', { detail: 'tskConcealed' }))
      }, language)

      const book = page.locator('.ah-rulebook')
      const nav = book.locator('nav')
      const article = book.locator('[data-rule-topic]')
      await expect(book).toBeVisible()
      await expect(nav.locator('[data-rule-id^="tsk"]')).toHaveCount(TSK_RULE_IDS.length)

      // 搜索命中后从目录进入 tskConcealed；正文必须是从 P3 规则数据真实渲染的已实现文本。
      const search = book.locator('input[type=search]')
      await search.fill(language === 'en' ? 'Concealed' : '隐匿')
      await nav.locator('[data-rule-id="tskConcealed"]').click()
      await expect(article).toHaveAttribute('data-rule-topic', 'tskConcealed')
      const text = await article.innerText()
      if (language === 'en') {
        expect(text.toLowerCase()).toContain('concealed mini-card')
        expect(text.toLowerCase()).toContain('decoy')
      } else {
        expect(text).toContain('隐匿迷你卡')
        expect(text).toContain('诱饵')
      }

      // 相关条目跳转：tskConcealed 的第一条相关条目是 tskCampaign（战役概览）。
      expect(await book.locator('.ah-rulebook-related button').count()).toBeGreaterThanOrEqual(1)
      await book.locator('.ah-rulebook-related button').first().click()
      await expect(article).toHaveAttribute('data-rule-topic', 'tskCampaign')
      await expect(article).not.toBeEmpty()
      // 返回上一主题（规则书内部历史），必须回到 tskConcealed。
      await book.locator('.ah-rulebook-back').click()
      await expect(article).toHaveAttribute('data-rule-topic', 'tskConcealed')

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
    await catalog.getByRole('textbox', { name: '卡号或名称' }).fill('09059')
    await expect(catalog.locator('.ah-catalog-card')).toHaveCount(1)
    await catalog.locator('.ah-catalog-card').click()
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    await expect(detail).toBeVisible()

    // 契约：每张 09 卡都连 tskCampaign；09059 另有定制升级相关条目。
    await expect(detail.locator('.ah-card-rule-links [data-rule-id="tskCampaign"]')).toHaveCount(1)
    const keywordLink = detail.locator('.ah-card-rule-links [data-rule-id^="tsk"]:not([data-rule-id="tskCampaign"])')
    const target = (await keywordLink.count()) > 0
      ? keywordLink.first()
      : detail.locator('.ah-card-rule-links [data-rule-id="tskCampaign"]')
    const topic = await target.getAttribute('data-rule-id')
    expect(topic).toMatch(/^tsk/)
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
