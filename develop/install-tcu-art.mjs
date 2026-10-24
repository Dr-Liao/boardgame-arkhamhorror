import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mediaPlan } from './tcu-media-plan.mjs'
const root = new URL('../', import.meta.url)
const paths = JSON.parse(readFileSync(new URL('artifacts/tcu-media/generated-paths.json', root)))
const images = new URL('web/img/campaigns/theCircleUndone/', root)
const assets = []
mkdirSync(new URL('../../artifacts/tcu-media/originals/', root), { recursive: true })
for (const { id, path } of paths) {
  const original = `artifacts/tcu-media/originals/${id}.png`
  copyFileSync(path, new URL('../../' + original, root))
  const file = id === 'table' ? 'table/investigation-desk.webp' : `scenarios/${id}/scene.webp`
  const output = new URL(file, images)
  mkdirSync(new URL('./', output), { recursive: true })
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path, '-c:v', 'libwebp', '-quality', '90', fileURLToPath(output)])
  const data = readFileSync(output)
  const png = readFileSync(new URL('../../' + original, root))
  assets.push({ id, title: id === 'table' ? '万象无终·塔罗调查桌布' : mediaPlan.find(row => row[0] === id)[1], file, width: png.readUInt32BE(16), height: png.readUInt32BE(20), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), original })
}
writeFileSync(new URL('assets.json', images), JSON.stringify({ campaignId: 'theCircleUndone', created: '2026-10-24', source: 'Original AI-generated artwork using OpenAI image_gen; not official game art.', palette: 'charcoal, smoky violet, oxidized silver, restrained amber', assets }, null, 2) + '\n')
console.log(`${assets.length} assets installed, ${assets.reduce((n,a) => n+a.bytes,0)} bytes`)
