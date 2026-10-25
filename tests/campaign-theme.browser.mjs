import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish', import.meta.url))
mkdirSync(output, { recursive: true })
const shot = name => path.join(output, name)

const STORY = {
  id: 'intro:tcu', kind: 'intro', scenarioId: 'disappearanceAtTheTwilightEstate',
  title: '万象无终·暮色庄园失踪事件',
  sections: [{
    title: '万象无终·暮色庄园失踪事件',
    paragraphs: [
      '1925年11月22日，星期天，马萨诸塞州阿卡姆。',
      '虽然万圣节已经过去了接近一个月，但整座小镇里仍有著一种可怖的阴郁。每天早晨，街道上弥漫著浓雾。',
    ],
  }],
  paragraphs: ['旧格式也没有被丢弃。'],
}
const PREVIOUS_STORY = {
  id: 'intro:previous', kind: 'intro', scenarioId: 'disappearanceAtTheTwilightEstate',
  title: '万象无终·序章', paragraphs: ['更早的一则记录。'],
}

async function startTcu(page, mutate) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { playerCount: 2, campaignId: 'theCircleUndone', seed: 'campaign-theme' } }) })
    const body = await response.json()
    session = body.session
    mutate(session)
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-hub')).toBeVisible()
  return page.locator('.ah-hub')
}

const preparedRecord = inv => ({ code: inv.code, status: 'active', deckSize: 33 })

test('调查纪事：章节列表跟随战役配色，羊皮纸文字保持纯黑', async ({ page }) => {
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'scenarioSetup'
    st.phase = 'scenarioSetup'
    st.hubSelectedScenarioId = 'disappearanceAtTheTwilightEstate'
    st.campaignStory = { currentId: STORY.id, entries: [PREVIOUS_STORY, STORY] }
    st.legalMoves = []
  })
  await hub.getByRole('button', { name: '调查纪事', exact: true }).click()
  const story = hub.getByRole('region', { name: '战役故事' })
  await expect(story.locator('.ah-story-page h1')).toHaveText(STORY.title)
  await expect(story.locator('.ah-story-page h2')).toHaveText(STORY.sections[0].title)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-story.png'), animations: 'disabled' })
  const styles = await hub.evaluate(el => {
    const pick = selector => {
      const style = getComputedStyle(el.querySelector(selector))
      return { background: style.backgroundColor, border: style.borderTopColor, color: style.color }
    }
    return {
      accent: getComputedStyle(el).getPropertyValue('--ah-theme-accent').trim(),
      nav: pick('.ah-story-layout > nav button[aria-current]'),
      navIdle: pick('.ah-story-layout > nav button:not([aria-current])'),
      heading: pick('.ah-story-page h2'),
      prose: getComputedStyle(el.querySelector('.ah-story-prose')).color,
    }
  })
  expect(styles.accent).toBe('#c7b6d6')
  // 章节列表使用当前战役的紫色面板与点缀，而不是基础包的墨绿+黄铜。
  expect(styles.nav.background).not.toBe('rgb(48, 67, 52)')
  expect(styles.nav.border).not.toBe('rgb(208, 183, 118)')
  expect(styles.nav.color).toBe('rgb(231, 213, 239)')
  expect(styles.navIdle.background).not.toBe('rgb(11, 28, 22)')
  expect(styles.navIdle.color).toBe('rgb(173, 163, 184)')
  // 羊皮纸上的标题与正文是纸上墨色（纯黑），不再吃 UI 强调色。
  expect(styles.heading.color).toBe('rgb(0, 0, 0)')
  expect(styles.prose).toBe('rgb(0, 0, 0)')
})

test('出发页：队长卡与准备提示跟随战役配色', async ({ page }) => {
  let releaseMove
  const moveGate = new Promise(resolve => { releaseMove = resolve })
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'scenarioSetup'
    st.phase = 'scenarioSetup'
    st.hubFlow = true
    st.hubSelectedScenarioId = 'disappearanceAtTheTwilightEstate'
    st.hubReady = false
    st.hubSeatSelected = { 0: true }
    st.hubSeatDone = { 1: true }
    for (const inv of st.investigators) st.campaign.investigators[inv.seat] = preparedRecord(inv)
    st.campaign.leadSeat = 0
    st.campaign.leadConfirmed = true
    st.legalMoves = [{ action: 'hubDoneSeat', label: '确认准备' }]
  })
  await page.route('**/api/move', async route => {
    const response = await route.fetch()
    await moveGate
    await route.fulfill({ response })
  })
  // 出发准备页的队长选择：选中态应当用战役紫色，不再是基础包的墨绿。
  await hub.getByRole('button', { name: '开始关卡', exact: true }).click()
  const picker = hub.getByRole('region', { name: '选择队长' })
  await expect(picker.locator('button[aria-pressed="true"]')).toHaveCount(1)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-leader.png'), animations: 'disabled' })
  const leader = await picker.locator('button[aria-pressed="true"]').evaluate(el => {
    const style = getComputedStyle(el)
    return { background: style.backgroundColor, border: style.borderTopColor, label: el.querySelector('b') ? getComputedStyle(el.querySelector('b')).color : null }
  })
  expect(leader.background).not.toBe('rgb(48, 66, 51)')
  expect(leader.border).not.toBe('rgb(214, 189, 117)')
  expect(leader.label).toBe('rgb(231, 213, 239)')
  // 准备进度提示条同样跟随战役面板；挂起的 hubDoneSeat 会先显示提示再完成。
  await hub.getByRole('button', { name: '战役总览', exact: true }).click()
  await hub.getByRole('button', { name: '确认准备', exact: true }).click()
  const notice = hub.locator('.ah-hub-preparing')
  await expect(notice).toBeVisible()
  await page.screenshot({ path: shot('campaign-theme-preparing.png'), animations: 'disabled' })
  const noticeStyle = await notice.evaluate(el => {
    const style = getComputedStyle(el)
    return { background: style.backgroundColor, border: style.borderTopColor, color: style.color, small: getComputedStyle(el.querySelector('small')).color }
  })
  expect(noticeStyle.background).not.toBe('rgb(39, 59, 41)')
  expect(noticeStyle.border).not.toBe('rgba(189, 162, 103, 0.4)')
  expect(noticeStyle.small).toBe('rgb(173, 163, 184)')
  releaseMove()
  await expect(notice).toHaveCount(0)
})

test('幕间纪事的羊皮纸文字同样保持纯黑', async ({ page }) => {
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'interlude'
    st.phase = 'interlude'
    st.campaign.flow = { ...(st.campaign.flow || {}), nodeId: 'interludeOne' }
    st.campaignStory = {
      currentId: 'interlude:one',
      entries: [{
        id: 'interlude:one', nodeId: 'interludeOne', kind: 'interlude',
        title: '幕间：进步的价格',
        paragraphs: ['你们回到了阿卡姆，收起了这一段调查里留下的伤痕。'],
      }],
    }
    st.legalMoves = []
  })
  const briefing = hub.locator('.ah-hub-interlude')
  await expect(briefing).toBeVisible()
  await expect(briefing.locator('h2')).toHaveText('幕间：进步的价格')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-interlude.png'), animations: 'disabled' })
  const styles = await briefing.evaluate(el => ({
    heading: getComputedStyle(el.querySelector('h2')).color,
    prose: getComputedStyle(el.querySelector('.ah-hub-interlude-prose')).color,
  }))
  expect(styles.heading).toBe('rgb(0, 0, 0)')
  expect(styles.prose).toBe('rgb(0, 0, 0)')
})

async function startTable(page) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'campaign-theme-table' } }) })
    const body = await response.json()
    session = body.session
    const st = session.state
    st.pendingChoice = null
    st.currentSeat = 0
    st.phase = 'investigation'
    st.legalMoves = []
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    session.state.revision++
    session.state.pendingChoice = null
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '跳过演出' }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
  return {
    async update(change) {
      change(session.state)
      session.state.revision++
      const skip = page.getByRole('button', { name: '跳过演出' })
      if (await skip.count()) await skip.first().click()
      await page.getByRole('button', { name: '刷新局势' }).click()
      await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(session.state.revision))
    },
  }
}

test('牌桌行动提示条跟随战役配色', async ({ page }) => {
  const table = await startTable(page)
  // 直接切换战役色板，避免为一条提示条走完整序章流程。
  await table.update(st => {
    st.campaign.id = 'theCircleUndone'
    st.pendingChoice = {
      id: 'turn-order', kind: 'turnOrder', seat: 0,
      prompt: '点击开始行动。队长也可以让一名尚未行动的 AI 队友先行动。',
      options: [{ id: '0', label: '开始行动' }],
    }
    st.legalMoves = [{ action: 'choose', choiceId: 'turn-order', optionId: '0', label: '开始行动' }]
  })
  const prompt = page.locator('.ah-choice.ah-direct-prompt')
  await expect(prompt).toBeVisible()
  await expect(prompt.locator('.ah-direct-instruction strong')).toHaveText('准备开始行动')
  await expect(prompt.locator('.ah-direct-instruction .ah-choice-prompt')).toContainText('点击开始行动')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-table-prompt.png'), animations: 'disabled' })
  const styles = await prompt.evaluate(el => {
    const style = getComputedStyle(el)
    return {
      accent: getComputedStyle(document.querySelector('.ah-table')).getPropertyValue('--ah-theme-accent').trim(),
      background: style.backgroundImage,
      border: style.borderTopColor,
      heading: getComputedStyle(el.querySelector('.ah-direct-instruction strong')).color,
      note: getComputedStyle(el.querySelector('.ah-choice-prompt')).color,
    }
  })
  expect(styles.accent).toBe('#c7b6d6')
  // 固定绿底（#18332c/#0b201b/#162b25）不再出现，改为战役面板渐变。
  expect(styles.background).not.toContain('rgb(24, 51, 44)')
  expect(styles.background).not.toContain('rgb(11, 32, 27)')
  expect(styles.heading).toBe('rgb(231, 213, 239)')
  expect(styles.note).toBe('rgb(173, 163, 184)')
})

test('卡组页「牌组已保存」提示条跟随战役配色', async ({ page }) => {
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'scenarioSetup'
    st.phase = 'scenarioSetup'
    st.hubSelectedScenarioId = 'disappearanceAtTheTwilightEstate'
    st.hubSeatSelected = { 0: true }
    const cards = ['01087', '01088', '01025', '01023']
    for (const inv of st.investigators) {
      st.campaign.investigators[inv.seat] = {
        ...preparedRecord(inv),
        deck: Array.from({ length: 33 }, (_, index) => cards[index % cards.length]),
      }
    }
    st.legalMoves = [{ action: 'hubDoneSeat', label: '确认准备' }]
  })
  await hub.getByRole('button', { name: '卡组构筑', exact: true }).click()
  const banner = hub.locator('.ah-deck-next-action')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('牌组已保存')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-deck-saved.png'), animations: 'disabled' })
  const styles = await banner.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    border: getComputedStyle(el).borderTopColor,
    heading: getComputedStyle(el.querySelector('strong')).color,
    note: getComputedStyle(el.querySelector('small')).color,
  }))
  expect(styles.background).not.toBe('rgb(36, 59, 42)')
  expect(styles.heading).toBe('rgb(231, 213, 239)')
  expect(styles.note).toBe('rgb(173, 163, 184)')
  // 已保存牌组的预览卡框与张数角标也跟随战役配色。
  const frame = hub.locator('.ah-office-deck-gallery > .ah-deck-inspect').first()
  await expect(frame).toBeVisible()
  const card = await frame.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    border: getComputedStyle(el).borderTopColor,
    color: getComputedStyle(el).color,
    badge: getComputedStyle(el.querySelector('.ah-deck-copy-count')).backgroundColor,
    badgeColor: getComputedStyle(el.querySelector('.ah-deck-copy-count')).color,
  }))
  expect(card.background).not.toBe('rgb(11, 31, 24)')
  expect(card.color).toBe('rgb(199, 182, 214)')
  expect(card.badge).not.toBe('rgba(10, 27, 21, 0.93)')
  expect(card.badgeColor).toBe('rgb(231, 213, 239)')
})

test('调查员选择页的职业筛选与候选卡跟随战役配色', async ({ page }) => {
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'scenarioSetup'
    st.phase = 'scenarioSetup'
    st.hubSelectedScenarioId = 'disappearanceAtTheTwilightEstate'
    st.hubReady = false
    st.hubSeatSelected = {}
    st.currentSeat = 0
    st.campaign.scenarioResults = []
    st.legalMoves = ['01001', '01002', '01003', '01004', '01005']
      .map(code => ({ action: 'hubSelectInvestigator', code, label: '选择调查员：' + code }))
  })
  const nav = hub.getByRole('navigation', { name: '战役局外页面' })
  await nav.getByRole('button', { name: '调查员与席位', exact: true }).click()
  const browser = hub.locator('.ah-investigator-browser')
  await expect(browser).toBeVisible()
  const pills = browser.locator('.ah-investigator-class-filter')
  await expect(pills).toHaveCount(6)
  await expect(browser.locator('.ah-office-candidate')).toHaveCount(5)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await browser.scrollIntoViewIfNeeded()
  await browser.screenshot({ path: shot('campaign-theme-investigators.png'), animations: 'disabled' })
  const styles = await browser.evaluate(el => {
    const pick = selector => {
      const style = getComputedStyle(el.querySelector(selector))
      return { background: style.backgroundColor, border: style.borderTopColor, color: style.color }
    }
    return {
      accent: getComputedStyle(el).getPropertyValue('--ah-theme-accent').trim(),
      selected: pick('.ah-investigator-class-filter[aria-pressed="true"]'),
      idle: pick('.ah-investigator-class-filter[aria-pressed="false"]'),
      candidate: pick('.ah-office-candidate'),
      candidateClass: pick('.ah-office-candidate > small'),
      pack: getComputedStyle(el.querySelector('.ah-investigator-pack h4')).color,
      count: getComputedStyle(el.querySelector('.ah-investigator-pack header small')).color,
      shell: getComputedStyle(el).backgroundColor,
    }
  })
  const statusStyle = await hub.locator('.ah-investigator-selection-state').first().evaluate(el => getComputedStyle(el).backgroundColor)
  expect(styles.accent).toBe('#c7b6d6')
  expect(styles.shell).not.toBe('rgba(9, 23, 18, 0.5)')
  expect(statusStyle).not.toBe('rgba(157, 130, 75, 0.07)')
  expect(styles.selected.background).not.toBe('rgb(18, 36, 28)')
  expect(styles.selected.color).toBe('rgb(231, 213, 239)')
  expect(styles.idle.background).not.toBe('rgb(18, 36, 28)')
  expect(styles.candidate.background).not.toBe('rgb(17, 35, 27)')
  expect(styles.candidate.color).toBe('rgb(199, 182, 214)')
  expect(styles.candidateClass.color).toBe('rgb(173, 163, 184)')
  expect(styles.pack).toBe('rgb(199, 182, 214)')
  expect(styles.count).toBe('rgb(173, 163, 184)')
})

test('关卡选择页的战役案件卡跟随战役配色', async ({ page }) => {
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'scenarioSetup'
    st.phase = 'scenarioSetup'
    st.hubSelectedScenarioId = 'disappearanceAtTheTwilightEstate'
    st.hubReady = false
    st.currentSeat = 0
    st.campaign.scenarioResults = []
    st.legalMoves = []
  })
  const nav = hub.getByRole('navigation', { name: '战役局外页面' })
  await nav.getByRole('button', { name: '关卡选择', exact: true }).click()
  const cases = hub.locator('.ah-office-case')
  await expect(cases.first()).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.evaluate(() => document.querySelector('.ah-hub')?.scrollTo(0, 0))
  await page.screenshot({ path: shot('campaign-theme-scenarios.png'), animations: 'disabled' })
  const styles = await cases.first().evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    title: getComputedStyle(el.querySelector('.ah-office-case-copy > strong')).color,
    status: getComputedStyle(el.querySelector('.ah-office-case-copy > span')).color,
    number: getComputedStyle(el.querySelector('.ah-office-case-number')).color,
  }))
  expect(styles.background).not.toBe('rgb(17, 37, 27)')
  expect(styles.title).toBe('rgb(231, 213, 239)')
  expect(styles.status).toBe('rgb(173, 163, 184)')
  expect(styles.number).toBe('rgb(173, 163, 184)')
})

test('升级页「不进行升级」提示条跟随战役配色', async ({ page }) => {
  const hub = await startTcu(page, session => {
    const st = session.state
    st.uiState = 'interlude'
    st.phase = 'interlude'
    st.hubFlow = true
    st.pendingChoice = null
    st.currentSeat = 0
    st.hubReady = false
    st.campaign.scenarioResults = []
    for (const inv of st.investigators) {
      st.campaign.investigators[inv.seat] = { code: inv.code, status: 'active', deck: ['01087'], deckSize: 33, xp: 0 }
    }
    st.legalMoves = [{ action: 'hubDoneSeat', label: '保留 0 XP 并继续' }]
  })
  const nav = hub.getByRole('navigation', { name: '战役局外页面' })
  await nav.getByRole('button', { name: '升级', exact: true }).click()
  const strip = hub.locator('.ah-upgrade-actions')
  await expect(strip).toBeVisible()
  await expect(strip).toContainText('不进行升级')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await strip.scrollIntoViewIfNeeded()
  await page.screenshot({ path: shot('campaign-theme-upgrade-actions.png'), animations: 'disabled' })
  const styles = await strip.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    border: getComputedStyle(el).borderTopColor,
    heading: getComputedStyle(el.querySelector('strong')).color,
    note: getComputedStyle(el.querySelector('small')).color,
  }))
  expect(styles.background).not.toBe('rgb(13, 30, 23)')
  expect(styles.border).not.toBe('rgba(157, 141, 93, 0.32)')
  expect(styles.heading).toBe('rgb(231, 213, 239)')
  expect(styles.note).toBe('rgb(173, 163, 184)')
})

test('牌桌角色座位、时间线与音乐盒跟随战役配色', async ({ page }) => {
  const table = await startTable(page)
  await table.update(st => {
    st.campaign.id = 'theCircleUndone'
    st.currentSeat = 0
    st.pendingChoice = null
    st.legalMoves = []
    st.events = [{ seq: 1, type: 'info', text: '测试记录：调查员进入了书房。' }]
  })
  await expect(page.locator('.ah-table')).toBeVisible()
  const seat = page.locator('.ah-roster-member.is-active').first()
  await expect(seat).toBeVisible()
  const toggle = page.locator('.ah-timeline-toggle')
  await expect(toggle).toBeVisible()
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-table-chrome.png'), animations: 'disabled' })
  const seatStyle = await seat.evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    border: getComputedStyle(el).borderTopColor,
    color: getComputedStyle(el).color,
    status: getComputedStyle(el.querySelector('.ah-roster-status')).color,
  }))
  expect(seatStyle.background).not.toContain('rgb(57, 69, 54)')
  expect(seatStyle.color).toBe('rgb(231, 213, 239)')
  expect(seatStyle.status).toBe('rgb(231, 213, 239)')
  const toggleStyle = await toggle.evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    color: getComputedStyle(el).color,
  }))
  expect(toggleStyle.background).not.toContain('rgb(38, 68, 56)')
  expect(toggleStyle.color).toBe('rgb(231, 213, 239)')
  await toggle.click()
  const log = page.locator('.ah-table-timeline .ah-log-wrap')
  await expect(log).toBeVisible()
  const logStyle = await log.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
  }))
  expect(logStyle.background).not.toBe('rgba(18, 35, 31, 0.97)')
  const music = page.locator('.ah-music')
  await expect(music).toBeVisible()
  const musicStyle = await music.evaluate(el => ({
    theme: el.dataset.presentationTheme,
    accent: getComputedStyle(el).getPropertyValue('--ah-theme-accent').trim(),
    dock: getComputedStyle(el.querySelector('.ah-music-dock')).backgroundColor,
    buttonBorder: getComputedStyle(el.querySelector('.ah-music button')).borderTopColor,
  }))
  expect(musicStyle.theme).toBe('theCircleUndone')
  expect(musicStyle.accent).toBe('#c7b6d6')
  expect(musicStyle.dock).not.toBe('rgba(12, 28, 23, 0.93)')
  expect(musicStyle.buttonBorder).not.toBe('rgba(141, 117, 69, 0.27)')
  await music.getByRole('button', { name: '展开音乐播放器', exact: true }).click()
  const panel = page.locator('.ah-music-panel')
  await expect(panel).toBeVisible()
  const panelStyle = await panel.evaluate(el => ({
    border: getComputedStyle(el).borderTopColor,
    background: getComputedStyle(el).backgroundImage,
  }))
  expect(panelStyle.border).toBe('rgb(199, 182, 214)')
  expect(panelStyle.background).not.toContain('rgb(41, 69, 56)')
  await panel.screenshot({ path: shot('campaign-theme-music-panel.png'), animations: 'disabled' })
  await music.screenshot({ path: shot('campaign-theme-music.png'), animations: 'disabled' })
  await page.locator('.ah-table-timeline').screenshot({ path: shot('campaign-theme-timeline.png'), animations: 'disabled' })
  // 资源盘 / 线索盘
  const pools = await page.locator('.ah-token-pool').evaluateAll(elements => elements.map(el => {
    const style = getComputedStyle(el)
    return {
      cls: el.className,
      background: style.backgroundImage,
      border: style.borderTopColor,
      color: style.color,
      hint: getComputedStyle(el.querySelector('.ah-pool-hint')).color,
    }
  }))
  const resourcePool = pools.find(pool => pool.cls.includes('ah-pool-resource'))
  const cluePool = pools.find(pool => pool.cls.includes('ah-pool-clue'))
  expect(resourcePool.background).not.toContain('rgb(91, 74, 45)')
  expect(resourcePool.background).not.toContain('rgb(12, 27, 21)')
  expect(resourcePool.border).not.toBe('rgba(169, 139, 80, 0.37)')
  expect(resourcePool.hint).toBe('rgb(173, 163, 184)')
  expect(cluePool.background).not.toContain('rgb(69, 106, 75)')
  expect(cluePool.border).not.toBe('rgba(129, 164, 138, 0.42)')
  expect(cluePool.hint).toBe('rgb(173, 163, 184)')
  await page.locator('.ah-personal-pools').screenshot({ path: shot('campaign-theme-pools.png'), animations: 'disabled' })
})

test('浮层弹窗（混乱袋/局势/胜利区/图鉴/规则书）跟随战役配色', async ({ page }) => {
  const table = await startTable(page)
  await table.update(st => {
    st.campaign.id = 'theCircleUndone'
    st.currentSeat = 0
    st.pendingChoice = null
    st.legalMoves = []
  })
  // 混乱袋
  await page.locator('.ah-chaos-bag').first().click()
  const bag = page.locator('.ah-bag-modal')
  await expect(bag).toBeVisible()
  const bagStyle = await bag.evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    border: getComputedStyle(el).borderTopColor,
  }))
  expect(bagStyle.background).not.toContain('rgb(41, 67, 54)')
  expect(bagStyle.border).not.toBe('rgb(165, 140, 86)')
  await bag.screenshot({ path: shot('campaign-theme-chaos-bag.png'), animations: 'disabled' })
  await page.locator('.ah-bag-close').click()
  // 局势
  await page.locator('[data-situation-toggle="true"]').first().click()
  const situation = page.locator('.ah-situ-modal')
  await expect(situation).toBeVisible()
  const situationStyle = await situation.evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    border: getComputedStyle(el).borderTopColor,
  }))
  expect(situationStyle.background).not.toContain('rgb(42, 71, 57)')
  expect(situationStyle.border).not.toBe('rgb(181, 155, 91)')
  await situation.screenshot({ path: shot('campaign-theme-situation.png'), animations: 'disabled' })
  await page.locator('.ah-situ-close').click()
  // 胜利区
  await page.locator('.ah-victory-launcher').first().click()
  const zone = page.locator('.ah-card-zone-modal')
  await expect(zone).toBeVisible()
  const zoneStyle = await zone.evaluate(el => ({
    border: getComputedStyle(el).borderTopColor,
  }))
  expect(zoneStyle.border).not.toBe('rgb(185, 158, 99)')
  await zone.screenshot({ path: shot('campaign-theme-card-zone.png'), animations: 'disabled' })
  await page.locator('.ah-card-zone-close').click()
  // 全卡图鉴
  await page.getByRole('button', { name: '全卡图鉴' }).first().click()
  const catalog = page.locator('.ah-catalog-modal')
  await expect(catalog).toBeVisible()
  // 图鉴首屏加载会重绘一次弹窗，等结果稳定后再取样式和截图，避免截到已卸载节点。
  await expect(catalog.locator('.ah-catalog-card').first()).toBeVisible()
  const catalogStyle = await catalog.evaluate(el => ({
    background: getComputedStyle(el).backgroundImage,
    border: getComputedStyle(el).borderTopColor,
  }))
  expect(catalogStyle.background).not.toContain('rgb(36, 59, 48)')
  expect(catalogStyle.border).not.toBe('rgb(168, 140, 87)')
  await catalog.screenshot({ path: shot('campaign-theme-catalog.png'), animations: 'disabled' })
  await page.locator('.ah-catalog-head button').first().click()
  // 规则书
  await page.keyboard.press('F1')
  const rulebook = page.locator('.ah-rulebook')
  await expect(rulebook).toBeVisible()
  const rulebookStyle = await rulebook.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    border: getComputedStyle(el).borderTopColor,
  }))
  expect(rulebookStyle.background).not.toBe('rgb(16, 37, 31)')
  expect(rulebookStyle.border).not.toBe('rgb(189, 160, 100)')
  await rulebook.screenshot({ path: shot('campaign-theme-rulebook.png'), animations: 'disabled' })
})

test('故事导入演出跟随战役配色', async ({ page }) => {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'campaign-theme-intro' } }) })
    const body = await response.json()
    session = body.session
    // 演出层在牌桌之外，这里使用万象无终色板验证注入效果。
    session.state.campaign.id = 'theCircleUndone'
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    session.state.revision++
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  const intro = page.locator('.ah-cinematic.ah-introduction')
  await expect(intro).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-story-intro.png'), animations: 'disabled' })
  const styles = await intro.evaluate(el => ({
    accent: getComputedStyle(el).getPropertyValue('--ah-theme-accent').trim(),
    background: getComputedStyle(el).backgroundImage,
    heading: getComputedStyle(el.querySelector('h1')).color,
    kicker: getComputedStyle(el.querySelector('.ah-cinematic-kicker')).color,
    detail: getComputedStyle(el.querySelector('.ah-cinematic-detail')).color,
    continueButton: getComputedStyle(el.querySelector('.ah-cinematic-controls button')).backgroundColor,
  }))
  expect(styles.accent).toBe('#c7b6d6')
  expect(styles.background).not.toContain('rgb(37, 70, 58)')
  expect(styles.background).not.toContain('rgb(3, 12, 11)')
  expect(styles.heading).toBe('rgb(231, 213, 239)')
  expect(styles.kicker).toBe('rgb(173, 163, 184)')
  expect(styles.detail).toBe('rgb(173, 163, 184)')
  expect(styles.continueButton).not.toBe('rgb(16, 37, 30)')
  await intro.getByRole('button', { name: '跳过演出', exact: true }).click()
  await expect(page.locator('.ah-table')).toBeVisible()
})

test('地点详情弹窗跟随战役配色', async ({ page }) => {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: 1, playerInvestigator: '01001', seed: 'campaign-theme-location' } }) })
    const body = await response.json()
    session = body.session
    const st = session.state
    st.campaign.id = 'theCircleUndone'
    st.pendingChoice = null
    st.currentSeat = 0
    st.phase = 'investigation'
    st.enemies = []
    st.locations = ['hallway', 'attic', 'cellar'].map(id => ({ ...scenario.locations[id], revealed: id !== 'attic', clues: id === 'cellar' ? 2 : 0, maxClues: 2 }))
    st.investigators[0].location = 'cellar'
    st.legalMoves = [{ action: 'investigate', label: '调查地窖' }, { action: 'move', locationId: 'hallway', label: '移动到走廊' }]
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    session.state.revision++
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '跳过演出' }).click()
  await page.locator('.ah-map-node[data-location-id="cellar"] [data-map-info="clues"]').click()
  const modal = page.locator('.ah-location-detail')
  await expect(modal).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-location-detail.png'), animations: 'disabled' })
  const styles = await modal.evaluate(el => {
    const pick = selector => {
      const style = getComputedStyle(el.querySelector(selector))
      return { background: style.backgroundColor, border: style.borderTopColor, color: style.color }
    }
    return {
      accent: getComputedStyle(el).getPropertyValue('--ah-theme-accent').trim(),
      background: getComputedStyle(el).backgroundImage,
      border: getComputedStyle(el).borderTopColor,
      heading: getComputedStyle(el.querySelector('h2')).color,
      state: getComputedStyle(el.querySelector('.ah-location-state')).color,
      toggle: pick('.ah-location-detail-art nav button'),
      toggleOn: pick('.ah-location-detail-art nav button[aria-pressed="true"]'),
      connection: pick('.ah-location-connections button'),
      counter: pick('.ah-location-counters > div'),
    }
  })
  expect(styles.accent).toBe('#c7b6d6')
  expect(styles.background).not.toContain('rgb(40, 70, 56)')
  expect(styles.border).not.toBe('rgb(178, 155, 96)')
  expect(styles.heading).toBe('rgb(231, 213, 239)')
  expect(styles.state).toBe('rgb(173, 163, 184)')
  expect(styles.toggle.background).not.toBe('rgb(27, 55, 43)')
  expect(styles.toggleOn.background).not.toBe('rgb(69, 80, 57)')
  expect(styles.connection.background).not.toBe('rgb(27, 55, 43)')
  expect(styles.counter.background).not.toBe('rgba(8, 27, 22, 0.5)')
})

test('序章故事调查员选择面板跟随战役配色', async ({ page }) => {
  const table = await startTable(page)
  await table.update(st => {
    st.campaign.id = 'theCircleUndone'
    st.currentSeat = 0
    st.storyInvestigators = { chosen: [], crossedOut: [] }
    const identity = [
      ['05046', '加弗瑞拉·米兹拉克', '私人警卫', { willpower: 3, intellect: 2, combat: 4, agility: 1 }, 8, 4],
      ['05047', '杰罗姆·戴维斯', '约瑟夫的秘书', { willpower: 2, intellect: 4, combat: 1, agility: 3 }, 4, 8],
      ['05048', '瓦伦蒂诺·里瓦斯', '富有的慈善家', { willpower: 1, intellect: 3, combat: 2, agility: 4 }, 5, 7],
      ['05049', '佩妮·怀特', '约瑟夫的管家', { willpower: 4, intellect: 1, combat: 3, agility: 2 }, 7, 5],
    ]
    st.pendingChoice = {
      id: 'story-pick', kind: 'storyInvestigator', seat: 0,
      prompt: '选择你本次序章使用的故事调查员（没有牌组；未选者从失踪人口中划掉）。',
      source: { kind: 'storyInvestigator', remaining: identity.map(item => item[0]), seatCount: 1 },
      options: identity.map(([code, name, subtitle, stats, health, sanity]) => ({
        id: code, cardCode: code, name, label: name, subtitle,
        klass: 'neutral', classLabel: '中立', stats, health, sanity,
      })),
    }
    st.legalMoves = identity.slice(0, 3).map(([code, name]) => ({
      action: 'choose', choiceId: 'story-pick', optionId: code, label: name,
    }))
  })
  const picker = page.locator('.ah-story-picker')
  await expect(picker).toBeVisible()
  await expect(picker.locator('.ah-story-choice')).toHaveCount(4)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(async () => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await page.screenshot({ path: shot('campaign-theme-story-picker.png'), animations: 'disabled' })
  const styles = await picker.evaluate(el => {
    const pick = selector => {
      const style = getComputedStyle(el.querySelector(selector))
      return { background: style.backgroundColor, backgroundImage: style.backgroundImage, border: style.borderTopColor, color: style.color }
    }
    return {
      accent: getComputedStyle(el).getPropertyValue('--ah-theme-accent').trim(),
      background: getComputedStyle(el).backgroundImage,
      border: getComputedStyle(el).borderTopColor,
      heading: getComputedStyle(el.querySelector('.ah-tcu-head h2')).color,
      lead: getComputedStyle(el.querySelector('.ah-tcu-lead')).color,
      purse: pick('.ah-tcu-purse'),
      candidate: pick('.ah-story-choice'),
      candidateName: getComputedStyle(el.querySelector('.ah-story-face strong')).color,
      candidateClass: getComputedStyle(el.querySelector('.ah-story-class')).color,
      detail: pick('.ah-story-detail'),
    }
  })
  expect(styles.accent).toBe('#c7b6d6')
  expect(styles.background).not.toContain('rgb(36, 59, 48)')
  expect(styles.background).not.toContain('rgb(18, 34, 29)')
  expect(styles.border).not.toBe('rgb(189, 156, 96)')
  expect(styles.heading).toBe('rgb(231, 213, 239)')
  expect(styles.lead).toBe('rgb(173, 163, 184)')
  expect(styles.candidate.backgroundImage).not.toContain('rgb(27, 36, 52)')
  expect(styles.candidate.backgroundImage).not.toContain('rgb(20, 27, 40)')
  expect(styles.candidateName).toBe('rgb(231, 213, 239)')
  expect(styles.candidateClass).toBe('rgb(173, 163, 184)')
  expect(styles.detail.background).not.toBe('rgba(9, 15, 22, 0.78)')
})
