// N2 本地卡图抓取：把远程资产主机上的卡面批量下载到 public/img/arkham/ 供离线使用。
//
//   node games/arkhamhorror/tools/fetch-images.mjs --estimate        抽样估算文件数与体积，不下载
//   node games/arkhamhorror/tools/fetch-images.mjs --download        下载（可重复运行，断点续传）
//   node games/arkhamhorror/tools/fetch-images.mjs --verify          只读校验结构和内容摘要，失败非零退出
//   --verify --write-inventory                                  显式建立/更新本地 SHA-256 基线
//
// 可选参数：
//   --scope=referenced|manifest   referenced=仅目录实际引用的面（默认），manifest=远程清单全部卡面
//   --lang=zh-cn,en               需要的语言（默认两者）
//   --concurrency=6               并发请求数（默认 6，请勿调高以免对第三方主机造成压力）
//   --limit=N                     只处理前 N 个文件，便于试跑
//   --host=https://...            资产主机
//
// 边界：
//   - 只下载，不修改参考源；目标目录固定在 public/img/arkham/ 之下，路径逐段校验。
//   - 已存在且字节数与远程一致的文件会跳过，可安全中断后重跑。
//   - 卡面美术版权归 Fantasy Flight Games；本工具仅供本地离线使用，不要再分发。

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { imageDescriptor } from '../presentation/images.js'
import { verifyImages } from './image-integrity.mjs'

const GAME = new URL('../', import.meta.url)
// 卡图属于本 Mod 自带资源，放在 games/arkhamhorror/web/img/，由大厅挂载到 /mods/<id>/img/。
const PUBLIC_IMG = fileURLToPath(new URL('../web/img', import.meta.url))
const MANIFEST = new URL('../../../参考资源/ArkhamHorror-main/frontend/image-manifest.json', import.meta.url)
const DEFAULT_HOST = 'https://assets.arkhamhorror.app'
const LOCALIZED_PREFIX = 'zh'
// 实际文件名含大写与下划线（如 cards/01033_Mutated15.avif），逐段校验而不是整串匹配。
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

function parseArgs(argv) {
  const options = { mode: '', scope: 'referenced', languages: ['zh-cn', 'en'], concurrency: 6, limit: 0, host: DEFAULT_HOST }
  for (const argument of argv) {
    const [key, value = ''] = argument.replace(/^--/, '').split('=')
    if (['estimate', 'download', 'verify'].includes(key) && !value) { options.mode = key; continue }
    if (key === 'write-inventory' && !value) { options.writeInventory = true; continue }
    if (key === 'scope' && ['referenced', 'manifest'].includes(value)) { options.scope = value; continue }
    if (key === 'lang') { options.languages = value.split(',').map(item => item.trim()).filter(Boolean); continue }
    if (key === 'concurrency') { options.concurrency = Number(value); continue }
    if (key === 'limit') { options.limit = Number(value); continue }
    if (key === 'host') { options.host = value; continue }
    throw new RangeError('未知参数：' + argument)
  }
  if (!options.mode) throw new RangeError('必须指定 --estimate、--download 或 --verify')
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 12) throw new RangeError('并发数需在 1–12 之间')
  if (!Number.isSafeInteger(options.limit) || options.limit < 0) throw new RangeError('limit 无效')
  if (!options.languages.every(language => ['zh-cn', 'zh', 'en'].includes(language))) throw new RangeError('lang 仅支持 zh-cn、zh、en')
  const host = new URL(options.host)
  if (!['http:', 'https:'].includes(host.protocol) || host.search || host.hash) throw new RangeError('主机必须是无查询参数的 http(s) 地址')
  options.host = (host.origin + host.pathname).replace(/\/+$/, '')
  return options
}

/** 目标路径必须落在 public/img/arkham/ 内，且只允许清单式的安全相对路径。 */
function targetFor(relative) {
  const segments = String(relative).split('/')
  const valid = segments.length >= 2 && segments.length <= 4
    && segments.every(segment => SAFE_SEGMENT.test(segment) && segment !== '.' && segment !== '..')
    && /\.(avif|webp|png|jpe?g|gif)$/i.test(segments.at(-1))
  if (!valid) throw new RangeError('不安全的资源路径：' + relative)
  const file = path.resolve(PUBLIC_IMG, relative)
  const inside = path.relative(PUBLIC_IMG, file)
  if (inside.startsWith('..') || path.isAbsolute(inside)) throw new RangeError('路径越界：' + relative)
  return file
}

/** 目录实际会请求的面：正面、背面与已声明的替代美术，避免下载用不到的美术。 */
function referencedPaths() {
  const english = new Set(), localized = new Set()
  for (const code of Object.keys(ALL_CARDS)) {
    const descriptor = imageDescriptor(code)
    if (!descriptor) continue
    for (const face of [descriptor.front, descriptor.back]) {
      for (const candidate of [...face.candidates, ...Object.values(face.variants || {})]) {
        english.add(candidate.path)
        if (candidate.localized) localized.add(candidate.path)
      }
    }
  }
  return { english, localized }
}

function manifestPaths() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const strip = prefix => (manifest[prefix] || []).filter(entry => typeof entry === 'string').map(entry => entry.replace(/^img\/arkham\//, ''))
  const english = new Set([...strip('img/arkham/cards'), ...strip('img/arkham/backs')])
  const localized = new Set(strip('img/arkham/zh/cards').map(entry => entry.replace(/^zh\//, '')))
  return { english, localized }
}

function buildJobs(options) {
  const { english, localized } = options.scope === 'manifest' ? manifestPaths() : referencedPaths()
  const jobs = []
  const wantsEnglish = options.languages.some(language => language === 'en')
  const wantsLocalized = options.languages.some(language => language === 'zh' || language === 'zh-cn')
  if (wantsEnglish) {
    for (const relative of [...english].sort()) jobs.push({ relative, url: `${options.host}/img/arkham/${relative}`, language: 'en' })
  }
  if (wantsLocalized) {
    // 中文清单独立成账：即使英文清单没有同名条目，也要把已发布的中文图取回。
    for (const relative of [...localized].sort()) {
      const localizedRelative = `${LOCALIZED_PREFIX}/${relative}`
      jobs.push({ relative: localizedRelative, url: `${options.host}/img/arkham/${localizedRelative}`, language: 'zh' })
    }
  }
  return options.limit ? jobs.slice(0, options.limit) : jobs
}

async function withRetry(run, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await run() } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 400 * attempt * attempt))
    }
  }
  throw lastError
}

async function remoteSize(job) {
  return withRetry(async () => {
    const response = await fetch(job.url, { headers: { range: 'bytes=0-0' }, signal: AbortSignal.timeout(20000) })
    if (response.status === 404) return { missing: true, bytes: 0 }
    if (!response.ok && response.status !== 206) throw new Error('HTTP ' + response.status)
    const range = response.headers.get('content-range')
    return { missing: false, bytes: range ? Number(range.split('/')[1]) : Number(response.headers.get('content-length') || 0) }
  })
}

async function download(job) {
  return withRetry(async () => {
    const response = await fetch(job.url, { signal: AbortSignal.timeout(60000) })
    if (response.status === 404) return { missing: true }
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const body = Buffer.from(await response.arrayBuffer())
    if (!body.length) throw new Error('空响应')
    const file = targetFor(job.relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, body)
    return { missing: false, bytes: body.length }
  })
}

async function runPool(jobs, concurrency, worker, onProgress) {
  let index = 0, done = 0
  const runners = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (index < jobs.length) {
      const job = jobs[index++]
      await worker(job)
      if (++done % 200 === 0) onProgress?.(done, jobs.length)
    }
  })
  await Promise.all(runners)
}

function localInventory() {
  const files = []
  const visit = directory => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) files.push({ path: path.relative(PUBLIC_IMG, child).replaceAll('\\', '/'), bytes: statSync(child).size })
    }
  }
  visit(PUBLIC_IMG)
  return files
}

function writeInventory(options, extra = {}) {
  const files = localInventory()
  const inventory = {
    schemaVersion: 1,
    host: options.host,
    scope: options.scope,
    languages: [...options.languages].sort(),
    total: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    byLanguage: {
      en: files.filter(file => !file.path.startsWith(LOCALIZED_PREFIX + '/')).length,
      zh: files.filter(file => file.path.startsWith(LOCALIZED_PREFIX + '/')).length,
    },
    fingerprint: createHash('sha256').update(files.map(file => file.path + ':' + file.bytes).join('\n')).digest('hex'),
    files: files.map(file => file.path),
    note: '卡面美术版权归 Fantasy Flight Games，仅供本地离线使用，不得再分发。',
    ...extra,
  }
  mkdirSync(fileURLToPath(new URL('./audit/', GAME)), { recursive: true })
  writeFileSync(new URL('./audit/local-images.json', GAME), JSON.stringify(inventory, null, 1) + '\n')
  return inventory
}

async function main(argv) {
  const options = parseArgs(argv)
  const jobs = buildJobs(options)

  if (options.mode === 'verify') {
    const digestFile = new URL('./audit/image-digests.json', GAME)
    const expected = existsSync(digestFile) ? JSON.parse(readFileSync(digestFile, 'utf8')).records : {}
    const result = verifyImages(jobs, targetFor, options.writeInventory ? {} : expected)
    if (options.writeInventory && !result.missing.length && !result.invalid.length) {
      writeFileSync(digestFile, JSON.stringify({ schemaVersion: 1, scope: options.scope,
        note: 'Local content baseline; structural AVIF validation and SHA-256, not a remote authenticity assertion.', records: result.records }, null, 1) + '\n')
      result.untracked = []; result.ok = true
    }
    console.log(JSON.stringify({ mode: 'verify', readOnly: !options.writeInventory, expected: jobs.length,
      manifestPresent: existsSync(MANIFEST), contentComplete: result.ok,
      missing: result.missing.length, invalid: result.invalid.length, untracked: result.untracked.length,
      sampleMissing: result.missing.slice(0, 10), sampleInvalid: result.invalid.slice(0, 10) }, null, 1))
    return result.ok ? 0 : 1
  }

  if (options.mode === 'estimate') {
    const sample = Array.from({ length: Math.min(24, jobs.length) }, (_, i) => jobs[Math.floor(jobs.length * (i + 0.5) / Math.min(24, jobs.length))])
    let bytes = 0, counted = 0, missing = 0
    await runPool(sample, options.concurrency, async job => {
      const result = await remoteSize(job)
      if (result.missing) missing++
      else { bytes += result.bytes; counted++ }
    })
    const average = counted ? bytes / counted : 0
    console.log(JSON.stringify({
      mode: 'estimate', scope: options.scope, languages: options.languages, files: jobs.length,
      sampled: sample.length, sampleMissing: missing, averageKB: Number((average / 1024).toFixed(1)),
      estimatedTotalGB: Number((average * jobs.length / 1024 ** 3).toFixed(2)),
    }, null, 1))
    return 0
  }

  const pending = jobs.filter(job => !existsSync(targetFor(job.relative)) || statSync(targetFor(job.relative)).size === 0)
  const stats = { downloaded: 0, bytes: 0, skipped: jobs.length - pending.length, missing: [], failed: [] }
  const started = Date.now()
  console.error(`开始下载：共 ${jobs.length} 个，其中已存在 ${stats.skipped} 个，待下载 ${pending.length} 个，并发 ${options.concurrency}`)
  await runPool(pending, options.concurrency, async job => {
    try {
      const result = await download(job)
      if (result.missing) stats.missing.push(job.relative)
      else { stats.downloaded++; stats.bytes += result.bytes }
    } catch (error) {
      stats.failed.push({ path: job.relative, error: String(error.message || error) })
    }
  }, (done, total) => console.error(`  进度 ${done}/${total} · 已写入 ${(stats.bytes / 1024 ** 2).toFixed(0)} MB`))

  const inventory = writeInventory(options, { remoteMissing: stats.missing.length, missingPaths: stats.missing.slice(0, 200) })
  console.log(JSON.stringify({
    mode: 'download', scope: options.scope, languages: options.languages,
    expected: jobs.length, downloaded: stats.downloaded, skippedExisting: stats.skipped,
    remoteMissing: stats.missing.length, failed: stats.failed.length,
    downloadedMB: Number((stats.bytes / 1024 ** 2).toFixed(1)),
    localFiles: inventory.total, localMB: Number((inventory.bytes / 1024 ** 2).toFixed(1)),
    elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    sampleFailed: stats.failed.slice(0, 10),
  }, null, 1))
  return stats.failed.length ? 1 : 0
}

if (import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  try { process.exit(await main(process.argv.slice(2))) }
  catch (error) { console.error(String(error.message || error)); process.exit(1) }
}
