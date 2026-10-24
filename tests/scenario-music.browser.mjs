import { test, expect } from '@playwright/test'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'
import { MUSIC_TRACKS } from '../web/music-player.js'

test('全部已配置关卡切换正确歌单和音频，自动轮播与暂停不串曲', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/scenario-music-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main></main>' }))
  await page.goto('/scenario-music-fixture')
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
    const { createMusicPlayer } = await import('/mods/arkhamhorror/music-player.js')
    const { campaignPlaylistId } = await import('/mods/arkhamhorror/campaign-presentation.js')
    window.selectChapter = (campaign, chapter) => window.player.render(true, campaignPlaylistId({ campaign: { id: campaign }, scenario: { id: chapter }, uiState: 'inScenario' }))
    window.player = createMusicPlayer(h)
    document.querySelector('main').append(window.selectChapter('nightOfTheZealot', 'theGathering'))
    window.musicAudio.muted = true
  })
  await page.getByRole('button', { name: '展开音乐播放器', exact: true }).click()
  for (const [campaign, chapters] of Object.entries(SCENARIO_MUSIC)) {
    for (const [chapter, configuration] of Object.entries(chapters)) {
      await page.evaluate(({ campaign, chapter }) => window.selectChapter(campaign, chapter), { campaign, chapter })
      await expect(page.locator('.ah-music-track')).toHaveCount(configuration.tracks.length)
      const first = MUSIC_TRACKS.find(track => track.id === configuration.tracks[0])
      const second = MUSIC_TRACKS.find(track => track.id === configuration.tracks[1])
      await expect(page.locator('.ah-music-now')).toHaveText(first.title)
      await page.getByRole('button', { name: '播放 ' + first.title, exact: true }).click()
      expect(await page.evaluate(() => new URL(window.musicAudio.src).pathname)).toBe('/mods/arkhamhorror/audio/music/' + first.file)
      await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.05)
      await page.evaluate(() => window.musicAudio.dispatchEvent(new Event('ended')))
      await expect(page.locator('.ah-music-now')).toHaveText(second.title)
      expect(await page.evaluate(() => new URL(window.musicAudio.src).pathname)).toBe('/mods/arkhamhorror/audio/music/' + second.file)
      await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.05)
    }
  }
  await page.locator('.ah-music-mini').click()
  await page.evaluate(() => window.selectChapter('theDunwichLegacy', 'theHouseAlwaysWins'))
  await expect(page.locator('.ah-music-now')).toHaveText('Deadly Roulette')
  expect(await page.evaluate(() => window.musicAudio.paused)).toBe(true)
  await page.evaluate(() => window.selectChapter('theDunwichLegacy', 'theHouseAlwaysWins'))
  expect(await page.evaluate(() => window.musicAudio.paused)).toBe(true)
  await page.getByRole('button', { name: '播放 Deadly Roulette', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.05)
  expect(errors).toEqual([])
})
