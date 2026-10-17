import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

test('卡尔克萨八章图片可解码，六首专属音乐正确播放及切换', async ({ page, request }) => {
  await page.route('**/carcosa-media-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main></main>' }))
  await page.goto('/carcosa-media-fixture')
  const assets = await page.evaluate(async () => {
    const { campaignPresentation } = await import('/mods/arkhamhorror/campaign-presentation.js')
    const ids = ['curtainCall', 'theLastKing', 'echoesOfThePast', 'theUnspeakableOath', 'aPhantomOfTruth', 'thePallidMask', 'blackStarsRise', 'dimCarcosa']
    const urls = ids.map(id => campaignPresentation('thePathToCarcosa', id).assets.storyDefault)
    urls.push(campaignPresentation('thePathToCarcosa').assets.tableOverlay)
    return Promise.all(urls.map(async url => {
      const image = new Image(); image.src = url; await image.decode()
      return { url, width: image.naturalWidth, height: image.naturalHeight }
    }))
  })
  expect(new Set(assets.map(asset => asset.url)).size).toBe(9)
  for (const asset of assets) { expect(asset.width).toBeGreaterThan(1500); expect(asset.height).toBeGreaterThan(900) }
  await page.evaluate(async () => {
    localStorage.clear()
    const NativeAudio = window.Audio
    window.Audio = function () { window.musicAudio = new NativeAudio(); return window.musicAudio }
    const h = (tag, attrs = {}, ...children) => {
      const node = document.createElement(tag)
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('on')) node[key] = value
        else node.setAttribute(key === 'className' ? 'class' : key, value)
      }
      node.append(...children.flat(Infinity).filter(child => child != null)); return node
    }
    window.fixtureH = h
    const { createMusicPlayer } = await import('/mods/arkhamhorror/music-player.js')
    window.player = createMusicPlayer(h)
    document.querySelector('main').append(window.player.render(true, 'thePathToCarcosa'))
  })
  await page.getByRole('button', { name: '展开音乐播放器', exact: true }).click()
  const tracks = [
    ['Evening of Chaos', 'evening-of-chaos'], ['Danse Macabre', 'danse-macabre'],
    ['Echoes of Time', 'echoes-of-time'], ['Long Note Two', 'long-note-two'],
    ['Ghost Processional', 'ghost-processional'], ['Ossuary 6 - Air', 'ossuary-6-air'],
  ]
  await expect(page.locator('.ah-music-track')).toHaveCount(6)
  for (const [title, file] of tracks) {
    await page.getByRole('button', { name: '播放 ' + title, exact: true }).click()
    await expect(page.locator('.ah-music-now')).toHaveText(title)
    expect(await page.evaluate(() => window.musicAudio.src)).toContain(`/campaigns/thePathToCarcosa/${file}.mp3`)
    await expect.poll(() => page.evaluate(() => window.musicAudio.duration || 0)).toBeGreaterThan(90)
    await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.1)
    const partial = await request.get(`/mods/arkhamhorror/audio/music/campaigns/thePathToCarcosa/${file}.mp3`, { headers: { Range: 'bytes=0-31' } })
    expect(partial.status()).toBe(206)
    expect(partial.headers()['content-type']).toBe('audio/mpeg')
  }
  await page.evaluate(() => window.player.render(true, 'nightOfTheZealot'))
  await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.1)
  expect(await page.evaluate(() => window.musicAudio.src)).toContain('/common/darkest-child.mp3')
  await page.locator('.ah-music-mini').click()
  await page.evaluate(() => window.player.render(true, 'thePathToCarcosa'))
  expect(await page.evaluate(() => window.musicAudio.paused)).toBe(true)
  await page.getByRole('button', { name: '播放 Evening of Chaos', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.1)
  await page.evaluate(async () => {
    const { renderStoryReader } = await import('/mods/arkhamhorror/story-reader.js')
    const session = { sessionId: 'art', state: { campaign: { id: 'thePathToCarcosa' }, scenario: { id: 'dimCarcosa' }, campaignStory: { currentId: 'past', entries: [{ id: 'past', kind: 'intro', scenarioId: 'theLastKing', title: '晚宴', paragraphs: ['故事回顾'] }] } } }
    document.querySelector('main').append(renderStoryReader(window.fixtureH, session, {}, () => {}, () => {}, {}))
  })
  await expect(page.locator('.ah-story-illustration')).toHaveAttribute('src', /scenarios\/theLastKing\/scene.webp$/)
})

test('卡尔克萨可从大厅启动并使用专属主视觉与歌单', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const setup = page.getByRole('dialog', { name: '调查准备设置' })
  await setup.getByRole('combobox', { name: '席位数量' }).selectOption('1')
  await setup.getByRole('combobox', { name: '战役', exact: true }).selectOption('thePathToCarcosa')
  await setup.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-hub')).toBeVisible()
  await expect(page.locator('[data-presentation-theme="thePathToCarcosa"]')).toBeVisible()
  const hero = page.locator('img[src$="thePathToCarcosa/hub/theatre.webp"]').first()
  await expect(hero).toBeAttached()
  await expect.poll(() => hero.evaluate(image => image.naturalWidth)).toBeGreaterThan(1500)
  await page.getByRole('button', { name: '关卡选择', exact: true }).click()
  const cases = page.locator('.ah-office-case')
  await expect(cases).toHaveCount(8)
  const caseArt = await cases.locator('.ah-office-case-art').evaluateAll(images => images.map(image => new URL(image.src).pathname))
  expect(caseArt).toEqual([
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/hub/theatre.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/theLastKing/scene.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/scene.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/scene.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/scene.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/thePallidMask/scene.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/blackStarsRise/scene.webp',
    '/mods/arkhamhorror/img/campaigns/thePathToCarcosa/scenarios/dimCarcosa/scene.webp',
  ])
  const firstRowCopyTops = await cases.locator('.ah-office-case-copy').evaluateAll(copies =>
    copies.slice(0, 3).map(copy => copy.getBoundingClientRect().top))
  expect(new Set(firstRowCopyTops).size).toBe(1)
  await page.getByRole('button', { name: '展开音乐播放器', exact: true }).click()
  await expect(page.locator('.ah-music-track')).toHaveCount(3)
  await expect(page.locator('.ah-music-now')).toHaveText('Evening of Chaos')
  mkdirSync('artifacts/carcosa-media', { recursive: true })
  await page.screenshot({ path: 'artifacts/carcosa-media/hub-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('region', { name: '音乐播放器' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'artifacts/carcosa-media/hub-mobile.png', fullPage: true })
})
