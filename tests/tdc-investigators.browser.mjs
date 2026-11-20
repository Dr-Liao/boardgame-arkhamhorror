import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { TDC_INVESTIGATOR_CODES } from '../content/packs/tdcInvestigators/manifest.js'

const output = new URL('../../../artifacts/migration/tdc/p5/screenshots/', import.meta.url)
mkdirSync(output, { recursive: true })

for (const [device, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test.describe(device, () => {
    test.use({ viewport: { width, height }, reducedMotion: 'reduce' })
    for (const code of TDC_INVESTIGATOR_CODES) {
      test(code, async ({ page }) => {
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), button => button.click())
        await page.route('**/api/start', async route => {
          const body = route.request().postDataJSON()
          const response = await route.fetch({ postData: {
            ...body, settings: { ...body.settings, playerInvestigator: code, playerCount: 1,
              teammates: 0, playerSeats: [0], legacyAutoStart: true, seed: 'tdc-p5-' + code },
          } })
          await route.fulfill({ response })
        })
        await page.goto('/index.html')
        await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
        const setup = page.getByRole('dialog', { name: '调查准备设置' })
        await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
        const started = page.waitForResponse(res => res.url().includes('/api/start') && res.ok())
        await setup.getByRole('button', { name: '开始新游戏' }).click()
        const { session } = await (await started).json()
        expect(session.state.investigators[0].code).toBe(code)
        await expect(page.locator('.ah-table')).toContainText(INVESTIGATORS[code].nameZh)
        const keep = page.getByRole('button', { name: '保留手牌' })
        if (await keep.count()) await keep.first().click()
        await page.screenshot({ path: fileURLToPath(new URL(device + '-' + code + '.png', output)) })
        expect(errors).toEqual([])
      })
    }
  })
}
