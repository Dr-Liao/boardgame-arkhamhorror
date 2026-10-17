import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish', import.meta.url))

async function fixture(page) {
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, campaignId: 'nightOfTheZealot', playerCount: 2, playerInvestigator: '01001', teammates: 1, seed: 'noir-polish' } }) })
    const payload = await response.json(); session = payload.session
    session.state.pendingChoice = null
    session.state.investigators[0].hand = ['01087', '01088', '01025', '01086', '01090']
    session.state.investigators[0].resources = 10
    session.state.legalMoves = [{ action: 'draw', label: '抽牌' }, { action: 'investigate', label: '调查' }]
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/move', async route => {
    const move = route.request().postDataJSON().move
    session.state.revision++
    if (move.action === 'draw') session.state.investigators[0].hand.push('01030')
    else {
      session.state.investigators[0].clues++
      session.events.push({ seq: Math.max(-1, ...session.events.map(e => e.seq)) + 1, type: 'presentation', kind: 'test', name: '罗兰·班克斯', seat: 0, skill: 'intellect', value: 4, difficulty: 3, success: true, autoFail: false, drawn: ['-1'] })
    }
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-noir')).toBeVisible()
  const introButtons = page.locator('.ah-introduction .ah-cinematic-controls button')
  await expect(introButtons).toHaveCount(2)
  const buttonBoxes = await introButtons.evaluateAll(buttons => buttons.map(button => {
    const { width, height } = button.getBoundingClientRect()
    return { width, height }
  }))
  expect(buttonBoxes.every(({ width, height }) => height <= 52 && width > height)).toBe(true)
  await page.getByRole('button', { name: '跳过演出' }).click()
  await expect(page.locator('.ah-hand-card .ah-table-art').first()).toHaveAttribute('data-image-state', 'displayable')
}

test('Noir 桌面与窄屏素材、布局、透明度和声音加载', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await fixture(page)
  await page.setViewportSize({ width: 1524, height: 900 })
  const campaignSurface = await page.locator('.ah-table-shell').evaluate(async shell => {
    const root = shell.closest('.ah-table')
    const before = getComputedStyle(shell, '::before')
    const image = new Image()
    image.src = '/mods/arkhamhorror/img/campaigns/nightOfTheZealot/table/investigation-map.webp'
    await image.decode()
    const rect = selector => shell.querySelector(selector).getBoundingClientRect().toJSON()
    const label = shell.querySelector('.ah-chaos-bag span').getBoundingClientRect().toJSON()
    return {
      image: [image.naturalWidth, image.naturalHeight],
      backgroundImage: before.backgroundImage,
      backgroundLayer: before.zIndex,
      contentLayer: getComputedStyle(shell.querySelector('.ah-table-script')).zIndex,
      story: rect('.ah-story-book'), reference: rect('.ah-reference-card'), command: rect('.ah-command-deck'),
      roster: rect('.ah-command-roster'), advance: rect('.ah-act-advance'),
      bagLabel: label, bagWritingMode: getComputedStyle(shell.querySelector('.ah-chaos-bag span')).writingMode,
    }
  })
  expect(campaignSurface.image).toEqual([1536, 1024])
  expect(campaignSurface.backgroundImage).toContain('campaigns/nightOfTheZealot/table/investigation-map.webp')
  expect(campaignSurface.backgroundLayer).toBe('0')
  expect(campaignSurface.contentLayer).toBe('1')
  expect(campaignSurface.story.right).toBeLessThanOrEqual(campaignSurface.reference.left)
  expect(campaignSurface.reference.right).toBeLessThanOrEqual(campaignSurface.command.left)
  expect(campaignSurface.roster.right).toBeLessThanOrEqual(campaignSurface.advance.left)
  expect(campaignSurface.bagWritingMode).toBe('horizontal-tb')
  expect(campaignSurface.bagLabel.width).toBeGreaterThan(campaignSurface.bagLabel.height)
  await expect(page.locator('.ah-music')).toBeVisible()
  await expect(page.locator('.ah-actions-empty')).toHaveCount(0)
  expect(await page.locator('.ah-table-actions').evaluate(el => {
    el.classList.add('has-choice')
    const display = getComputedStyle(el, '::before').display
    el.classList.remove('has-choice')
    return display
  })).toBe('none')
  const timeline = page.locator('.ah-table-timeline')
  const timelineToggle = timeline.locator('.ah-timeline-toggle')
  const closedTimeline = await timeline.evaluate(el => {
    const box = el.querySelector('.ah-timeline-toggle').getBoundingClientRect()
    return { position: getComputedStyle(el).position, right: innerWidth - box.right, bottom: innerHeight - box.bottom, width: box.width, height: box.height }
  })
  expect(closedTimeline.position).toBe('fixed')
  expect(closedTimeline.right).toBeLessThanOrEqual(20)
  expect(closedTimeline.bottom).toBeLessThanOrEqual(20)
  expect(closedTimeline.width).toBeGreaterThanOrEqual(136)
  expect(closedTimeline.height).toBeGreaterThanOrEqual(48)
  await timelineToggle.click()
  await expect(timeline).toHaveClass(/is-open/)
  const openTimeline = await timeline.evaluate(el => {
    const button = el.querySelector('.ah-timeline-toggle').getBoundingClientRect()
    const log = el.querySelector('.ah-log-wrap').getBoundingClientRect()
    return { buttonTop: button.top, logBottom: log.bottom, right: innerWidth - log.right, bottom: innerHeight - button.bottom }
  })
  expect(openTimeline.logBottom).toBeLessThanOrEqual(openTimeline.buttonTop)
  expect(openTimeline.right).toBeLessThanOrEqual(20)
  expect(openTimeline.bottom).toBeLessThanOrEqual(20)
  fs.mkdirSync(output, { recursive: true })
  await page.screenshot({ path: path.join(output, 'noir-timeline-open.png') })
  await timelineToggle.click()
  const compactCommand = await page.locator('.ah-command-deck').evaluate(el => {
    el.style.width = '400px'
    const roster = el.querySelector('.ah-command-roster').getBoundingClientRect()
    const advance = el.querySelector('.ah-act-advance').getBoundingClientRect()
    const result = { rosterRight: roster.right, advanceLeft: advance.left, overflow: el.scrollWidth - el.clientWidth }
    el.style.width = ''
    return result
  })
  expect(compactCommand.rosterRight).toBeLessThanOrEqual(compactCommand.advanceLeft)
  expect(compactCommand.overflow).toBe(0)
  for (const name of ['brass-token', 'investigation-map', 'chaos-bag']) {
    const alpha = await page.evaluate(async name => {
      const image = new Image(); image.src = `/mods/arkhamhorror/img/ui/${name}.png`; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let transparent = 0, opaque = 0
      for (let i = 3; i < data.length; i += 4) { if (data[i] < 20) transparent++; if (data[i] > 200) opaque++ }
      return { transparent, opaque }
    }, name)
    expect(alpha.transparent).toBeGreaterThan(100); expect(alpha.opaque).toBeGreaterThan(100)
  }
  const sounds = await page.evaluate(async () => {
    const duration = file => new Promise(resolve => {
      const audio = new Audio(`/mods/arkhamhorror/audio/${file}`)
      audio.onloadedmetadata = () => resolve(audio.duration)
      audio.onerror = () => resolve(0)
    })
    return Promise.all(['card-slide.ogg', 'encounter-reveal.ogg'].map(duration))
  })
  for (const duration of sounds) expect(duration).toBeGreaterThan(0)
  for (const viewport of [{ width: 3693, height: 1805 }, { width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('button', { name: '抽牌', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('.ah-map-node').first()).toBeInViewport()
    await page.screenshot({ path: path.join(output, `noir-${viewport.width}.png`) })
  }
  expect(errors).toEqual([])
})

test('Noir 真实结果驱动动画，重绘不重播，设置可保存', async ({ page }) => {
  await fixture(page)
  await page.getByRole('button', { name: '调查', exact: true }).click()
  await expect(page.locator('.ah-fx-banner')).toContainText('检定成功')
  await expect(page.locator('.ah-fx-chaos')).toHaveAccessibleName('-1')
  await expect(page.locator('.ah-fx-chaos img')).toHaveAttribute('src',/ct-minus1\.png$/)
  await expect.poll(() => page.locator('.ah-fx-banner').evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.95)
  await page.locator('.ah-fx-chaos').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  await page.screenshot({ path: path.join(output, 'noir-test-result.png') })
  expect(await page.locator('.ah-table').evaluate(el=>el.classList.contains('ah-presenting'))).toBe(true)
  await expect(page.locator('.ah-fx-banner')).toHaveCount(0, { timeout: 5000 })
  await page.getByRole('button', { name: '局势', exact: true }).click()
  await page.getByRole('button', { name: '关闭局势详情' }).click()
  await expect(page.locator('.ah-fx-banner')).toHaveCount(0)
  await page.locator('.ah-session-menu summary').click()
  await page.getByRole('button', { name: '音效：开' }).click()
  await page.locator('.ah-session-menu summary').click()
  await page.getByRole('button', { name: '动画：标准' }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('arkham-presentation')))).toEqual({ sound: false, fast: true })
})

test('Noir 抽牌动画独立于界面重绘，减少动态效果仍能操作', async ({ page }) => {
  await fixture(page)
  await page.getByRole('button', { name: '抽牌', exact: true }).click()
  await expect(page.locator('.ah-fx-card')).toBeVisible()
  await expect(page.locator('.ah-hand-card')).toHaveCount(6)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.ah-fx-card')).toHaveCount(0)
  await page.getByRole('button', { name: '调查', exact: true }).click()
  await expect(page.locator('.ah-fx-banner')).toContainText('检定成功')
  expect(await page.locator('.ah-fx-banner').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
})

test('Noir 真实规则调查：投入面板到混乱标记与服务端结果一致', async ({ page }) => {
  await page.route('**/api/start', route => route.continue({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerInvestigator: '01001', teammates: 0, seed: 'noir-real-test' } }) }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  let response = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  let session = (await (await response).json()).session
  await page.getByRole('button', { name: '跳过演出' }).click()
  const answer = async () => {
    const move = session.state.legalMoves.find(m => ['done', 'skip', 'self'].includes(m.optionId)) || session.state.legalMoves[0]
    response = page.waitForResponse('**/api/move')
    await page.locator('[data-option-id="' + move.optionId + '"]:visible').first().click()
    session = (await (await response).json()).session
  }
  for (let i = 0; session.state.pendingChoice; i++) { expect(i).toBeLessThan(15); await answer() }
  const investigation = session.state.legalMoves.find(m => m.action === 'investigate')
  expect(investigation).toBeTruthy()
  response = page.waitForResponse('**/api/move')
  await page.getByRole('button', { name: investigation.label, exact: true }).click()
  session = (await (await response).json()).session
  let sawCommit = false
  const startSeq = Math.max(-1, ...session.events.map(e => e.seq))
  for (let i = 0; session.state.pendingChoice; i++) {
    expect(i).toBeLessThan(25)
    if (session.state.pendingChoice.kind === 'commit') {
      sawCommit = true
      await expect(page.locator('.ah-test-preview')).toContainText('难度')
      await page.screenshot({ path: path.join(output, 'noir-real-commit.png') })
    }
    await answer()
  }
  expect(sawCommit).toBe(true)
  const result = session.events.find(e => e.seq > startSeq && e.type === 'presentation' && e.kind === 'test')
  expect(result).toBeTruthy()
  await expect(page.locator('.ah-fx-banner')).toContainText(result.success ? '检定成功' : '检定失败')
  await expect(page.locator('.ah-fx-equation')).toContainText(`${result.value} / 难度 ${result.difficulty}`)
})
