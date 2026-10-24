// P10 placeholder campaign art for The Circle Undone (TCU).
//
// There is no official art for this campaign in the repository, and the P10
// release must not reuse another campaign's images. Every file below is a
// deterministic ffmpeg placeholder: a fixed lavfi gradient built from the
// campaign palette (background #17131e, panel #241e2d, accent #c7b6d6) plus a
// soft accent bloom, vignette and a fixed-seed grain pass. The same command must
// produce the same bytes on the same ffmpeg/libwebp build, so assets.json hashes
// are reproducible.
//
// Regenerate (ffmpeg is not on PATH by default in this repo):
//   $env:PATH = "E:\Tools\FFMPEG\bin;$env:PATH"
//   node develop/gen-tcu-images.mjs
//
// The script overwrites the 10 WebP files and assets.json. README.md is written
// once by this script too, so a later replacement pass can delete the directory
// and regenerate/inject real art without touching runtime code.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mediaPlan } from './tcu-media-plan.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const OUT = join(ROOT, 'web/img/campaigns/theCircleUndone')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const FFPROBE = process.env.FFPROBE || 'ffprobe'
const WIDTH = 1672
const HEIGHT = 941
const GENERATED = '2026-10-24'
const ASPECT = WIDTH / HEIGHT

const PALETTE = Object.freeze({ background: '#17131e', panel: '#241e2d', accent: '#c7b6d6' })
const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16))
const BACKGROUND = rgb(PALETTE.background)
const PANEL = rgb(PALETTE.panel)
const ACCENT = rgb(PALETTE.accent)

// One fixed look per chapter, in mediaPlan order. `glows` are
// [x, y, strength, spread] (normalized center); strength caps the accent mix.
// The opening chapter is centered because it doubles as the hub hero and the
// default story illustration in web/campaign-presentation.js.
const SCENE_LOOKS = Object.freeze([
  { direction: 0.62, glows: [[0.50, 0.40, 0.24, 0.060], [0.78, 0.70, 0.10, 0.150]], vignette: [0.52, 0.36], grain: 5, seed: 1101 },
  { direction: 0.34, glows: [[0.26, 0.62, 0.20, 0.050], [0.70, 0.30, 0.09, 0.140]], vignette: [0.55, 0.34], grain: 5, seed: 1102 },
  { direction: 0.78, glows: [[0.72, 0.34, 0.22, 0.045], [0.30, 0.72, 0.11, 0.130]], vignette: [0.56, 0.33], grain: 6, seed: 1103 },
  { direction: 0.46, glows: [[0.40, 0.30, 0.21, 0.052], [0.66, 0.74, 0.10, 0.145]], vignette: [0.54, 0.35], grain: 5, seed: 1104 },
  { direction: 0.68, glows: [[0.30, 0.46, 0.20, 0.048], [0.74, 0.26, 0.11, 0.135]], vignette: [0.58, 0.32], grain: 6, seed: 1105 },
  { direction: 0.52, glows: [[0.62, 0.58, 0.23, 0.055], [0.24, 0.30, 0.09, 0.150]], vignette: [0.53, 0.35], grain: 5, seed: 1106 },
  { direction: 0.26, glows: [[0.46, 0.66, 0.24, 0.050], [0.78, 0.36, 0.12, 0.140]], vignette: [0.57, 0.33], grain: 6, seed: 1107 },
  { direction: 0.82, glows: [[0.58, 0.28, 0.21, 0.046], [0.32, 0.66, 0.12, 0.130]], vignette: [0.55, 0.34], grain: 5, seed: 1108 },
  { direction: 0.40, glows: [[0.50, 0.52, 0.25, 0.058], [0.72, 0.22, 0.10, 0.150]], vignette: [0.59, 0.31], grain: 6, seed: 1109 },
])

// The table overlay sits under cards: keep it darker and calmer than chapter art.
const TABLE_LOOK = Object.freeze({
  direction: 0.40, glows: [[0.50, 0.46, 0.08, 0.090], [0.24, 0.70, 0.04, 0.200]],
  vignette: [0.60, 0.30], grain: 7, seed: 2202, grid: { w: 104, h: 104, alpha: 0.035 },
})

const fixed = value => Number(value).toFixed(4)
const clip = (value, min, max) => `clip(${value},${fixed(min)},${fixed(max)})`

function filterGraph(look) {
  const nx = '(X/W)'
  const ny = '(Y/H)'
  const t = `(${fixed(look.direction)}*${nx}+${fixed(1 - look.direction)}*${ny})`
  const glow = look.glows
    .map(([x, y, strength, spread]) => {
      const dx = `((${nx}-${fixed(x)})*${fixed(ASPECT)})`
      const dy = `(${ny}-${fixed(y)})`
      return `(${fixed(strength)}*exp(-(${dx}*${dx}+${dy}*${dy})/${fixed(spread)}))`
    })
    .join('+')
  const [vignetteStrength, vignetteMin] = look.vignette
  const vignette = clip(`1-${fixed(vignetteStrength)}*((${nx}-0.5)*(${nx}-0.5)*1.25+(${ny}-0.5)*(${ny}-0.5))`, vignetteMin, 1)
  const channel = ([from, to, accent]) => {
    const base = `(${from}+${to - from}*${t})`
    return clip(`(${base}+(${accent}-${base})*${glow})*${vignette}`, 0, 255)
  }
  const filters = [
    `geq=r='${channel([BACKGROUND[0], PANEL[0], ACCENT[0]])}'`
      + `:g='${channel([BACKGROUND[1], PANEL[1], ACCENT[1]])}'`
      + `:b='${channel([BACKGROUND[2], PANEL[2], ACCENT[2]])}'`,
        // Fixed-seed grain hides 8-bit banding; `allf=t+u` keeps it byte-stable.
    `noise=alls=${look.grain}:allf=t+u:all_seed=${look.seed}`,
  ]
  if (look.grid) filters.push(`drawgrid=w=${look.grid.w}:h=${look.grid.h}:t=1:c=${PALETTE.accent}@${fixed(look.grid.alpha)}`)
  return filters.join(',')
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function generate(file, look) {
  const target = join(OUT, ...file.split('/'))
  mkdirSync(join(target, '..'), { recursive: true })
  execFileSync(FFMPEG, [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=black:s=${WIDTH}x${HEIGHT},format=rgb24`,
    '-vf', filterGraph(look),
    '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', '-preset', 'picture',
    target,
  ])
  const [width, height] = execFileSync(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', target,
  ], { encoding: 'utf8' }).trim().split(',').map(Number)
  if (width !== WIDTH || height !== HEIGHT) throw new Error(`${file}: expected ${WIDTH}x${HEIGHT}, got ${width}x${height}`)
  const data = readFileSync(target)
  if (!data.length) throw new Error(`${file}: empty output`)
  return { file, width, height, bytes: data.length, sha256: sha256(data) }
}

const assets = mediaPlan.map(([id, title, mood], index) => {
  const scene = generate(`scenarios/${id}/scene.webp`, SCENE_LOOKS[index])
  return { id, title, mood, role: 'storyDefault', ...scene }
})
const table = generate('table/investigation-desk.webp', TABLE_LOOK)
assets.push({ id: 'table', title: '调查桌面 ・ 深紫占位', role: 'tableOverlay', ...table })

const manifest = {
  campaignId: 'theCircleUndone',
  generated: GENERATED,
  placeholder: true,
  source: 'ffmpeg placeholder: deterministic lavfi gradient, soft accent bloom, vignette and fixed-seed grain; not official game art, not copied from another campaign',
  generator: 'develop/gen-tcu-images.mjs',
  palette: PALETTE,
  dimensions: { width: WIDTH, height: HEIGHT },
  note: 'Placeholder art only. Replace each file (and update bytes/sha256) when official or commissioned art exists.',
  assets,
}
writeFileSync(join(OUT, 'assets.json'), JSON.stringify(manifest, null, 2) + '\n')

const readme = `# 《万象无终》（The Circle Undone）展示素材\n\n`
  + `2026-10-24 由 \`develop/gen-tcu-images.mjs\` 生成，是**占位素材**，不是官方美术，也不复制其他循环的图。\n`
  + `每张图都是固定参数的 ffmpeg lavfi 深紫渐变（背景 \`${PALETTE.background}\`、面板 \`${PALETTE.panel}\`、强调色 \`${PALETTE.accent}\`），`
  + `叠加柔光、暗角与固定种子的细颗粒；同一 ffmpeg/libwebp 构建下逐字节可复现。\n\n`
  + `全部 ${WIDTH}×${HEIGHT} WebP，共 ${assets.length} 张，文件尺寸、字节数与 SHA-256 见 \`assets.json\`。\n\n`
  + `| 用途 | 网页文件 |\n| --- | --- |\n`
  + `| 战役大厅主视觉 / 默认故事插图（序章） | \`scenarios/disappearanceAtTheTwilightEstate/scene.webp\` |\n`
  + mediaPlan.slice(1).map(([id, title]) => `| 章节场景 · ${title} | \`scenarios/${id}/scene.webp\` |\n`).join('')
  + `| 牌桌调查桌面 | \`table/investigation-desk.webp\` |\n\n`
  + `运行时路径由 \`web/campaign-presentation.js\` 引用（hubHero / storyDefault 指序章场景，tableOverlay 指调查桌面）。\n\n`
  + `替换方式：准备正式美术后按同名文件覆盖，并重写 \`assets.json\` 的 width/height/bytes/sha256，`
  + `或直接修改 \`develop/gen-tcu-images.mjs\` 的生成参数后重跑：\n\n`
  + '```powershell\n$env:PATH = "E:\\Tools\\FFMPEG\\bin;$env:PATH"\nnode develop/gen-tcu-images.mjs\n```\n\n'
  + `这些图片是独立生成的占位素材，与《诡镇奇谈》官方美术无关。\n`
writeFileSync(join(OUT, 'README.md'), readme)

const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0)
console.log(JSON.stringify({
  campaignId: manifest.campaignId,
  files: assets.length,
  totalBytes,
  dimensions: manifest.dimensions,
  assets: assets.map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 })),
}, null, 2))
