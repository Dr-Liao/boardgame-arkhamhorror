// 「压在卡下面 / 附属在卡上」的牌桌验收：桌面 1440 与移动 390 都要看得见、点得动。
//
// 覆盖 2026-10-26 修复：
//   · 调查员底下的牌（戴安娜·史丹利 / 赛菲娜·卢梭）与直觉牌库（乔·戴蒙德）在牌桌上成行显示；
//   · 载体支援（原定计划 / 背包 / 宿主附属）点开后能看见并打出它下面的牌；
//   · 调查员详情有「下方卡牌」段（本人正面、他人只有张数）；
//   · 卡牌详情里的附属卡带「打出」按钮。
import { test, expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { mkdirSync } from 'node:fs'

const output = 'artifacts/cards-under/'
mkdirSync(output, { recursive: true })

const CARD_CODES = ['03264', '04037', '05013', '01016', '01025', '01054']

function cardDef(code) {
  const def = ALL_CARDS[code]
  if (!def) throw new Error('卡面数据缺失：' + code)
  return { ...def, code, name: def.nameZh || def.name, nameEn: def.name }
}

async function fixture(page) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'cards-under' } }) })
    const body = await response.json()
    session = body.session
    const s = session.state
    s.pendingChoice = null
    s.currentSeat = 0
    s.phase = 'investigation'
    s.enemies = []
    s.locations = ['hallway', 'attic', 'cellar', 'parlor'].map(id => ({ ...scenario.locations[id], revealed: true, clues: id === 'cellar' ? 2 : 0, maxClues: 2 }))
    for (const code of CARD_CODES) s.cards[code] = cardDef(code)
    const inv = s.investigators[0]
    inv.location = 'hallway'
    inv.hand = []
    inv.resources = 9
    inv.actionsLeft = 3
    // 桌上：原定计划（附属 1 张）、背包（附属 1 张）、银暮匕首（beneath 通道）。
    inv.assets = [
      { id: 'plan', code: '03264', exhausted: false, attached: ['01016'] },
      { id: 'bag', code: '04037', exhausted: false, attachedCards: ['01025'] },
      { id: 'knife', code: '05013', exhausted: false },
    ]
    // 压在她底下的两张事件 + 直觉牌库（7 张，本阶段揭示了 1 张）。
    inv.beneath = ['01016', '01025']
    inv.beneathCount = 2
    s.hunch = [{ seat: 0, deck: 7, revealed: '01054' }]
    s.legalMoves = [
      { action: 'play', cardId: '01016', fromPlanAssetId: 'plan', label: '🃏 原定计划：打出「应急物资」' },
      { action: 'play', cardId: '01025', fromBackpackId: 'bag', label: '🎒 从背包打出「急救」' },
      { action: 'play', cardId: '01016', fromBeneath: true, channelAssetId: 'knife', label: '🕯️ 从底下打出「应急物资」' },
      { action: 'play', cardId: '01054', fromHunch: true, label: '🔮 从直觉牌库打出「熟练专注」' },
    ]
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '跳过演出' }).click()
  return { session }
}

test('压在卡下面/附属在卡上的牌：看得见、打得出、桌面与移动都不溢出', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await fixture(page)

  // 1. 牌桌上出现「下方」与「直觉」两行。
  const beneathRow = page.locator('.ah-beneath-row')
  await expect(beneathRow).toHaveCount(1)
  await expect(beneathRow).toHaveAttribute('data-beneath-count', '2')
  await expect(beneathRow).toHaveAttribute('aria-label', '压在调查员底下的牌，共 2 张')
  await expect(beneathRow.locator('.ah-minicard')).toHaveCount(2)
  await expect(page.locator('.ah-hunch-row')).toHaveAttribute('data-hunch-deck', '7')
  await expect(page.locator('.ah-hunch-row .ah-minicard')).toHaveCount(1)

  // 2. 点「下方的牌」→ 弹出「从底下打出」（银暮匕首是通道支援）。
  await beneathRow.locator('.ah-minicard').first().click()
  const popover = page.locator('.ah-card-action-popover')
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('button', { name: /从底下打出/ })).toHaveCount(1)
  await page.keyboard.press('Escape')

  // 3. 点直觉牌库揭示的那张 → 弹出「从直觉牌库打出」。
  await page.locator('.ah-hunch-row .ah-minicard').click()
  await expect(popover.getByRole('button', { name: /从直觉牌库打出/ })).toHaveCount(1)
  await page.keyboard.press('Escape')

  // 4. 点桌上的原定计划 → 弹出「原定计划：打出」。
  await page.locator('[data-interaction="asset:plan"]').click()
  await expect(page.locator('.ah-card-action-popover').getByRole('button', { name: /原定计划：打出/ })).toHaveCount(1)
  await page.keyboard.press('Escape')

  // 5. 右键原定计划 → 详情里的附属卡带「打出」按钮。
  await page.locator('[data-interaction="asset:plan"]').click({ button: 'right' })
  const modal = page.locator('.ah-carddetail-modal')
  await expect(modal).toBeVisible()
  await expect(modal.locator('.ah-detail-attachment-row')).toHaveCount(1)
  await expect(modal.locator('[data-attachment-play="01016"]')).toHaveText('打出')
  await page.locator('.ah-carddetail-close').click()

  // 6. 调查员详情有「下方卡牌（2）」，并列出两张卡的卡面按钮。
  await page.locator('.ah-dock-name').click()
  await expect(page.locator('.ah-runtime-card-state .ah-detail-beneath h4')).toHaveText('下方卡牌（2）')
  await expect(page.locator('.ah-runtime-card-state .ah-detail-beneath-card')).toHaveCount(2)
  await page.screenshot({ path: output + 'detail-beneath.png', animations: 'disabled' })
  await page.locator('.ah-carddetail-close').click()

  await page.screenshot({ path: output + 'table-1440.png', animations: 'disabled' })

  // 7. 移动 390：不横向溢出，两行仍在视口内。
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: output + 'table-390.png', animations: 'disabled' })
  await expect(page.locator('.ah-beneath-row')).toBeInViewport()
  await expect(page.locator('.ah-hunch-row')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  expect(errors).toEqual([])
})
