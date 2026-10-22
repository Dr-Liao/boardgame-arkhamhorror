import { test, expect } from '@playwright/test'

// 渲染基准：用真实的大厅 + 真实诡镇牌桌，量「整树重绘」的主线程耗时。
// 只做记录与宽松上限（防止灾难性回归），不做逐毫秒断言（CI 机器差异大）。
// 运行：node node_modules/@playwright/test/cli.js test --config games/arkhamhorror/playwright.config.mjs render-perf

const stats = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
  return {
    n: sorted.length,
    p50: +at(0.5).toFixed(2),
    p95: +at(0.95).toFixed(2),
    max: +sorted.at(-1).toFixed(2),
    mean: +(sorted.reduce((sum, value) => sum + value, 0) / sorted.length).toFixed(2),
  }
}

test('渲染基准：同一局面上整树重绘与小改动重绘', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))

  await page.route('**/api/start', async route => {
    const response = await route.fetch({
      postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, seed: 'render-perf' } }),
    })
    await route.fulfill({ response, json: await response.json() })
  })

  await page.goto('/index.html?perf=1')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })

  // 跳过开场演出：按钮可能晚于牌桌出现，且一步只清一层队列，循环到叠层消失为止。
  for (let i = 0; i < 20; i++) {
    if (!(await page.locator('.ah-cinematic').count())) break
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) await skip.first().evaluate(el => el.click()).catch(() => {})
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(800)

  // 让牌桌进入中局：多抽几张牌，节点数与卡图数量更接近真实对局。
  for (let i = 0; i < 14; i++) {
    const draw = page.locator('.ah-actions .ah-action:not(:disabled)').filter({ hasText: /^抽牌$/ })
    if (!(await draw.count())) break
    await draw.first().evaluate(el => el.click())
    await page.waitForTimeout(250)
  }
  const nodes = await page.evaluate(() => document.querySelectorAll('*').length)

  // 工作负载 A：同一份状态反复整树重绘（强制同步布局）。
  const benchA = await page.evaluate(() => window.__HALL_BENCH_RENDER__(20))

  // 工作负载 B：真实小改动（打开/关闭时间线），每次点击触发一次完整 render。
  // 用 element.click() 直接派发，避免演出叠层拦截指针。
  const toggle = page.locator('.ah-timeline-toggle')
  let benchB = []
  if (await toggle.count()) {
    await page.evaluate(() => { window.__HALL_RENDER_MS__.length = 0 })
    for (let i = 0; i < 20; i++) {
      await toggle.first().evaluate(el => el.click())
      await page.waitForTimeout(30)
    }
    benchB = await page.evaluate(() => window.__HALL_RENDER_MS__.slice())
  }

  // 工作负载 C：把 CPU 降速 4 倍，模拟低端机器（真实玩家常见）。
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const benchC = await page.evaluate(() => window.__HALL_BENCH_RENDER__(20))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  const summary = { nodes, benchA: stats(benchA), benchB: benchB.length ? stats(benchB) : null, benchSlow4x: stats(benchC) }
  console.log('RENDER_BASELINE ' + JSON.stringify(summary))
  expect(errors).toEqual([])
  expect(summary.benchA.n).toBe(20)
  // 宽松上限：只拦截数量级退化（正常在 5–40 ms）。
  expect(summary.benchA.p95).toBeLessThan(400)
  if (summary.benchB) expect(summary.benchB.p95).toBeLessThan(400)
  expect(summary.benchSlow4x.p95).toBeLessThan(1200)
})
