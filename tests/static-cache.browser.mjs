import { test, expect } from '@playwright/test'

// 卡图 / 混乱标记的缓存策略回归：
// 静态媒体如果仍然 must-revalidate，浏览器每次重新显示同一张卡图都要发一轮复验请求，
// 一屏几十张会排在单线程大厅前面（表现就是「图过一会儿才出来」）。
// 通过标准：同一浏览器缓存里第二次打开同一局，图片全部直接命中本地缓存——
// 有内容（decodedBodySize）但零下行字节（transferSize === 0）。
//
// 注意：不要用 page.route 造开局。Playwright 一旦启用请求拦截就会关掉浏览器 HTTP 缓存，
// 那样这个用例永远量不到缓存命中。这里先用 API 开一局，再让页面从 localStorage 恢复。

const imageEntries = page => page.evaluate(() => performance.getEntriesByType('resource')
  .filter(entry => /\/img\//.test(entry.name))
  .map(entry => ({ name: entry.name, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })))

async function waitForTable(page) {
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  for (let i = 0; i < 20; i++) {
    if (!(await page.locator('.ah-cinematic').count())) break
    const skip = page.getByRole('button', { name: '跳过演出' })
    if (await skip.count()) await skip.first().evaluate(el => el.click()).catch(() => {})
    await page.waitForTimeout(200)
  }
  // 等卡图真的落到牌桌上（避免把「还没请求」当成「命中缓存」）。
  await expect.poll(async () => page.locator('.ah-table-art[data-image-state="displayable"]').count(),
    { timeout: 30_000 }).toBeGreaterThan(0)
}

test('卡图与标记第二次打开时直接命中本地缓存，不再逐张复验', async ({ page, request, baseURL }) => {
  test.setTimeout(120_000)
  const started = await request.post('/api/start', {
    data: { modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, seed: 'static-cache' } },
  })
  expect(started.ok()).toBe(true)
  const sessionId = (await started.json()).session.sessionId
  await page.addInitScript(id => {
    try { localStorage.setItem('boardgame-hall.sessionId', id) } catch {}
  }, sessionId)

  await page.goto('/index.html')
  await waitForTable(page)
  await page.waitForTimeout(1000)

  const first = await imageEntries(page)
  expect(first.length, '第一次打开应当真的请求过图片').toBeGreaterThan(0)
  expect(first.some(entry => entry.transferSize > 0), '第一次打开应当有下行字节').toBe(true)

  await page.reload()
  await waitForTable(page)
  await page.waitForTimeout(1000)

  const second = await imageEntries(page)
  // 排除游戏库封面：牌桌接管界面时它常被中断，本来就不会进缓存，和卡图无关。
  const fromCache = second.filter(entry => entry.decodedBodySize > 1024 && !/\/img\/cover\//.test(entry.name))
  expect(fromCache.length, '第二次打开仍应显示卡图').toBeGreaterThan(0)
  const revalidated = fromCache.filter(entry => entry.transferSize > 0)
  expect(revalidated.map(entry => entry.name), '卡图应当命中缓存，不再发起复验').toEqual([])
})
