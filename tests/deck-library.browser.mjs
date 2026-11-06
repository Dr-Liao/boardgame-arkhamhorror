import { test, expect } from '@playwright/test'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/', import.meta.url))
const slots = codes => codes.reduce((out, code) => ({ ...out, [code]: (out[code] || 0) + 1 }), {})
const LIBRARY = '/api/mods/arkhamhorror/decks'

test('独立卡组库：卡包筛选、详情管理、批量删除与直接应用', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const deck of (await (await page.request.get(LIBRARY)).json()).decks) {
    await page.request.delete(`${LIBRARY}/${deck.id}`)
  }

  const roland = INVESTIGATORS['01001']
  const daisy = INVESTIGATORS['01002']
  const rolandCards = buildDeck(roland, { seed: 'library-roland' }).playerCards
  const daisyCards = buildDeck(daisy, { seed: 'library-daisy' }).playerCards
  const create = async data => {
    const response = await page.request.post(LIBRARY, { data })
    expect(response.ok()).toBe(true)
    return (await response.json()).deck
  }
  const rolandPack = await create({
    name: '罗兰 · 午夜档案', investigator_code: '01001', slots: slots(rolandCards),
  })
  const draftPack = await create({
    name: '罗兰草稿', investigator_code: '01001', slots: slots(rolandCards.slice(0, 8)),
  })
  const daisyPack = await create({
    name: '黛西 · 秘典研究', investigator_code: '01002', slots: slots(daisyCards),
    arkhamdbId: '12345', arkhamdbKind: 'decklist',
  })

  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('button', { name: '本地卡组库' }).click()
  const library = page.getByRole('dialog', { name: '本地卡组库' })
  await expect(library).toBeVisible()
  await expect(library.locator('[data-library-deck]')).toHaveCount(3)
  await expect(library.locator('.ah-deck-pack-portrait .ah-table-art')).toHaveCount(3)
  await expect(library.locator('.ah-deck-library-detail')).toContainText('黛西 · 秘典研究')

  await library.locator('.ah-deck-library-class-filter').getByRole('button', { name: '守护者' }).click()
  await expect(library.locator('[data-library-deck]')).toHaveCount(2)
  await library.locator('.ah-deck-library-class-filter').getByRole('button', { name: '全部' }).click()
  await library.getByRole('searchbox', { name: '搜索卡组库' }).fill('草稿')
  await expect(library.locator('[data-library-deck]')).toHaveCount(1)
  await library.getByRole('searchbox', { name: '搜索卡组库' }).fill('')

  await library.locator(`[data-library-deck="${rolandPack.id}"]`)
    .getByRole('button', { name: /查看卡包详情/ }).click()
  await expect(library.locator('.ah-deck-library-detail h2')).toHaveText('罗兰 · 午夜档案')
  await library.getByRole('button', { name: '重命名' }).click()
  await library.getByRole('textbox', { name: '卡组名称' }).fill('罗兰 · 已归档')
  await library.getByRole('button', { name: '保存名称' }).click()
  await expect(library.getByRole('status')).toContainText('已重命名')
  await library.getByRole('button', { name: '复制副本' }).click()
  await expect(library.locator('[data-library-deck]')).toHaveCount(4)
  await expect(library.getByRole('status')).toContainText('已复制')
  const downloadPromise = page.waitForEvent('download')
  await library.getByRole('button', { name: '导出 JSON' }).click()
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/)
  await library.getByRole('button', { name: '从 ArkhamDB 导入' }).click()
  await expect(library.getByRole('textbox', { name: 'ArkhamDB 牌组链接或编号' })).toBeVisible()
  await library.getByRole('button', { name: '收起' }).click()

  await library.getByRole('button', { name: '批量管理' }).click()
  await library.locator(`[data-library-deck="${draftPack.id}"]`)
    .getByRole('button', { name: /勾选卡包/ }).click()
  await library.locator(`[data-library-deck="${rolandPack.id}"]`)
    .getByRole('button', { name: /勾选卡包/ }).click()
  await library.getByRole('button', { name: '批量删除（2）' }).click()
  await library.getByRole('button', { name: '确认删除 2 个卡包' }).click()
  await expect(library.locator('[data-library-deck]')).toHaveCount(2)
  await expect(library.getByText('已批量删除 2 个卡包。', { exact: true })).toBeVisible()
  const batchHeights = await library.locator('[data-library-deck]').evaluateAll(items => items.map(item => item.offsetHeight))
  await library.getByRole('button', { name: '退出批量' }).click()
  const normalHeights = await library.locator('[data-library-deck]').evaluateAll(items => items.map(item => item.offsetHeight))
  expect(new Set([...batchHeights, ...normalHeights]).size).toBe(1)
  await expect(library.getByRole('button', { name: /切换为.*并应用/ })).toHaveCount(0)

  await page.screenshot({ path: output + 'deck-library-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(library.locator('.ah-deck-library-packs')).toBeVisible()
  await page.screenshot({ path: output + 'deck-library-mobile.png', animations: 'disabled' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await library.getByRole('button', { name: '关闭本地卡组库' }).click()

  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await hub.getByRole('button', { name: /手动构筑/ }).click()
  const builder = page.getByRole('dialog', { name: /卡组构筑/ })
  await builder.getByRole('button', { name: '卡组库', exact: true }).click()
  await library.locator(`[data-library-deck="${daisyPack.id}"]`)
    .getByRole('button', { name: /查看卡包详情/ }).click()
  await library.locator('.ah-deck-library-detail')
    .getByRole('button', { name: /切换为.*并应用/ }).click()
  await expect(builder.locator('h2')).toContainText(daisy.nameZh)
  await expect(builder.locator('.ah-office-deck-tray h3')).toContainText('30/30')
  await expect(hub.locator('.ah-deck-import-ok')).toContainText('已切换为')
  expect(errors).toEqual([])
})
