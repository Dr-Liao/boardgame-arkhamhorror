import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const screenshots = new URL('../../../artifacts/migration/tdc/p6/screenshots/', import.meta.url)
mkdirSync(screenshots, { recursive: true })

for (const [device, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  test.describe(device, () => {
    test.use({ viewport: { width, height }, reducedMotion: 'reduce' })

    test('真实大厅手动加入零级玩家卡，并用清苦度日获得构筑预算', async ({ page }) => {
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/index.html')
      const catalog = await page.request.get('/api/catalog')
      expect(catalog.ok()).toBe(true)
      const game = (await catalog.json()).games.find(item => item.id === 'arkhamhorror')
      const pool = game.clientData.deckBuilder.cardPool
      expect(pool).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: '11023', xp: 0 }),
        expect.objectContaining({ code: '11027', xp: 2 }),
        expect.objectContaining({ code: '11095', startingExperience: 10 }),
      ]))
      expect(pool.filter(card => ['11126', '11127', '11128', '11129'].includes(card.code))).toEqual([])

      await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
      const setup = page.getByRole('dialog', { name: '调查准备设置' })
      await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
      await setup.getByRole('button', { name: '开始新游戏' }).click()
      const hub = page.locator('.ah-hub')
      await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
      await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
      await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
      await hub.getByRole('button', { name: /手动构筑/ }).click()
      const builder = page.getByRole('dialog', { name: '卡组构筑' })
      const card = code => builder.locator(`.ah-db-card[data-zoom-code="${code}"]`)
      const add = code => card(code).locator(`[data-focus-key="add:${code}"]`)
      const tray = builder.locator('.ah-office-deck-tray')
      const row = code => tray.locator(`.ah-deck-row[data-zoom-code="${code}"]`)

      await expect(builder).toBeVisible()
      await expect(card('11023')).toContainText('0 级')
      await expect(card('11027')).toHaveCount(0)
      await add('11023').click()
      await expect(row('11023')).toBeVisible()
      await expect(tray.locator('h3')).toContainText('1/30')

      await add('11095').click()
      await expect(row('11095')).toBeVisible()
      await expect(add('11095')).toBeDisabled()
      await expect(card('11027')).toContainText('2 级')
      await add('11027').click()
      await expect(row('11027')).toBeVisible()
      await expect(tray.locator('h3')).toContainText('2/30')
      await page.screenshot({ path: fileURLToPath(new URL(device + '-manual-deck.png', screenshots)) })
      expect(errors).toEqual([])
    })
  })
}
