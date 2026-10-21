import { test, expect } from '@playwright/test'
import { describeArkhamDbDeck } from '../src/integration/arkhamdb.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/', import.meta.url))
const slots = codes => codes.reduce((out, code) => ({ ...out, [code]: (out[code] || 0) + 1 }), {})
const deckFor = (code, extra = {}) => ({
  investigator_code: code, name: `测试牌组 ${code}`,
  slots: { ...slots(buildDeck(INVESTIGATORS[code], { seed: 'import-ui' }).playerCards), ...INVESTIGATORS[code].deckRequirements.signatureCards.reduce((out, c) => ({ ...out, [c]: 1 }), {}), '01000': 1, ...extra },
})
const decks = {
  1: describeArkhamDbDeck(deckFor('01001', { '05010': 1 }), { kind: 'decklist', id: '1' }),
  2: describeArkhamDbDeck(deckFor('01002'), { kind: 'decklist', id: '2' }),
  3: describeArkhamDbDeck(deckFor('01001'), { kind: 'decklist', id: '3' }),
}

test('从 ArkhamDB 导入：未实现整副拒绝、跨调查员切换后载入、合法牌组保存', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/mods/arkhamhorror/arkhamdb/**', route => {
    const id = new URL(route.request().url()).pathname.split('/').pop()
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, deck: decks[id] }) })
  })
  await page.goto('/index.html'); await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await hub.getByRole('button', { name: '从 ArkhamDB 导入' }).click()
  const modal = page.getByRole('dialog', { name: '卡组构筑' })
  const input = modal.getByRole('textbox', { name: 'ArkhamDB 牌组链接或编号' })
  await expect(input).toBeFocused()

  await input.fill('https://example.com/deck/1')
  await modal.getByRole('button', { name: '读取牌组' }).click()
  await expect(modal.getByRole('alert')).toContainText('arkhamdb.com')

  await input.fill('https://arkhamdb.com/decklist/view/1/test')
  await input.press('Enter')
  await expect(modal.locator('.ah-deck-import-result')).toContainText('整副牌组不能导入')
  await expect(modal.getByRole('button', { name: /载入草稿/ })).toHaveCount(0)

  await input.fill('2')
  await modal.getByRole('button', { name: '读取牌组' }).click()
  const switchButton = modal.getByRole('button', { name: /^切换为.*并载入$/ })
  await expect(switchButton).toBeVisible()
  await switchButton.click()
  await expect(modal.locator('h2')).toContainText(INVESTIGATORS['01002'].nameZh)
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('30/30')
  await expect(modal.locator('.ah-deck-import-notice')).toContainText('已切换为')
  await modal.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText(/\d+\/30/)
  await modal.getByRole('button', { name: '重做', exact: true }).click()
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('30/30')
  await modal.getByRole('button', { name: '清空', exact: true }).click()
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('0/30')
  await expect(modal.locator('.ah-deck-progress-text')).toContainText('还差 30 张')

  await modal.getByRole('button', { name: '导入 ArkhamDB' }).click()
  await input.fill('https://arkhamdb.com/decklist/view/2')
  await modal.getByRole('button', { name: '读取牌组' }).click()
  await expect(modal.locator('.ah-deck-import-ok')).toBeVisible()
  await page.screenshot({ path: output + 'deck-import-preview.png', animations: 'disabled' })
  await modal.getByRole('button', { name: /^载入草稿/ }).click()
  await expect(modal.locator('.ah-deck-import')).toHaveCount(0)
  await expect(modal.locator('.ah-office-deck-tray h3')).toContainText('30/30')
  await expect(modal.locator('.ah-deck-fixed .ah-deck-fixed-card')).toHaveCount(INVESTIGATORS['01002'].deckRequirements.signatureCards.length + 1)
  await page.screenshot({ path: output + 'deck-import-loaded.png', animations: 'disabled' })
  const save = page.waitForResponse(r => r.url().endsWith('/api/move') && r.request().postDataJSON()?.move?.action === 'hubSetDeck')
  await modal.getByRole('button', { name: '保存牌组', exact: true }).click()
  const deck = (await (await save).json()).session.state.campaign.investigators[0].deck
  expect(deck).toHaveLength(33)
  await expect(hub.locator('.ah-deck-save-status')).toContainText('已保存 · 33 张')
  expect(errors).toEqual([])
})
