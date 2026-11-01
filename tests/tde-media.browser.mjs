// 食梦者（TDE）P9 真实 HTTP 素材验收（桌面 1440×950 / 移动 390×844）。
//
// 素材现实（Lead P9 裁决口径）：**TDE 尚无专属美术/BGM**——web/img/campaigns/ 下没有
// theDreamEaters/，web/scenario-music.js 也没有 TDE 条目。本 spec 证明的是「真实回退管线 +
// 388 张 TDE 卡图的获取能力」：战役/章节插画与 BGM 都是真实模块解析出的共同素材（不是 TDE
// 专属），不能当作「TDE 素材齐备」；media.resources 是「388 张卡图 + 76 首真实回退 BGM」的
// 派生数量，逐项证据见下方断言与截图。补充 TDE 专属美术/BGM 属 P9/P10 缺口，进 remaining。
//
// 证据口径（数字全部由真实模块派生，不写死清单）：
//   · 卡图：TDE 388 条印刷记录（352 主卡 + 36 关联面）来自 src/cards/cards-data.js 的 06 卡池，
//     逐条校验 imagesrc（/bundles/cards/<code>.png）。en/zh 地址按 web/images.js 的真实目录规则
//     （LOCAL_ROOT + 本地化前缀）从卡号派生；HTTP 抽样按 code 排序等距取 24 张，en/zh 各取一条
//     （48 个 URL）走同源 /mods/arkhamhorror/img/…?cache=cdn → 服务端按需从 CDN 拉取，断言
//     200 与 content-type image/*。抽样只覆盖 HTTP 可获取性，388 条的元数据与地址推导是全量断言。
//   · 静态资源：web/campaign-presentation.js 的战役/章节插画（当前 TDE 未单独配图，真实回退到
//     公共素材）逐条 fetch 200 + image/*。
//   · BGM：web/music-player.js 的 musicTracksForPlaylist('theDreamEaters')（真实模块，当前回退
//     common 播放列表），逐首 fetch 200 + content-type audio/*。
//   · annotation（reporter 与后续审计读取）：type: 'media' description "images=N,tracks=M"；
//     type: 'screenshot' 为仓库根目录下的绝对路径。
//
// 报告器按**用例标题是否含 mobile** 派生视口（tools/playwright-tde-reporter.mjs），移动用例标题
// 必须带 mobile。证据命令：node ../../node_modules/@playwright/test/cli.js test
//   --config playwright.tde.config.mjs tde-media.browser.mjs
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { LOCALIZED_PREFIX, LOCAL_ROOT } from '../web/images.js'
import { campaignPresentation } from '../web/campaign-presentation.js'
import { musicTracksForPlaylist } from '../web/music-player.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SCREENSHOT_DIR = `${REPO_ROOT}artifacts/tde-migration/`
const MEDIA_TIMEOUT = 180_000
const SAMPLE_CARDS = 24

// 388 条 TDE 卡记录（含 36 张关联面）——与 audit/tde-scenarios 的 06 卡口径一致。
const CARD_CODES = Object.keys(ALL_CARDS).filter(code => /^06\d{3}[a-z]?$/.test(code)).sort()
// HTTP 抽样：等距取 24 张，覆盖 8 个章节包与关联面，不手写卡号清单。
const SAMPLE_CODES = Array.from({ length: SAMPLE_CARDS }, (_, index) =>
  CARD_CODES[Math.min(CARD_CODES.length - 1, Math.round(index * (CARD_CODES.length - 1) / (SAMPLE_CARDS - 1)))])

const enImageUrl = code => `${LOCAL_ROOT}/cards/${code}.avif?cache=cdn`
const zhImageUrl = code => `${LOCAL_ROOT}/${LOCALIZED_PREFIX}/cards/${code}.avif?cache=cdn`
const SAMPLED_IMAGE_URLS = SAMPLE_CODES.flatMap(code => [enImageUrl(code), zhImageUrl(code)])

// 战役与章节插画（真实模块派生；未单独配图的章节按 campaign-presentation 的真实回退取值）。
const PRESENTATION_URLS = [...new Set([
  campaignPresentation('theDreamEaters'),
  ...chapters.map(chapter => campaignPresentation('theDreamEaters', chapter.id)),
].flatMap(theme => Object.values(theme.assets)))]

// BGM（真实模块派生；TDE 尚未单列播放列表，musicTracksForPlaylist 会真实回退到 common）。
const TRACKS = musicTracksForPlaylist('theDreamEaters')
const TRACK_URLS = TRACKS.map(track => `/mods/arkhamhorror/audio/music/${track.file}`)

const mediaAnnotation = () =>
  ({ type: 'media', description: `images=${CARD_CODES.length},tracks=${TRACKS.length}` })

// 页面内批量 fetch：只读状态码 / content-type / 字节数，不把音频与图片整段留在 Node 内存里。
async function fetchAll(urls) {
  return Promise.all(urls.map(async url => {
    const response = await fetch(url)
    const contentType = response.headers.get('content-type') || ''
    const announced = Number(response.headers.get('content-length') || 0)
    const buffer = await response.arrayBuffer()
    return { url, status: response.status, contentType, length: announced || buffer.byteLength }
  }))
}

async function assertMediaAssets(page, screenshotPath) {
  test.setTimeout(MEDIA_TIMEOUT)
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  // 证据前提：388 条卡记录的 imagesrc 元数据完整且可推导 en/zh 地址（不依赖网络）。
  expect(CARD_CODES.length, 'TDE 06 卡记录数应为 388').toBe(388)
  const missingImage = CARD_CODES.filter(code => !ALL_CARDS[code].imagesrc)
  expect(missingImage, `缺少 imagesrc 的卡：${missingImage.slice(0, 10).join(',')}`).toEqual([])
  const wrongPrefix = CARD_CODES.filter(code => !String(ALL_CARDS[code].imagesrc).startsWith('/bundles/cards/'))
  expect(wrongPrefix, `imagesrc 前缀异常：${wrongPrefix.slice(0, 10).join(',')}`).toEqual([])
  expect(TRACKS.length, 'TDE BGM 播放列表不应为空').toBeGreaterThan(0)

  await page.route('**/tde-media-fixture', route =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<main></main>' }))
  await page.goto('/tde-media-fixture')

  const imageResults = await page.evaluate(fetchAll, SAMPLED_IMAGE_URLS)
  const staticResults = await page.evaluate(fetchAll, PRESENTATION_URLS)
  const trackResults = await page.evaluate(fetchAll, TRACK_URLS)

  // 真实 HTTP：200 + 正确 content-type（图片抽样 48 个 URL、静态插画、BGM 全量）。
  const badImages = imageResults.filter(item => item.status !== 200 || !/^image\//.test(item.contentType))
  expect(badImages, `卡图 HTTP 失败：${JSON.stringify(badImages.slice(0, 4))}`).toEqual([])
  expect(imageResults.every(item => item.length > 0), '卡图应为非空响应体').toBe(true)
  const badStatic = staticResults.filter(item => item.status !== 200 || !/^image\//.test(item.contentType))
  expect(badStatic, `静态插画 HTTP 失败：${JSON.stringify(badStatic.slice(0, 4))}`).toEqual([])
  const badTracks = trackResults.filter(item => item.status !== 200 || !/^audio\//.test(item.contentType))
  expect(badTracks, `BGM HTTP 失败：${JSON.stringify(badTracks.slice(0, 4))}`).toEqual([])

  // 真实解码 + 画廊截图：抽样卡图 en/zh 成对展示（浏览器真正 decode，不是只看状态码）。
  await page.evaluate(async ({ images, statics, tracks }) => {
    document.body.style.cssText = 'background:#0d1712;color:#dfe9e0;font:14px sans-serif;margin:20px'
    const main = document.querySelector('main')
    main.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px'
    const header = document.createElement('h1')
    header.textContent = `TDE 素材验收：卡图 ${images.length} 张 · 静态 ${statics.length} 张 · BGM ${tracks.length} 首`
    header.style.cssText = 'grid-column:1/-1;font-size:18px;margin:0 0 8px'
    main.append(header)
    for (const item of statics) {
      const figure = document.createElement('figure')
      figure.style.margin = '0'
      const img = new Image()
      img.src = item.url
      img.style.width = '100%'
      await img.decode()
      if (img.naturalWidth < 64) throw new Error(item.url)
      const caption = document.createElement('figcaption')
      caption.textContent = `静态 · ${item.url.split('/').pop()}`
      figure.append(img, caption)
      main.append(figure)
    }
    for (let index = 0; index < images.length; index += 2) {
      const figure = document.createElement('figure')
      figure.style.margin = '0'
      for (const item of images.slice(index, index + 2)) {
        const img = new Image()
        img.src = item.url
        img.style.width = 'calc(50% - 2px)'
        img.style.marginRight = '2px'
        await img.decode()
        if (img.naturalWidth < 64) throw new Error(item.url)
        figure.append(img)
      }
      const caption = document.createElement('figcaption')
      caption.textContent = `${images[index].url.split('/').pop().replace('.avif', '')}（${index % 4 === 0 ? 'en' : 'zh'}）`
      figure.append(caption)
      main.append(figure)
    }
    for (const track of tracks.slice(0, 12)) {
      const row = document.createElement('div')
      row.style.cssText = 'grid-column:1/-1'
      row.textContent = `BGM 200 · ${track.url.split('/').pop()}`
      main.append(row)
    }
  }, { images: imageResults, statics: staticResults, tracks: trackResults })
  await expect(page.locator('img')).toHaveCount(PRESENTATION_URLS.length + SAMPLED_IMAGE_URLS.length)
  expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
  expect(pageErrors, `pageerror: ${pageErrors.join(' | ')}`).toEqual([])
  await page.screenshot({ path: screenshotPath, fullPage: true })
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P9 真实 HTTP 素材：388 张卡图 en/zh 抽样 + 战役插画与 BGM 在${label}端可获取（${label} ${width}×${height}）`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const shot = `${SCREENSHOT_DIR}p9-media-${label}.png`
    test.info().annotations.push(mediaAnnotation(), { type: 'screenshot', description: shot })
    await assertMediaAssets(page, shot)
  })
}
