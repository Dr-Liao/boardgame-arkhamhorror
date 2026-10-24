// 诡镇奇谈 Mod 界面本地化的浏览器冒烟（docs/localization.md §8.3 / §8.7 第三步验收）：
//   1. 大厅语言为 English 时，目录卡片、Mod 开局弹窗、战役 hub 的页签都显示英文；
//   2. 游戏内调用大厅语言切换（host.onLocaleChange）后，Mod 就地重绘为中文，不刷新页面、不重置对局；
//   3. 再切回 English 仍然生效；全程无页面运行时错误。
//
// 说明：这一轮只覆盖"语言是否正确流入 Mod"，不逐条断言所有长尾文案；文案完整性由
// tests/i18n-dict.test.mjs 与各模块的词典守卫负责。
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'
import en from '../web/locales/en.js'
import zh from '../web/locales/zh-CN.js'

test('Arkham 界面跟随大厅语言，游戏内切换即时重绘且不重置对局', async ({ page }) => {
  const previousHome = process.env.DSH_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-i18n-'))
  process.env.DSH_HOME = home
  const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
  const server = createServer({ mods })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  try {
    await server.ready
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`

    // 大厅偏好切到 English（写入临时 DSH_HOME，对应 settings.json）。
    const saved = await page.request.post(origin + '/api/settings', { data: { locale: 'en' } })
    expect((await saved.json()).ok).toBe(true)

    await page.goto(origin)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    // 目录名称由大厅按语言本地化（index.js 的 i18n.messages.en），不是拼音/中文。
    await expect(page.locator('.bg-card-name').first()).toHaveText('Arkham Horror: The Card Game')

    // 开局弹窗由 Mod 自己渲染：标题/按钮应来自 Mod 词典的英文。
    await page.locator('.bg-card').click()
    const setup = page.locator('.ah-hub-setup[role="dialog"]')
    await expect(setup).toBeVisible()
    await expect(setup).toHaveAttribute('aria-label', en['hub.setup.dialogAria'])
    await expect(setup.locator('.bg-modal-foot .bg-btn').last()).toHaveText(en['hub.setup.start'])

    // 从弹窗开局；开始后进入战役 hub（Mod 自己渲染的页面）。
    const started = page.waitForResponse(response => response.url().endsWith('/api/start'))
    await setup.locator('.bg-modal-foot .bg-btn').last().click()
    const startedBody = await (await started).json()
    expect(startedBody.ok, startedBody.error).toBe(true)
    const sessionId = startedBody.session.sessionId

    // 战役 hub 页签是 core 词典里的主路径文案（之前已本地化），这里验证英文确实进了 Mod。
    await expect(page.getByRole('button', { name: en['hub.tab.overview'], exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: zh['hub.tab.overview'], exact: true })).toHaveCount(0)

    // 游戏内切换语言：走大厅设置页同一条保存链路（app.js 导出的 saveLocale），
    // 验证 host.onLocaleChange → Mod setLocale + 重绘，而不是整页刷新。
    await page.evaluate(async () => { (await import('/app.js')).saveLocale('zh-CN') })
    await expect(page.getByRole('button', { name: zh['hub.tab.overview'], exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: en['hub.tab.overview'], exact: true })).toHaveCount(0)

    // 对局没有被重置：会话仍存在且编号不变。
    const session = await (await page.request.get(origin + '/api/session?sessionId=' + encodeURIComponent(sessionId))).json()
    expect(session.ok, session.error).toBe(true)
    expect(session.session.sessionId).toBe(sessionId)

    // 再切回 English：仍然生效。
    await page.evaluate(async () => { (await import('/app.js')).saveLocale('en') })
    await expect(page.getByRole('button', { name: en['hub.tab.overview'], exact: true })).toBeVisible()

    expect(errors).toEqual([])
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (!path.resolve(home).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unexpected test directory')
    fs.rmSync(home, { recursive: true, force: true })
  }
})
