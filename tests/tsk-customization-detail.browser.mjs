import { test, expect } from '@playwright/test'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const code = '09042'

test('牌桌卡牌详情显示已解锁、部分勾选和未勾选的定制选项', async ({ page }) => {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'customization-detail',
    } }) })
    const payload = await response.json()
    session = payload.session
    const card = ALL_CARDS[code]
    session.state.cards[code] = { ...card, name: card.nameZh }
    session.state.investigators[0].assets.push({ id: 'quill-detail', code, ownerSeat: 0, exhausted: false })
    Object.assign(session.state, {
      pendingChoice: null, currentSeat: 0, phase: 'investigation',
      legalMoves: [{ action: 'endTurn', label: '结束回合' }],
    })
    session.state.mechanics = {
      ...session.state.mechanics,
      tsk: { customizations: [{ code, checked: [0, 2], level: 1 }] },
    }
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))

  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-story-book')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过演出' })
  if (await skip.count()) await skip.click()

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.locator('[data-interaction="asset:quill-detail"]').click({ button: 'right' })
    const detail = page.getByRole('dialog', { name: '卡牌详情' })
    const options = detail.getByRole('region', { name: '定制选项' })
    const unlocked = options.locator('[data-customization-option="0"]')
    await expect(unlocked).toContainText('笔如有神')
    await expect(unlocked.getByRole('img', { name: '已勾选 1/1 格' }).locator('.ah-customization-box')).toHaveText(['✓'])
    await expect(unlocked).toContainText('不会触发趁乱攻击')
    await expect(unlocked.getByText('已解锁')).toBeVisible()
    const partial = options.locator('[data-customization-option="2"]')
    await expect(partial.getByRole('img', { name: '已勾选 1/2 格' }).locator('.ah-customization-box')).toHaveText(['✓', ''])
    await expect(partial.getByText('已解锁')).toHaveCount(0)
    const empty = options.locator('[data-customization-option="6"]')
    await expect(empty.getByRole('img', { name: '已勾选 0/4 格' }).locator('.ah-customization-box')).toHaveText(['', '', '', ''])
    await expect(options).not.toContainText('已勾选')
    await expect(detail).toBeVisible()
    expect(await detail.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await detail.getByRole('button', { name: '关闭卡牌详情' }).click()
  }
})
