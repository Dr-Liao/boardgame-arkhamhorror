import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §3：阶段截图放在仓库根目录 artifacts/，不进入游戏运行目录。
const output = fileURLToPath(new URL('../../../artifacts/tfa-supplies/', import.meta.url))
mkdirSync(output, { recursive: true })

// 真实的大厅流程：失落的时代 → 选调查员 → 开始第一关。序幕先选远征求领队，
// 随后进入补给品选购；这里不再造假会话，因此同时校验观察投影下发的单价与清单。
async function enterForgottenAgePrologue(page, width, height) {
  await page.setViewportSize({ width, height })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByRole('combobox', { name: '战役' }).selectOption('theForgottenAge')
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：里奥/ }).click()
  await hub.getByRole('button', { name: /自动构筑/ }).click()
  await hub.getByRole('button', { name: '确认准备', exact: true }).first().click()
  await hub.getByRole('navigation', { name: '战役局外页面' }).getByRole('button', { name: '开始关卡', exact: true }).click()
  await hub.getByRole('button', { name: '开始当前关卡' }).click()
  // 领队选择仍是普通的按钮列表；选完才轮到补给品选购。
  const leader = hub.locator('.ah-hub-pane[aria-label="战役选择"]')
  await expect(leader).toBeVisible()
  await leader.getByRole('button', { name: '里奥·安德森' }).click()
  await expect(hub.locator('.ah-supply-market')).toBeVisible()
  return hub
}

async function buy(page, hub, name, remaining) {
  const card = hub.locator(`.ah-supply-market-grid [data-supply="${name}"]`)
  const request = page.waitForRequest(req => req.url().endsWith('/api/move')
    && req.postDataJSON()?.move?.optionId === name)
  await card.click()
  await request
  await expect(hub.locator('.ah-supply-market-purse b')).toHaveText(String(remaining))
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`序幕补给品按卡牌选取，完成购买与补给选项分开（${label}）`, async ({ page }) => {
    const hub = await enterForgottenAgePrologue(page, width, height)
    const market = hub.locator('.ah-supply-market')
    const grid = market.locator('.ah-supply-market-grid')
    const done = market.locator('[data-supply-done]')

    // 卡面来自序幕清单：11 种补给各一张卡，配给、药品、绳索按点数标价。
    await expect(grid.locator('.ah-supply-market-card')).toHaveCount(11)
    await expect(market.locator('.ah-supply-market-purse b')).toHaveText('10')
    await expect(grid.locator('[data-supply="rope"] .ah-supply-market-cost')).toHaveText('3点')
    await expect(grid.locator('[data-supply="provisions"]')).toContainText('一人份的干粮和水')

    // 结构：完成按钮在独立的完成栏，补给卡只在网格里；网格中不存在 done 按钮。
    const structure = await market.evaluate(node => {
      const doneButton = node.querySelector('[data-supply-done]')
      const cardGrid = node.querySelector('.ah-supply-market-grid')
      return {
        doneInGrid: !!(cardGrid && doneButton && cardGrid.contains(doneButton)),
        doneInSummary: !!(doneButton && doneButton.closest('.ah-supply-market-summary')),
        gridOptions: cardGrid ? [...cardGrid.querySelectorAll('button')].map(button => button.dataset.optionId) : [],
      }
    })
    expect(structure.doneInGrid).toBe(false)
    expect(structure.doneInSummary).toBe(true)
    expect(structure.gridOptions).toEqual(['provisions', 'medicine', 'rope', 'blanket', 'canteen',
      'torches', 'compass', 'map', 'binoculars', 'chalk', 'pendant'])
    await expect(grid.locator('[data-supply-done]')).toHaveCount(0)
    // 初始状态：全部补给都买得起；宽屏时完成栏与卡牌并排，按钮不用滚动就能看到。
    await market.evaluate(node => node.scrollIntoView({ block: 'start' }))
    if (label === 'desktop') await expect(done).toBeInViewport()
    await page.screenshot({ path: `${output}supply-picker-${label}-initial.png`, animations: 'disabled' })

    // 卡牌就是购买入口：点配给立刻提交一次补给选择。
    await buy(page, hub, 'provisions', 9)
    await expect(grid.locator('[data-supply="provisions"] .ah-supply-market-owned')).toHaveText('已带 1')
    if (label === 'desktop') {
      for (const [name, remaining] of [['medicine', 7], ['blanket', 5], ['canteen', 3], ['provisions', 2], ['provisions', 1]]) {
        await buy(page, hub, name, remaining)
      }
    } else {
      for (let remaining = 8; remaining >= 1; remaining--) await buy(page, hub, 'provisions', remaining)
    }

    // 只剩 1 点：需要 2/3 点的补给变成灰卡并写明点数不足，1 点的配给仍可买。
    await expect(market.locator('.ah-supply-market-purse b')).toHaveText('1')
    await expect(grid.locator('[data-supply="rope"]')).toBeDisabled()
    await expect(grid.locator('[data-supply="rope"] .ah-supply-market-locked')).toHaveText('点数不足')
    await expect(grid.locator('[data-supply="medicine"]')).toBeDisabled()
    await expect(grid.locator('[data-supply="provisions"]')).toBeEnabled()
    // 完成按钮与卡牌分开，并且在视口内（窄屏时排在卡牌之后）。
    await expect(done).toHaveText('完成购买')
    await expect(done).toBeEnabled()
    expect(await hub.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await done.scrollIntoViewIfNeeded()
    await expect(done).toBeInViewport()
    await page.screenshot({ path: `${output}supply-picker-${label}.png`, animations: 'disabled' })

    // 完成购买是单独一步：点数不退还，但不再混在补给选项里。
    const finish = page.waitForRequest(req => req.url().endsWith('/api/move')
      && req.postDataJSON()?.move?.optionId === 'done')
    await done.click()
    await finish
    await expect(hub.locator('.ah-supply-market')).toHaveCount(0)
    // 序幕结算完毕后直接进入第一关牌桌（行动演出随后接管，起手换牌排在其后）。
    await expect(page.locator('.ah-table')).toBeVisible()
  })
}
