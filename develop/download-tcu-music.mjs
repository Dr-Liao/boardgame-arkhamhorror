// Downloads only the selected tracks from the author's official catalogue.
// sources.json entries follow the most recent campaign precedent
// (title/filename/isrc/page/download/localFile/bytes/sha256/encoded/retrieved).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mediaPlan, slug } from './tcu-media-plan.mjs'
const root = new URL('../', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('artifacts/tcu-music-catalog.json', root)))
const audio = new URL('web/audio/music/', root)
// 原始下载缓存放在仓库根 artifacts/（gitignore），不能放进 games/arkhamhorror/artifacts：
// presentation-images 测试会扫描游戏目录内所有媒体文件，只允许运行时图库/音乐目录内的媒体。
const originals = new URL('../../artifacts/tcu-media/audio-originals/', root)
mkdirSync(originals, { recursive: true })
mkdirSync(new URL('common/', audio), { recursive: true })
const hash = data => createHash('sha256').update(data).digest('hex')
const manifest = JSON.parse(readFileSync(new URL('sources.json', audio)))
for (const title of mediaPlan.flatMap(row => row[3])) {
  const source = catalog.find(t => t.title === title)
  if (!source) throw new Error('Missing official metadata: ' + title)
  const download = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + encodeURIComponent(source.filename)
  const original = new URL(slug(title) + '.mp3', originals)
  if (!existsSync(original)) {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('download-tcu-file.ps1', import.meta.url)), '-Uri', download, '-OutFile', fileURLToPath(original)], { timeout: 150000 })
  }
  const data = readFileSync(original)
  const localFile = 'common/' + slug(title) + '.mp3'
  const output = new URL(localFile, audio)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', fileURLToPath(original), '-map', '0:a:0', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', fileURLToPath(output)])
  const encoded = readFileSync(output)
  const entry = {
    title: source.title,
    filename: source.filename,
    isrc: source.isrc,
    page: 'https://incompetech.com/music/royalty-free/index.html?isrc=' + encodeURIComponent(source.isrc),
    download,
    localFile,
    bytes: data.length,
    sha256: hash(data),
    encoded: { bytes: encoded.length, sha256: hash(encoded) },
    retrieved: '2026-10-24',
  }
  const index = manifest.tracks.findIndex(t => t.isrc === source.isrc)
  if (index >= 0 && manifest.tracks[index].localFile !== localFile) throw new Error('Unexpected existing track: ' + title)
  if (index >= 0) manifest.tracks[index] = { ...manifest.tracks[index], ...entry }
  else manifest.tracks.push(entry)
  manifest.updated = '2026-10-24'
  writeFileSync(new URL('sources.json', audio), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`${title}: ${encoded.length} bytes`)
}
