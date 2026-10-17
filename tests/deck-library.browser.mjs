import { test, expect } from '@playwright/test'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/', import.meta.url))
const slots = codes => codes.reduce((out, code) => ({ ...out, [code]: (out[code] || 0) + 1 }), {})
const LIBRARY = '/api/mods/arkhamhorror/decks'

test('本地卡组库：存入、载入、覆盖、删除，跨调查员切换后载入', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  for (const deck of (await (await page.request.get(LIBRARY)).json()).decks) await page.request.delete(`${LIBRARY}/${deck.id}`)

  await page.goto('/index.html'); await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await hub.getByRole('button', { name: '本地卡组库' }).click()

  const modal = page.getByRole('dialog', { name: '卡组构筑' })
  const panel = modal.locator('.ah-deck-library')
  const count = modal.locator('.ah-office-deck-tray h3')
  await expect(panel).toContainText('卡组库还是空的')
  await expect(panel.getByRole('button', { name: /存为新卡组/ })).toBeDisabled()

  await panel.getByRole('button', { name: '收起' }).click()
  const addButtons = modal.locator('.ah-hub-card-pool button[aria-label^="加入"]:enabled')
  for (let i = 0; i < 3; i++) await addButtons.nth(i).click()
  await expect(count).toContainText('3/30')

  await modal.getByRole('button', { name: '卡组库', exact: true }).click()
  await panel.getByRole('textbox', { name: '卡组名称' }).fill('测试收藏')
  await panel.getByRole('button', { name: '存为新卡组（3 张）' }).click()
  await expect(panel.getByRole('status')).toContainText('已存入卡组库：《测试收藏》')
  await expect(panel.locator('li')).toHaveCount(1)
  await expect(panel.locator('li')).toContainText('3 张')

  await modal.getByRole('button', { name: '清空', exact: true }).click()
  await expect(count).toContainText('0/30')
  await panel.getByRole('button', { name: '载入', exact: true }).click()
  await expect(panel).toHaveCount(0)
  await expect(count).toContainText('3/30')
  await expect(modal.locator('.ah-deck-import-notice')).toContainText('已从卡组库载入《测试收藏》')

  await addButtons.nth(3).click()
  await expect(count).toContainText('4/30')
  await modal.getByRole('button', { name: '卡组库', exact: true }).click()
  await panel.getByRole('button', { name: '覆盖《测试收藏》' }).click()
  await expect(panel.locator('li')).toContainText('4 张')
  await page.screenshot({ path: output + 'deck-library.png', animations: 'disabled' })

  await panel.getByRole('button', { name: '删除', exact: true }).click()
  await panel.getByRole('button', { name: '确认删除' }).click()
  await expect(panel).toContainText('卡组库还是空的')
  expect((await (await page.request.get(LIBRARY)).json()).decks).toEqual([])

  const daisy = INVESTIGATORS['01002']
  const created = await page.request.post(LIBRARY, { data: { name: '黛西收藏', investigator_code: '01002',
    slots: slots(buildDeck(daisy, { seed: 'library-ui' }).playerCards) } })
  expect(created.ok()).toBe(true)
  await panel.getByRole('button', { name: '收起' }).click()
  await modal.getByRole('button', { name: '卡组库', exact: true }).click()
  await panel.getByRole('button', { name: /^切换为.*并载入$/ }).click()
  await expect(modal.locator('h2')).toContainText(daisy.nameZh)
  await expect(count).toContainText('30/30')
  await expect(modal.locator('.ah-deck-import-notice')).toContainText('已切换为')
  expect(errors).toEqual([])
})
