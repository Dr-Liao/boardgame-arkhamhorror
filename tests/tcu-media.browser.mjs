import { test, expect } from '@playwright/test'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'
import { campaignPresentation } from '../web/campaign-presentation.js'
import { musicTracksForPlaylist } from '../web/music-player.js'

test('四循环十张图片可解码，27 首本地音乐均可播放', async ({ page }) => {
  test.setTimeout(120000)
  await page.route('**/tcu-media-fixture', route => route.fulfill({ contentType: 'text/html', body: '<main></main>' }))
  await page.goto('/tcu-media-fixture')
  const images = [{ name: '万象无终·桌布', src: campaignPresentation('theCircleUndone').assets.tableOverlay }, ...chapters.map(c => ({ name: c.name, src: campaignPresentation('theCircleUndone', c.id).assets.storyDefault }))]
  await page.evaluate(async images => {
    document.body.style.cssText = 'background:#17131e;color:#e7d5ef;font:16px sans-serif;margin:24px'
    const main = document.querySelector('main')
    main.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px'
    for (const item of images) {
      const figure = document.createElement('figure'); figure.style.margin = '0'
      const img = new Image(); img.src = item.src; img.style.width = '100%'; await img.decode()
      if (img.naturalWidth < 1536) throw new Error(item.src)
      const caption = document.createElement('figcaption'); caption.textContent = item.name
      figure.append(img, caption); main.append(figure)
    }
  }, images)
  await expect(page.locator('img')).toHaveCount(10)
  await page.screenshot({ path: '../../artifacts/tcu-media/gallery-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '../../artifacts/tcu-media/gallery-mobile.png', fullPage: true })
  for (const track of musicTracksForPlaylist('theCircleUndone')) {
    const result = await page.evaluate(async file => {
      const audio = new Audio('/mods/arkhamhorror/audio/music/' + file)
      audio.muted = true
      await audio.play()
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('audio did not advance')), 5000)
        audio.ontimeupdate = () => { if (audio.currentTime > 0) { clearTimeout(timeout); resolve() } }
      })
      const duration = audio.duration; audio.pause(); audio.src = ''; return duration
    }, track.file)
    expect(result, track.title).toBeGreaterThan(30)
  }
})
