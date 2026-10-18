// 发布前处理（由大厅 tools/release/pack-mod.mjs 与 tools/release/stage-games.mjs 调用）：
//   node tools/prepack-release.mjs <暂存目录>                          商店包 / 免安装程序包
//   node tools/prepack-release.mjs <暂存目录> --asset-pack=arkham-cards  免安装卡图资源包
// 只登记暂存目录里真实存在的图片：程序包写入 audit/local-images.json（不含卡图，卡图仍可由默认 CDN
// 按需缓存）；卡图资源包写入 audit/local-images.cards.json，解压合并后由游戏补充登记。

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const modDir = fileURLToPath(new URL('..', import.meta.url))
const staging = path.resolve(process.argv[2] || '')
const assetPack = process.argv.slice(3).find(value => value.startsWith('--asset-pack='))?.slice('--asset-pack='.length)
if (assetPack !== undefined && assetPack !== 'arkham-cards') throw new Error('未知资源包：' + assetPack)
if (!process.argv[2] || (!assetPack && !fs.existsSync(path.join(staging, 'index.js')))) {
  throw new Error('用法：prepack-release.mjs <暂存目录> [--asset-pack=arkham-cards]')
}

const sourcePath = path.join(modDir, 'audit', 'local-images.json')
if (fs.existsSync(sourcePath)) {
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const imageRoot = path.join(staging, 'web', 'img')
  const files = (source.files || []).filter(relative => fs.existsSync(path.join(imageRoot, relative)))
  let bytes = 0
  let zh = 0
  const lines = files.map(relative => {
    const length = fs.statSync(path.join(imageRoot, relative)).size
    bytes += length
    if (relative.startsWith('zh/')) zh++
    return `${relative}:${length}`
  })
  const inventory = {
    schemaVersion: 1,
    host: source.host,
    scope: source.scope,
    languages: source.languages || [],
    package: assetPack || 'logic',
    total: files.length,
    bytes,
    byLanguage: { en: files.length - zh, zh },
    fingerprint: createHash('sha256').update(lines.join('\n')).digest('hex'),
    note: source.note,
    files,
  }
  fs.mkdirSync(path.join(staging, 'audit'), { recursive: true })
  fs.writeFileSync(path.join(staging, 'audit', assetPack ? 'local-images.cards.json' : 'local-images.json'), JSON.stringify(inventory, null, 2))
  console.log('prepack: 登记 ' + files.length + ' 张' + (assetPack ? '资源包' : '随包') + '图片')
}
