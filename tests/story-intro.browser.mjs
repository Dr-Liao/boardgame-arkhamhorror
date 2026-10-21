import { test, expect } from '@playwright/test'

// 回归：开局换牌（mulligan）是关卡的第一步，开场「故事导入 → 密谋揭示」必须等换牌结束再播，
// 而且整局只播一次。2026-10 反馈：从战役台面进入关卡时，故事先被事件流播了一遍，
// 换牌结束后补播逻辑又播了一遍。

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

// 换牌结束后的两幕必须依次是故事导入、密谋揭示，之后不再有演出。
async function expectOpeningOnce(page) {
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

test('战役台面进入关卡：换牌后只播一次故事导入', async ({ page }) => {
  const sessionId = await startFreshCampaign(page)
  await enterFirstScenario(page)

  // 换牌阶段不应有任何演出挡在待决选择前面。
  await expect(panel(page)).toHaveAttribute('data-choice-kind', 'mulligan')
  await page.waitForTimeout(800)
  await expect(cinematic(page)).toHaveCount(0)

  // 窄屏同样先给换牌面板。
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel(page)).toBeVisible()
  await expect(cinematic(page)).toHaveCount(0)
  await page.setViewportSize({ width: 1400, height: 950 })

  // 保留起始手牌，结束换牌。
  await panel(page).locator('[data-option-id="done"], [data-option-id="skip"]').first().click()
  await expectOpeningOnce(page)

  // 换牌结束后刷新页面/读档不应重播开场。
  const revision = await page.locator('.ah-table').getAttribute('data-revision')
  await reloadSession(page, sessionId)
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', revision)
  await page.waitForTimeout(1200)
  await expect(cinematic(page)).toHaveCount(0)
})
