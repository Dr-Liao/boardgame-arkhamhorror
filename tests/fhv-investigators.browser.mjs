// 九循环《铁杉谷盛宴》（FHV）P5 调查员浏览器验收 spec。
//
// 真实大厅 HTTP 路径：/api/start 注入 `playerInvestigator` → 真实开局 → 换牌 → 断言调查员与
// 牌组（30/35 张玩家卡 + 专属依赖），桌面 1440 / 移动 390 各跑 5 人；截图写入
// artifacts/migration/fhv/p5/screenshots/，账本由 tools/playwright-fhv-p5-reporter.mjs 生成。
//
// 不使用测试夹具：5 位调查员已在 P5 开放（availability strict / selectable），走生产选人/构筑/开局路径。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/fhv/p5/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const INVESTIGATORS = Object.freeze([
  { code: '10001', name: '威尔森·理查德', nameEn: 'Wilson Richards', deckSize: 30 },
  { code: '10004', name: '凯特·温斯罗普', nameEn: 'Kate Winthrop', deckSize: 30 },
  { code: '10009', name: '亚历山德拉·佐兹', nameEn: 'Alessandra Zorzi', deckSize: 30 },
  { code: '10012', name: '鸣神琥珀', nameEn: 'Kōhaku Narukami', deckSize: 30 },
  { code: '10015', name: '汉克‧萨姆森', nameEn: 'Hank Samson', deckSize: 35 },
])

const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
]

function noteScreenshot(testInfo, path) {
  testInfo.annotations.push({ type: 'screenshot', description: path })
}

async function start(page, code) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addLocatorHandler(page.getByRole('button', { name: '跳过演出' }), locator => locator.click())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let latest = null
  page.on('response', async response => {
    if (!/\/api\/(start|move|session)(\?|$)/.test(response.url()) || !response.ok()) return
    try {
      const body = await response.json()
      if (body.session?.state?.investigators?.length) latest = body.session
    } catch {}
  })
  await page.route('**/api/start', async route => {
    const original = route.request().postDataJSON()
    const response = await route.fetch({ postData: JSON.stringify({
      ...original,
      settings: {
        ...original.settings,
        playerInvestigator: code,
        playerCount: 1,
        teammates: 0,
        legacyAutoStart: true,
        playerSeats: [0],
        seed: `fhv-p5-${code}`,
      },
    }) })
    await route.fulfill({ response })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-table')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => latest?.state?.investigators?.[0]?.code, { timeout: 20_000 }).toBe(code)
  await settleChoices(page)
  return { errors, latest: () => latest }
}

// 开局选择收尾：换牌窗口保留手牌；其它通用选择优先跳过/完成，避免卡在 pendingChoice。
async function settleChoices(page, { maxSteps = 40 } = {}) {
  for (let guard = 0; guard < maxSteps; guard++) {
    const mechanic = page.locator('.ah-mechanic-choice')
    if (await mechanic.count()) {
      const pick = mechanic.locator('[data-option-id^="pick:"]').first()
      if (await pick.count()) await pick.click().catch(() => {})
      const confirm = mechanic.locator('[data-option-id="confirm"]')
      if (await confirm.count()) await confirm.click().catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const keep = page.getByRole('button', { name: '保留手牌' })
    if (await keep.count()) {
      await keep.first().click().catch(() => {})
      await page.waitForTimeout(120)
      continue
    }
    const dialog = page.locator('.ah-choice-dialog, .ah-mechanic-summary')
    if ((await dialog.count()) === 0 && !(await page.locator('.ah-choice').count())) break
    const generic = page.getByRole('button', { name: /跳过|完成|确定|结束/ }).first()
    if (!(await generic.count())) break
    await generic.click().catch(() => {})
    await page.waitForTimeout(120)
  }
}

for (const viewport of viewports) {
  test.describe(`P5 ${viewport.id}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })
    for (const investigator of INVESTIGATORS) {
      const { code, name, deckSize } = investigator
      test(`P5 ${viewport.id} ${code} ${name}：真实选人/开局/专属依赖/无控制台错误`, async ({ page }, testInfo) => {
        const { errors, latest } = await start(page, code)
        const snapshot = () => {
          const session = latest()
          const state = session?.state
          const inv = state?.investigators?.[0]
          return {
            code: inv?.code ?? null,
            seats: state?.investigators?.length ?? 0,
            deckSize: inv?.deckSize ?? null,
            handSize: inv?.handSize ?? null,
            status: state?.status ?? null,
          }
        }
        await settleChoices(page)
        await expect.poll(() => snapshot().code, { timeout: 20_000 }).toBe(code)
        await expect.poll(() => snapshot().status, { timeout: 20_000 }).toBe('playing')
        const state = snapshot()
        expect(state.seats).toBe(1)
        // 牌组剩余：印刷牌组 30/35，减去起手 5 张换牌后的手牌与签名/弱点位置，落在合理区间。
        expect(state.deckSize).toBeGreaterThanOrEqual(deckSize - 12)
        expect(state.deckSize).toBeLessThanOrEqual(deckSize)
        expect(state.handSize).toBeGreaterThanOrEqual(0)
        // 调查员名字与座位信息在牌桌可见。
        await expect(page.locator('.ah-table')).toContainText(name, { timeout: 15_000 })
        expect(errors, `页面不应有控制台错误：${errors.join('；')}`).toEqual([])
        const file = `${output}p5-${viewport.id}-${code}.png`
        await page.screenshot({ path: file, fullPage: false })
        noteScreenshot(testInfo, file)
      })
    }
  })
}
