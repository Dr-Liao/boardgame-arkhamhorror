import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'
import { campaignPresentation } from '../web/campaign-presentation.js'
import { musicTracksForPlaylist } from '../web/music-player.js'

// 发布级素材证据：10 张主题图（桌面图 + 9 章场景图）与 27 首 TCU 本地 BGM。
// 桌面 / mobile 各一条用例：报告器按**用例标题是否含 mobile** 派生视口
// （tools/playwright-tcu-reporter.mjs:41），因此移动用例标题必须带 mobile。
// annotation 口径（reporter 与 tools/audit-tcu.mjs 读取）：
//   · type: 'media'      → description 形如 "images=10,tracks=27"，reporter 汇总 media.resources=37；
//   · type: 'screenshot' → description 为仓库根目录下的绝对路径（reporter 会转成 repo-relative 后再校验）。
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SCREENSHOT_DIR = `${REPO_ROOT}artifacts/tcu-media/`
const IMAGE_COUNT = 1 + chapters.length
const TCU_TRACKS = musicTracksForPlaylist('theCircleUndone')
const MEDIA_TIMEOUT = 120000

const mediaAnnotation = () => ({ type: 'media', description: `images=${IMAGE_COUNT},tracks=${TCU_TRACKS.length}` })

async function assertMediaAssets(page, screenshotPath) {
  test.setTimeout(MEDIA_TIMEOUT)
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
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
  await expect(page.locator('img')).toHaveCount(IMAGE_COUNT)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  for (const track of TCU_TRACKS) {
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
}

test('四循环十张图片可解码，27 首本地音乐均可播放', async ({ page }) => {
  const shot = `${SCREENSHOT_DIR}gallery-desktop.png`
  test.info().annotations.push(mediaAnnotation(), { type: 'screenshot', description: shot })
  await assertMediaAssets(page, shot)
})

test('四循环十张图片可解码，27 首本地音乐均可播放（mobile 视口）', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const shot = `${SCREENSHOT_DIR}gallery-mobile.png`
  test.info().annotations.push(mediaAnnotation(), { type: 'screenshot', description: shot })
  await assertMediaAssets(page, shot)
})
