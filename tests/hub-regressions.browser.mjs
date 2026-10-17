import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import { describeArkhamDbDeck } from '../src/integration/arkhamdb.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'

let server, base, previousHome
test.beforeAll(async () => {
  previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-hub-regressions-'))
  server = createServer({ mods: (await loadMods()).filter(mod => mod.id === 'arkhamhorror') })
  await server.ready
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
test.afterAll(async () => {
  server?.closeAllConnections()
  if (server) await new Promise(resolve => server.close(resolve))
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
})

async function prepare(page) {
  await page.goto(base)
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
  return hub
}

const cards = buildDeck(INVESTIGATORS['01001'], { seed: 'reopen-import' }).playerCards
const slots = cards.reduce((out, code) => { out[code] = (out[code] || 0) + 1; return out }, {})
const deck = describeArkhamDbDeck({ investigator_code: '01001', name: '窗口重开测试牌组', slots })

for (const fails of [false, true]) test(`导入请求${fails ? '失败' : '成功'}后，重开的构筑窗口恢复且可重试`, async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const hub = await prepare(page)
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  await hub.getByRole('button', { name: '从 ArkhamDB 导入' }).click()
  const modal = page.getByRole('dialog', { name: '卡组构筑' })
  let release, requests = 0
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/api/mods/arkhamhorror/arkhamdb/**', async route => {
    const first = ++requests === 1
    if (first) await gate
    await route.fulfill(first && fails
      ? { status: 502, json: { ok: false, error: '测试读取失败' } }
      : { json: { ok: true, deck } })
  })
  try {
    await modal.getByRole('textbox', { name: 'ArkhamDB 牌组链接或编号' }).fill('12345')
    const requested = page.waitForRequest('**/api/mods/arkhamhorror/arkhamdb/**')
    await modal.getByRole('button', { name: '读取牌组', exact: true }).click()
    await requested
    for (let i = 0; i < 2; i++) {
      await modal.getByRole('button', { name: '取消', exact: true }).click()
      await hub.getByRole('button', { name: '从 ArkhamDB 导入' }).click()
      await expect(modal.getByRole('button', { name: '读取中…', exact: true })).toBeDisabled()
    }
    release()
    await expect(modal.getByRole('button', { name: '读取牌组', exact: true })).toBeEnabled()
    if (fails) await expect(modal.getByRole('alert')).toHaveText('测试读取失败')
    else await expect(modal.locator('.ah-deck-import-result')).toContainText(deck.name)
    await modal.getByRole('button', { name: '读取牌组', exact: true }).click()
    await expect(modal.locator('.ah-deck-import-result')).toContainText(deck.name)
    await expect(modal.getByRole('alert')).toHaveCount(0)
    expect(requests).toBe(2)
    await modal.getByRole('button', { name: /^载入草稿/ }).click()
    const saved = page.waitForResponse(response => response.url().endsWith('/api/move')
      && response.request().postDataJSON()?.move?.action === 'hubSetDeck')
    await modal.getByRole('button', { name: '保存牌组', exact: true }).click()
    expect((await (await saved).json()).ok).toBe(true)
    await expect(hub.locator('.ah-deck-save-status')).toContainText('已保存')
    expect(errors).toEqual([])
  } finally { release() }
})

test('调查准备时保持当前关卡已选择，未开放的关卡保持锁定', async ({ page }) => {
  const hub = await prepare(page)
  await hub.getByRole('button', { name: '关卡选择', exact: true }).click()
  const current = hub.locator('.ah-hub-scenario').first()
  await expect(current).toContainText('已选择')
  await expect(current).toHaveClass(/selected/)
  await expect(current).not.toHaveClass(/locked/)
  await expect(current.locator('button')).toHaveCount(0)
  await expect(hub.locator('.ah-hub-scenario.locked')).toHaveCount(2)
  await hub.getByRole('button', { name: '调查员与席位', exact: true }).click()
  await hub.getByRole('button', { name: /自动构筑/ }).click()
  await hub.getByRole('button', { name: '确认准备', exact: true }).first().click()
  await expect(hub.getByRole('button', { name: '开始当前关卡' })).toBeEnabled()
  await hub.getByRole('button', { name: '关卡选择', exact: true }).click()
  await expect(current).toHaveClass(/selected/)
  await expect(current.getByRole('button', { name: '已选择', exact: true })).toBeEnabled()
  await expect(hub.locator('.ah-hub-scenario.locked')).toHaveCount(2)
})
