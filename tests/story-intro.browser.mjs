import { test, expect } from '@playwright/test'

// 回归：进入关卡时先播「故事导入 → 密谋揭示」，两幕读完后才轮到换牌（mulligan），
// 而且整局只播一次。2026-10 反馈：开场被拖到换牌之后，换完手牌才触发导入；
// 这里锁定「先导入、后换牌」，并验证换牌结束后、刷新/读档时都不再重播。

const cinematic = page => page.locator('.ah-cinematic')
const panel = page => page.getByRole('region', { name: '待决选择' })

async function startFreshCampaign(page) {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByText(/玩家人数|席位数量/).locator('..').locator('select').selectOption('1')
  const started = page.waitForResponse('**/api/start')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  return (await (await started).json()).session.sessionId
}

async function enterFirstScenario(page) {
  const hub = page.locator('.ah-hub')
  await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
  await hub.getByRole('button', { name: /选择调查员：罗兰/ }).first().click()
  await hub.getByRole('button', { name: /自动构筑/ }).first().click()
  await hub.getByRole('button', { name: '确认准备', exact: true }).first().click()
  await hub.getByRole('button', { name: '开始当前关卡' }).first().click()
}

// 开场的两幕必须依次是故事导入、密谋揭示；读完后演出层消失。
async function expectOpening(page) {
  const scene = cinematic(page)
  await expect(scene).toHaveAccessibleName('故事导入')
  await expect(scene.locator('.ah-cinematic-detail')).not.toBeEmpty()
  await scene.getByRole('button', { name: '继续', exact: true }).click()
  await expect(scene).toHaveAccessibleName('密谋揭示')
  await expect(scene.locator('.ah-table-art')).toHaveAttribute('data-art-code', /.+/)
  await scene.getByRole('button', { name: '继续', exact: true }).click()
  await expect(scene).toHaveCount(0)
  await page.waitForTimeout(600)
  await expect(scene).toHaveCount(0)
}

async function reloadSession(page, sessionId) {
  await page.reload()
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.locator('.ah-hub-setup')
  await setup.getByRole('button', { name: '存档管理' }).click()
  const saved = setup.locator(`.ah-save-item[data-session-id="${sessionId}"]`)
  await expect(saved).toBeVisible()
  await saved.getByRole('button', { name: '读取此存档' }).click()
}

test('战役台面进入关卡：先播故事导入再换牌，且只播一次', async ({ page }) => {
  const sessionId = await startFreshCampaign(page)
  await enterFirstScenario(page)

  // 换牌已经待决，但开场演出先来：读故事期间待决选择面板不出现。
  await expect(cinematic(page)).toHaveAccessibleName('故事导入')
  await expect(panel(page)).toHaveCount(0)

  // 窄屏同样先读导入，演出不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await cinematic(page).evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.setViewportSize({ width: 1400, height: 950 })

  // 两幕读完才出现换牌面板；换牌期间不重播开场。
  await expectOpening(page)
  await expect(panel(page)).toHaveAttribute('data-choice-kind', 'mulligan')
  await page.waitForTimeout(600)
  await expect(cinematic(page)).toHaveCount(0)

  // 保留起始手牌，结束换牌；换牌后也不再补播开场。
  await panel(page).locator('[data-option-id="done"], [data-option-id="skip"]').first().click()
  await expect(panel(page)).toHaveCount(0)
  await page.waitForTimeout(800)
  await expect(cinematic(page)).toHaveCount(0)

  // 换牌结束后刷新页面/读档不应重播开场。
  const revision = await page.locator('.ah-table').getAttribute('data-revision')
  await reloadSession(page, sessionId)
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', revision)
  await page.waitForTimeout(1200)
  await expect(cinematic(page)).toHaveCount(0)
})
