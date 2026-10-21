import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 迁移规范 §4.5.1：幕/密谋卡面上的行动必须显示在剧本书对应卡片旁。
// 这条用例走真实大厅流程进入《失落的时代》第一关，验证「探索」印在密谋 04044 上、
// 因此出现在密谋卡右侧的剧本行动里，而不是掉进通用动作栏；桌面 1440 与移动 390 各一次。
const output = fileURLToPath(new URL('../../../artifacts/script-actions-tfa/', import.meta.url))
mkdirSync(output, { recursive: true })

async function enterUntamedWilds(page) {
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
  // 序幕：先选远征求领队，再花完/跳过补给品点数。
  await hub.locator('.ah-hub-pane[aria-label="战役选择"]').getByRole('button', { name: '里奥·安德森' }).click()
  const market = hub.locator('.ah-supply-market')
  await expect(market).toBeVisible()
  await market.locator('[data-supply-done]').click()
  await expect(page.locator('.ah-table')).toBeVisible()
  // 开场「故事导入 → 密谋揭示」先于换牌到达：先跳过演出，再结束换牌。
  const opening = page.getByRole('button', { name: '跳过演出' })
  for (let guard = 0; guard < 6 && await opening.count(); guard++) {
    await opening.first().click()
    await page.waitForTimeout(300)
  }
  const choice = page.getByRole('region', { name: '待决选择' })
  await expect(choice).toHaveAttribute('data-choice-kind', 'mulligan', { timeout: 15_000 })
  await choice.locator('[data-option-id="done"]').first().click()
  await expect(page.locator('[data-choice-kind="mulligan"]')).toHaveCount(0)
  // 开局反应窗口与后续演出都是异步到达的：按出现顺序跳过/回答，直到桌面上没有
  // 新的演出或待决选择。反应（如里奥的免费盟友）不影响本用例，一律「跳过反应」；
  // 若神话阶段拉出检定，按默认「开始检定」结算。
  let idle = 0
  for (let guard = 0; guard < 30 && idle < 3; guard++) {
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) { idle = 0; await skip.first().click(); await page.waitForTimeout(300); continue }
    const next = page.locator('.ah-cinematic').getByRole('button', { name: '继续', exact: true })
    if (await next.count()) { idle = 0; await next.first().click(); await page.waitForTimeout(300); continue }
    const pending = page.locator('.ah-choice').first()
    if (await pending.count()) {
      const kind = await pending.getAttribute('data-choice-kind')
      const pass = pending.locator('[data-option-id="skip"]:not([disabled]), [data-option-id="done"]:not([disabled])').first()
      if (kind === 'turnOrder') {
        idle = 0
        await pending.getByRole('button', { name: '开始行动', exact: true }).first().click()
      } else if (await pass.count()) {
        idle = 0
        await pass.click()
      } else {
        const option = pending.locator('button:not([disabled])').first()
        if (!(await option.count())) { idle += 1; await page.waitForTimeout(300); continue }
        idle = 0
        await option.click()
      }
      await page.waitForTimeout(300)
      continue
    }
    idle += 1
    await page.waitForTimeout(300)
  }
  await expect(choice).toHaveCount(0)
  await expect(page.locator('.ah-story-book')).toBeVisible()
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`剧本行动归属：失落的时代探索显示在密谋卡旁（${label}）`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    let submitted = null
    page.on('request', req => {
      if (req.url().endsWith('/api/move')) submitted = req.postDataJSON()?.move
    })
    await enterUntamedWilds(page)

    const panel = page.getByRole('group', { name: '剧本可执行操作' })
    await expect(panel).toBeVisible()
    const explore = panel.getByRole('button', { name: /^密谋：探索/ })
    await expect(explore).toBeEnabled()
    await expect(explore).toContainText('密谋')
    // 只有密谋 04044 印着探索；当前幕 04046 只有目标，不应出现「场景：探索」。
    await expect(panel.getByRole('button', { name: /^场景：探索/ })).toHaveCount(0)
    // 密谋卡本身发光并可点开行动。
    await expect(page.locator('.ah-script-card[data-interaction="agenda:current"]')).toHaveClass(/ah-card-ready/)
    await expect(page.locator('.ah-script-card[data-interaction="act:current"]')).not.toHaveClass(/ah-card-ready/)

    // 剧本区从左到右：剧本书 →（提示卡）→ 剧本行动；行动仍在视口内。
    // 《失落的时代》目前没有登记剧本提示卡（SCENARIO_REFERENCE），所以提示卡是可选的。
    const book = await page.locator('.ah-story-book').boundingBox()
    const actions = await page.locator('.ah-script-actions').boundingBox()
    const reference = page.locator('.ah-reference-card')
    if (await reference.count()) {
      const box = await reference.boundingBox()
      expect(book.x + book.width).toBeLessThanOrEqual(box.x + 1)
      expect(box.x + box.width).toBeLessThanOrEqual(actions.x + 1)
    } else {
      expect(book.x + book.width).toBeLessThanOrEqual(actions.x + 1)
    }
    await expect(explore).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${output}script-actions-tfa-${label}.png`, animations: 'disabled' })

    // 点击后提交服务端公开的 explore 行动，而不是前端拼一个本地动作。
    await explore.click()
    await expect.poll(() => submitted?.action).toBe('explore')
  })
}
