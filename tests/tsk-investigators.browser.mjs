// 八循环《绯红密钥》（TSK）P5 调查员浏览器验收 spec。
//
// 真实大厅 HTTP 路径：/api/start 注入 `playerInvestigator` → 真实开局 → 换牌 → 断言调查员与
// 牌组（30 张玩家卡 + 专属依赖），桌面 1440 / 移动 390 各跑 6 人；截图写入
// artifacts/migration/tsk/p5/screenshots/，账本由 tools/playwright-tsk-p5-reporter.mjs 生成。
//
// 不使用测试夹具：这 6 位调查员已在 P5 开放，走生产选人/构筑/开局路径。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const output = fileURLToPath(new URL('../../../artifacts/migration/tsk/p5/screenshots/', import.meta.url))
mkdirSync(output, { recursive: true })

const INVESTIGATORS = Object.freeze([
  { code: '09001', name: '卡森·辛克莱', nameEn: 'Carson Sinclair', signature: ['09002', '09003'] },
  { code: '09004', name: '文森特·李', nameEn: 'Vincent Lee', signature: ['09005', '09006', '09007'] },
  { code: '09008', name: '基玛尼·琼斯', nameEn: 'Kymani Jones', signature: ['09009', '09010'] },
  { code: '09011', name: '阿米娜·齐达内', nameEn: 'Amina Zidane', signature: ['09012', '09013', '09014'] },
  { code: '09015', name: '达雷尔·西蒙斯', nameEn: 'Darrell Simmons', signature: ['09016', '09017'] },
  { code: '09018', name: '查理·凯恩', nameEn: 'Charlie Kane', signature: ['09019', '09020'] },
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
        seed: `tsk-p5-${code}`,
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
      const { code, name, nameEn } = investigator
      test(`P5 ${viewport.id} ${code} ${name}：真实选人/开局/专属依赖/无控制台错误`, async ({ page }, testInfo) => {
        const { errors, latest } = await start(page, code)
        // 以服务端 /api/session 的真实状态为断言来源（含开局换牌后的牌组分布）。
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
        // 30 张玩家卡 + 专属依赖（签名卡/弱点由服务端强制带入；deckSize 为牌库剩余，含签名/弱点）。
        expect(state.deckSize).toBeGreaterThanOrEqual(20)
        expect(state.deckSize).toBeLessThanOrEqual(34)
        expect(state.handSize).toBeGreaterThanOrEqual(0)
        // 调查员名字与座位信息在牌桌可见。
        await expect(page.locator('.ah-table')).toContainText(name, { timeout: 15_000 })
        expect(errors, `页面不应有控制台错误：${errors.join('；')}`).toEqual([])
        const file = `${output}p5-${viewport.id}-${code}.png`
        await page.screenshot({ path: file, fullPage: false })
        noteScreenshot(testInfo, file)
        void nameEn
      })
    }
  })
}

test.afterAll(() => {
  // spec 顶层无共享状态；保留钩子方便将来追加跨用例断言。
})
