// 诡镇接入大厅开局界面的浏览器回归：逐席选择 AI、AI 高级设置、玩家资料在诡镇界面中的显示。
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../lib/server.js'
import { loadMods } from '../../../lib/mods.js'

test('Arkham 开局可逐席选择 AI，人数切换保留选择且实际座位匹配', async ({ page }) => {
  const previousHome = process.env.DSH_HOME
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-setup-ui-'))
  process.env.DSH_HOME = home
  const mods = (await loadMods({ userDir: null })).filter(mod => mod.id === 'arkhamhorror')
  const server = createServer({ mods })
  try {
    await server.ready
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await page.click('.bg-settings-btn')
    await page.locator('.bg-backdrop').click({ position: { x: 1, y: 1 } })
    await expect(page.getByRole('heading', { name: '⚙️ 设置' })).toBeVisible()
    await page.getByRole('button', { name: '👤 玩家', exact: true }).click()
    await page.getByLabel('玩家名称', { exact: true }).fill('星河队长')
    await page.getByLabel('上传玩家头像', { exact: true }).setInputFiles(fileURLToPath(new URL('../../../public/avatars/yuzu.webp', import.meta.url)))
    await expect(page.getByRole('img', { name: '玩家头像预览', exact: true }).locator('img')).toBeVisible()
    await page.getByRole('button', { name: '💾 保存玩家资料', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('已保存')
    await page.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(page.getByRole('button', { name: /图鉴/ })).toHaveCount(0)
    await page.locator('.bg-card').click()
    await page.locator('.bg-backdrop').click({ position: { x: 1, y: 1 } })
    await expect(page.getByRole('dialog', { name: '调查准备设置' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: '诡镇背景音乐' })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: '调查准备设置' })).toHaveAttribute('data-campaign', 'nightOfTheZealot')

    await page.getByRole('button', { name: '修改 AI 高级设置', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'AI 高级设置' })).toBeVisible()
    const routineSpeech = page.getByLabel('日常行动发言频率', { exact: true })
    const selfTestSpeech = page.getByLabel('自身普通检定回应频率', { exact: true })
    const otherTestSpeech = page.getByLabel('其他角色普通检定回应频率', { exact: true })
    const selfCriticalSuccess = page.getByLabel('自身大成功回应频率', { exact: true })
    const otherCriticalSuccess = page.getByLabel('其他角色大成功回应频率', { exact: true })
    const selfCriticalFailure = page.getByLabel('自身大失败回应频率', { exact: true })
    const otherCriticalFailure = page.getByLabel('其他角色大失败回应频率', { exact: true })
    const enemyDefeatSpeech = page.getByLabel('击败敌人回应频率', { exact: true })
    const exitDialogue = page.getByLabel('调查员退出本关时对话', { exact: true })
    const scenarioDialogue = page.getByLabel('关卡结束时对话', { exact: true })
    // 弹窗初始值直接取 Mod 的默认设置：调默认值时不必再改这份用例，也不会和源码漂移。
    const { DEFAULT_AI_DIALOGUE_SETTINGS: AI } = await import('../src/ai/ai-dialogue.js')
    await expect(routineSpeech).toHaveValue(String(AI.routineFrequency))
    await expect(selfTestSpeech).toHaveValue(String(AI.selfTestFrequency))
    await expect(otherTestSpeech).toHaveValue(String(AI.otherTestFrequency))
    await expect(selfCriticalSuccess).toHaveValue(String(AI.selfCriticalSuccessFrequency))
    await expect(otherCriticalSuccess).toHaveValue(String(AI.otherCriticalSuccessFrequency))
    await expect(selfCriticalFailure).toHaveValue(String(AI.selfCriticalFailureFrequency))
    await expect(otherCriticalFailure).toHaveValue(String(AI.otherCriticalFailureFrequency))
    await expect(enemyDefeatSpeech).toHaveValue(String(AI.enemyDefeatFrequency))
    await expect(exitDialogue).toBeChecked({ checked: AI.investigatorExitDialogue })
    await expect(scenarioDialogue).toBeChecked({ checked: AI.scenarioEndDialogue })
    await routineSpeech.fill('0')
    await selfTestSpeech.fill('100')
    await otherTestSpeech.fill('20')
    await selfCriticalSuccess.fill('80')
    await otherCriticalSuccess.fill('60')
    await selfCriticalFailure.fill('70')
    await otherCriticalFailure.fill('40')
    await enemyDefeatSpeech.fill('25')
    await exitDialogue.uncheck()
    await page.getByRole('button', { name: '关闭 AI 高级设置', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'AI 高级设置' })).toHaveCount(0)

    const teammates = page.getByRole('combobox', { name: /^AI 队友/ })
    const count = page.getByRole('combobox', { name: '席位数量' })
    await expect(teammates).toHaveCount(1)
    await expect(teammates.first()).toHaveValue('__random__')
    await expect(teammates.first().locator('option')).toHaveText(['🎲 随机 AI', '花冈柚子', '才羽桃', '才羽绿', '天童爱丽丝', '天童凯伊'])
    await teammates.first().selectOption('ai-hu')
    await count.selectOption('4')
    await expect(teammates).toHaveCount(3)
    await expect(teammates.first()).toHaveValue('ai-hu')
    await teammates.nth(1).selectOption('ai-mei')
    await teammates.nth(2).selectOption('ai-mo')
    await count.selectOption('1')
    await expect(teammates).toHaveCount(0)
    await count.selectOption('4')
    await expect(teammates.nth(1)).toHaveValue('ai-mei')
    await expect(teammates.nth(2)).toHaveValue('ai-mo')

    const created = page.waitForResponse(response => response.url().endsWith('/api/start'))
    await page.getByRole('button', { name: '开始新游戏' }).click()
    const result = await (await created).json()
    expect(result.ok, result.error).toBe(true)
    expect(result.session.settings).toMatchObject({
      aiRoutineSpeechFrequency: 0,
      aiSelfTestSpeechFrequency: 100,
      aiOtherTestSpeechFrequency: 20,
      aiSelfCriticalSuccessSpeechFrequency: 80,
      aiOtherCriticalSuccessSpeechFrequency: 60,
      aiSelfCriticalFailureSpeechFrequency: 70,
      aiOtherCriticalFailureSpeechFrequency: 40,
      aiEnemyDefeatSpeechFrequency: 25,
      aiInvestigatorExitDialogue: 'off',
      aiScenarioEndDialogue: 'on',
    })
    expect(result.session.players.slice(1).map(player => player.aiId)).toEqual(['ai-hu', 'ai-mei', 'ai-mo'])
    expect(result.session.players.slice(1).map(player => player.name)).toEqual(['才羽绿', '天童爱丽丝', '花冈柚子'])
    expect(result.session.players[0].name).toBe('星河队长')
    await expect(page.getByRole('button', { name: '普通', exact: true })).toBeVisible()
    await expect(page.locator('.ah-office-teammate').first()).toContainText('星河队长')
    await expect(page.locator('[data-player-seat="0"] .ah-office-player-avatar img').first()).toHaveAttribute('src', result.session.players[0].avatar)

    // 图鉴属于游戏内功能，大厅移除入口不影响这里查阅。
    await page.getByRole('button', { name: '全卡图鉴', exact: true }).click()
    const catalog = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
    await expect(catalog).toBeVisible()
    await page.locator('.ah-catalog-backdrop').click({ position: { x: 1, y: 1 } })
    await expect(catalog).toBeVisible()
    await expect(catalog.getByRole('status').first()).toContainText('找到')
    await page.getByRole('button', { name: '关闭图鉴' }).click()

    // 回到大厅，再确认缩减人数后隐藏的选择不会生成多余座位。
    await page.getByRole('button', { name: '退出', exact: true }).click()
    await expect(page.getByRole('button', { name: /图鉴/ })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: '诡镇背景音乐' })).toHaveCount(0)
    await page.locator('.bg-card').click()
    await count.selectOption('1')
    const soloCreated = page.waitForResponse(response => response.url().endsWith('/api/start'))
    await page.getByRole('button', { name: '开始新游戏' }).click()
    const solo = await (await soloCreated).json()
    expect(solo.ok, solo.error).toBe(true)
    expect(solo.session.players).toHaveLength(1)

    // 玩家头像也要出现在关卡内的调查员面板上（原图 256px，不被缩放失真）。
    const scenario = await (await page.request.post(origin + '/api/start', { data: { modId: 'arkhamhorror',
      settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'avatar-test' } } })).json()
    expect(scenario.ok, scenario.error).toBe(true)
    await page.evaluate(id => localStorage.setItem('boardgame-hall.sessionId', id), scenario.session.sessionId)
    await page.reload()
    await page.getByRole('button', { name: '跳过演出' }).click()
    const dockAvatar = page.locator('.ah-dock-kicker .ah-player-avatar')
    await expect(dockAvatar).toHaveAttribute('src', result.session.players[0].avatar)
    await expect(dockAvatar).toBeVisible()
    await expect.poll(() => dockAvatar.evaluate(el => el.naturalWidth)).toBe(256)
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
