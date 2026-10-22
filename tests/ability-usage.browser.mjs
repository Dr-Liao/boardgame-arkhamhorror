import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const output = fileURLToPath(new URL('../../../artifacts/arkham-polish/', import.meta.url))

// 「每回合/每场游戏一次」的能力用掉后，按钮会从合法行动里消失。本用例锁住补偿：
// 卡面角标、动作面板置灰行、卡牌详情里的「能力使用情况」都要写明「已使用」。
test('上限用掉的能力在卡面、动作面板与详情里都显示「已使用」', async ({ page }) => {
  let session
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'ability-usage',
    } }) })
    const payload = await response.json()
    session = payload.session
    const def = ALL_CARDS['03266']
    // 展示表按卡号取定义：补上这张支援，否则前端只会画出「其他资产」占位。
    session.state.cards['03266'] = { ...def, name: def.nameZh || def.name }
    Object.assign(session.state, {
      pendingChoice: null, currentSeat: 0, phase: 'investigation',
      legalMoves: [{ action: 'endTurn', label: '⏭️ 结束回合' }],
      abilityUsage: { 0: [{
        assetId: 'insight-1', code: '03266', name: '奥术洞察', used: true,
        abilities: [{ index: 0, label: '奥术洞察降低帷幕', scope: 'perTurn', limitText: '每回合 1 次', used: true }],
      }] },
      // 内容层标了 used 的「每场游戏一次」地点行动：服务端投影为 view.usedActions。
      usedActions: [{ label: '☕ 在小餐馆听人闲聊（3 行动，获得 2 个线索）', reason: '本场游戏已使用（每场游戏仅限一次）' }],
    })
    session.state.investigators[0].assets.push({ id: 'insight-1', code: '03266', exhausted: false, uses: 3 })
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))

  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-story-book')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.click()

  const card = page.locator('.ah-minicard[data-card-code="03266"]')
  await expect(card).toBeVisible()
  await expect(card.locator('[data-ability-used="true"]')).toHaveText('已用')
  await expect(card).toHaveAttribute('aria-label', /已用：奥术洞察降低帷幕（每回合 1 次，已使用）/)

  await card.click()
  const popover = page.locator('.ah-card-action-popover')
  await expect(popover).toBeVisible()
  const usedRow = popover.locator('.ah-action.is-used')
  await expect(usedRow).toHaveCount(1)
  await expect(usedRow).toContainText('奥术洞察降低帷幕（每回合 1 次，已使用）')
  await expect(usedRow).toBeDisabled()
  await expect(page.locator('.ah-context-reason')).toContainText('已用：奥术洞察降低帷幕')

  mkdirSync(output, { recursive: true })
  await page.screenshot({ path: output + 'ability-usage-1440.png', animations: 'disabled', fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(card).toBeVisible()
  await page.screenshot({ path: output + 'ability-usage-390.png', animations: 'disabled', fullPage: false })
  await page.setViewportSize({ width: 1400, height: 950 })
  await page.keyboard.press('Escape')

  // 右键打开卡牌详情，能力使用情况逐条列出（已用/可用）。
  await card.click({ button: 'right' })
  const detail = page.getByRole('dialog', { name: '卡牌详情' })
  await expect(detail).toBeVisible()
  const usageRows = detail.locator('.ah-detail-usage-row')
  await expect(usageRows).toHaveCount(1)
  await expect(usageRows.first()).toHaveAttribute('data-ability-used', 'true')
  await expect(usageRows.first()).toContainText('每回合 1 次 · 已使用')
  await usageRows.first().scrollIntoViewIfNeeded()
  await expect(usageRows.first()).toBeVisible()
  await page.screenshot({ path: output + 'ability-usage-detail.png', animations: 'disabled' })
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()

  // 地点里「每场游戏一次」的行动用掉后，动作栏与地点详情都保留一行「已用」。
  await page.locator('.ah-loc[data-location-id="study"]').first().click()
  const usedLocationAction = page.locator('.ah-actions .ah-action.is-used')
  await expect(usedLocationAction).toHaveCount(1)
  await expect(usedLocationAction).toContainText('☕ 在小餐馆听人闲聊')
  await page.getByRole('button', { name: '查看地点详情' }).click()
  const locationDetail = page.getByRole('dialog', { name: '卡牌详情' })
  await expect(locationDetail.locator('.ah-location-detail-actions .ah-action.is-used')).toHaveCount(1)
  expect(errors).toEqual([])
})
