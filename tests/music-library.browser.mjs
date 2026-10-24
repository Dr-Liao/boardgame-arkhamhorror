import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMusicLibrary } from '../src/integration/music-library.js'

test('玩家歌曲热加载、配置换序、空歌单与播放连续性', async ({ page }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'music-browser-'))
  const id = 'theCircleUndone/theWitchingHour'
  const folder = path.join(root, 'campaigns', id)
  fs.mkdirSync(folder, { recursive: true })
  const library = createMusicLibrary({ root })
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  try {
    await page.route('**/api/mods/arkhamhorror/music/playlist?*', async route => {
      const data = library(new URL(route.request().url()).searchParams.get('id'))
      await new Promise(resolve => setTimeout(resolve, 200))
      return route.fulfill({ json: { ok: true, ...data } })
    })
    await page.route('**/music-library-fixture', route => route.fulfill({ contentType: 'text/html', body: '<link rel="stylesheet" href="/mods/arkhamhorror/music-player.css"><main></main>' }))
    await page.goto('/music-library-fixture')
    await page.evaluate(async id => {
      localStorage.setItem('arkham-music-v1', JSON.stringify({ muted: true }))
      const NativeAudio = window.Audio
      window.Audio = function () { window.musicAudio = new NativeAudio(); return window.musicAudio }
      const h = (tag, attrs = {}, ...children) => {
        const node = document.createElement(tag)
        for (const [key, value] of Object.entries(attrs)) {
          if (key.startsWith('on')) node[key] = value
          else node.setAttribute(key === 'className' ? 'class' : key, value)
        }
        node.append(...children.flat(Infinity).filter(c => c != null)); return node
      }
      const { createMusicPlayer } = await import('/mods/arkhamhorror/music-player.js')
      window.player = createMusicPlayer(h)
      document.querySelector('main').append(window.player.render(true, id))
    }, id)
    await page.getByRole('button', { name: '展开音乐播放器', exact: true }).click()
    await expect(page.locator('.ah-music-track')).toHaveCount(3)
    await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.1)
    await page.getByRole('button', { name: '播放 Baba Yaga', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.1)
    const before = await page.evaluate(() => ({ src: window.musicAudio.src, time: window.musicAudio.currentTime }))
    const custom = path.join(folder, '灵魂 #%.mp3')
    fs.copyFileSync(new URL('../web/audio/music/common/ritual.mp3', import.meta.url), custom)
    await page.route('**/audio/music/campaigns/**', route => route.fulfill({ contentType: 'audio/mpeg', body: fs.readFileSync(custom) }))
    await page.getByRole('button', { name: '刷新歌单', exact: true }).click()
    await expect(page.locator('.ah-music-track')).toHaveCount(4)
    expect(await page.evaluate(() => window.musicAudio.src)).toBe(before.src)
    expect(await page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThanOrEqual(before.time)
    await page.getByRole('button', { name: '播放 灵魂 #%', exact: true }).click()
    await expect.poll(() => page.evaluate(() => window.musicAudio.currentTime)).toBeGreaterThan(.1)
    expect(await page.evaluate(() => new URL(window.musicAudio.src).pathname)).toContain(encodeURIComponent('灵魂 #%.mp3'))
    const config = tracks => fs.writeFileSync(path.join(root, 'playlists.json'), JSON.stringify({ schemaVersion: 1, playlists: { [id]: { tracks, includeCustom: false } } }))
    config([])
    await page.getByRole('button', { name: '刷新歌单', exact: true }).click()
    await expect(page.locator('.ah-music-track')).toHaveCount(0)
    await expect(page.locator('.ah-music-play')).toBeDisabled()
    expect(await page.evaluate(() => window.musicAudio.paused)).toBe(true)
    fs.writeFileSync(path.join(root, 'playlists.json'), '{broken')
    await page.getByRole('button', { name: '刷新歌单', exact: true }).click()
    await expect(page.locator('.ah-music-feedback')).toContainText('格式有误')
    config(['ritual', 'tcuBabaYaga'])
    await page.getByRole('button', { name: '刷新歌单', exact: true }).click()
    await expect(page.locator('.ah-music-track').first()).toContainText('Ritual')
    await expect(page.locator('.ah-music-track')).toHaveCount(2)
    expect(await page.evaluate(() => window.musicAudio.paused)).toBe(true)
    await page.screenshot({ path: '../../artifacts/music-library-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: '../../artifacts/music-library-mobile.png' })
    expect(errors).toEqual([])
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})
