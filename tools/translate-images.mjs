// Qwen MT Image pipeline for locally filling missing Simplified Chinese card art.
//
// Examples:
//   node games/arkhamhorror/tools/translate-images.mjs --estimate
//   node games/arkhamhorror/tools/translate-images.mjs --manifest --limit=10
//   node games/arkhamhorror/tools/translate-images.mjs --run --limit=10
//   node games/arkhamhorror/tools/translate-images.mjs --run
//   node games/arkhamhorror/tools/translate-images.mjs --verify
//
// The generated card art is for local/offline use only. Do not redistribute it.

import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { imageDescriptor, imageResolution } from '../presentation/images.js'
import { inspectImage } from './image-integrity.mjs'
import { DEFAULT_IMAGE_HOST, remoteImagePath } from '../web/images.js'

const MODEL = 'qwen-mt-image-2.0'
const DEFAULT_API_BASE = 'https://dashscope.aliyuncs.com/api/v1'
const DEFAULT_ASSET_HOST = DEFAULT_IMAGE_HOST
const DEFAULT_ARKHAMDB_HOST = 'https://arkhamdb.com'
const GAME = fileURLToPath(new URL('../', import.meta.url))
const PUBLIC_IMG = path.join(GAME, 'web', 'img')
const OUTPUT_ROOT = path.join(PUBLIC_IMG, 'zh')
const STATE_FILE = path.join(PUBLIC_IMG, '.translation', 'qwen-mt-image-state.json')
const INVENTORY_FILE = path.join(GAME, 'audit', 'local-images.json')
const EN_SOURCE_FILE = path.join(GAME, 'catalog', 'sources', 'en.json')
const SAFE_CODE = /^[0-9A-Za-z_-]+$/
const SUPPORTED_REMOTE_IMAGE = /\.(?:jpe?g|png|webp|bmp|tiff?|gif)(?:[?#]|$)/i
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const TERMINOLOGY = Object.freeze([
  ['Asset', '资产'],
  ['Event', '事件'],
  ['Skill', '技能'],
  ['Enemy', '敌人'],
  ['Treachery', '诡计'],
  ['Location', '地点'],
  ['Investigator', '调查员'],
  ['Action', '行动'],
  ['Reaction', '反应'],
  ['Fast', '快速'],
  ['Forced', '强制'],
  ['Revelation', '显现'],
  ['Fight', '战斗'],
  ['Evade', '躲避'],
  ['Investigate', '调查'],
  ['resource', '资源'],
  ['clue', '线索'],
  ['damage', '伤害'],
  ['horror', '恐惧'],
  ['health', '生命值'],
  ['sanity', '神智值'],
  ['skill test', '技能检定'],
  ['skill value', '技能值'],
  ['doom', '毁灭'],
  ['secret', '秘密'],
  ['charge', '充能'],
])

const DOMAIN_HINT = [
  'Arkham Horror: The Card Game tabletop card.',
  'Translate into concise official-style Simplified Chinese.',
  'Preserve artwork, card frames, numbers, icons, glyphs, symbols, bullets, and typography hierarchy.',
  'Do not translate cryptic glyphs, collector numbers, artist names, or copyright text.',
].join(' ')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const normalizeSlashes = value => value.replaceAll('\\', '/')

export function parseTranslationArgs(argv) {
  const options = {
    mode: '',
    limit: 0,
    rpm: 1,
    codes: [],
    packs: [],
    retries: 5,
    pollMs: 5_000,
    pollTimeoutMs: 15 * 60_000,
    apiBase: process.env.DASHSCOPE_API_BASE_URL || DEFAULT_API_BASE,
    assetHost: DEFAULT_ASSET_HOST,
    arkhamdbHost: DEFAULT_ARKHAMDB_HOST,
  }
  for (const argument of argv) {
    const [key, raw = ''] = argument.replace(/^--/, '').split('=')
    if (['estimate', 'manifest', 'run', 'verify'].includes(key) && !raw) {
      if (options.mode) throw new RangeError('只能指定一个模式')
      options.mode = key
    } else if (key === 'limit') options.limit = Number(raw)
    else if (key === 'rpm') options.rpm = Number(raw)
    else if (key === 'codes') options.codes = raw.split(',').map(item => item.trim()).filter(Boolean)
    else if (key === 'packs') options.packs = raw.split(',').map(item => item.trim()).filter(Boolean)
    else if (key === 'retries') options.retries = Number(raw)
    else if (key === 'poll-ms') options.pollMs = Number(raw)
    else if (key === 'poll-timeout-ms') options.pollTimeoutMs = Number(raw)
    else if (key === 'manifest-path') options.manifestPath = raw
    else if (key === 'api-base') options.apiBase = raw
    else if (key === 'asset-host') options.assetHost = raw
    else if (key === 'arkhamdb-host') options.arkhamdbHost = raw
    else throw new RangeError(`未知参数：${argument}`)
  }
  if (!options.mode) throw new RangeError('必须指定 --estimate、--manifest、--run 或 --verify')
  if (!Number.isSafeInteger(options.limit) || options.limit < 0) throw new RangeError('limit 必须是非负整数')
  if (!Number.isFinite(options.rpm) || options.rpm <= 0 || options.rpm > 60) throw new RangeError('rpm 必须在 0–60 之间')
  if (!Number.isSafeInteger(options.retries) || options.retries < 1 || options.retries > 10) throw new RangeError('retries 必须在 1–10 之间')
  if (!Number.isSafeInteger(options.pollMs) || options.pollMs < 100) throw new RangeError('poll-ms 不得小于 100')
  if (!Number.isSafeInteger(options.pollTimeoutMs) || options.pollTimeoutMs < options.pollMs) throw new RangeError('poll-timeout-ms 无效')
  for (const [name, value] of [['api-base', options.apiBase], ['asset-host', options.assetHost], ['arkhamdb-host', options.arkhamdbHost]]) {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new RangeError(`${name} 必须是无凭据和查询参数的 HTTP(S) 地址`)
    options[name === 'api-base' ? 'apiBase' : name === 'asset-host' ? 'assetHost' : 'arkhamdbHost'] = (url.origin + url.pathname).replace(/\/+$/, '')
  }
  return options
}

function sourceUrl(raw, fallbackPath, options) {
  const value = typeof raw?.imagesrc === 'string' ? raw.imagesrc.trim() : ''
  if (value && SUPPORTED_REMOTE_IMAGE.test(value)) {
    if (/^https?:\/\//i.test(value)) return value
    return `${options.arkhamdbHost}/${value.replace(/^\/+/, '')}`
  }
  return `${options.assetHost}/${remoteImagePath(fallbackPath)}`
}

export function buildTerminologies(card) {
  const result = []
  const seen = new Set()
  const add = (src, tgt) => {
    const from = String(src || '').replace(/<[^>]+>/g, '').trim()
    const to = String(tgt || '').replace(/<[^>]+>/g, '').trim()
    const key = from.toLocaleLowerCase('en')
    if (!from || !to || from === to || seen.has(key) || result.length >= 50) return
    seen.add(key)
    result.push({ src: from, tgt: to })
  }
  add(card.name, card.nameZh)
  add(card.subname, card.subnameZh)
  for (let index = 0; index < Math.min(card.traits?.length || 0, card.traitsZh?.length || 0); index++) {
    add(card.traits[index], card.traitsZh[index])
  }
  for (const [src, tgt] of TERMINOLOGY) add(src, tgt)
  return result
}

export function buildTranslationJobs({
  cards = ALL_CARDS,
  rawEnglish = JSON.parse(readFileSync(EN_SOURCE_FILE, 'utf8')),
  options,
  localized = code => imageResolution(code).localizedFront,
  descriptor = code => imageDescriptor(code),
} = {}) {
  if (!options) throw new TypeError('options is required')
  const codeFilter = new Set(options.codes)
  const packFilter = new Set(options.packs)
  let jobs = Object.values(cards)
    .filter(card => !localized(card.code))
    .filter(card => !codeFilter.size || codeFilter.has(card.code))
    .filter(card => !packFilter.size || packFilter.has(card.pack))
    .map(card => {
      const resolved = descriptor(card.code)
      const candidate = resolved?.front?.candidates?.[0]
      if (!candidate?.path || !/^cards\/[0-9A-Za-z_-]+\.avif$/.test(candidate.path)) return null
      const art = path.basename(candidate.path, '.avif')
      const raw = rawEnglish[card.originalCode || card.code] || rawEnglish[card.code]
      return {
        code: card.code,
        art,
        pack: card.pack || '',
        name: card.name,
        nameZh: card.nameZh,
        sourcePath: candidate.path,
        sourceUrl: sourceUrl(raw, candidate.path, options),
        directSource: !!raw?.imagesrc && SUPPORTED_REMOTE_IMAGE.test(raw.imagesrc),
        targetRelative: `zh/cards/${art}.avif`,
        targetFile: path.join(OUTPUT_ROOT, 'cards', `${art}.avif`),
        terminologies: buildTerminologies(card),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  if (options.limit) jobs = jobs.slice(0, options.limit)
  return jobs
}

function readState(file = STATE_FILE) {
  if (!existsSync(file)) return { schemaVersion: 1, model: MODEL, jobs: {} }
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  if (parsed?.schemaVersion !== 1 || parsed?.model !== MODEL || !parsed.jobs || typeof parsed.jobs !== 'object') throw new Error('翻译进度账本格式无效')
  return parsed
}

function atomicJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 1) + '\n')
  renameSync(temporary, file)
}

function updateState(state, code, patch, file = STATE_FILE) {
  state.updatedAt = new Date().toISOString()
  state.jobs[code] = { ...(state.jobs[code] || {}), ...patch, updatedAt: state.updatedAt }
  atomicJson(file, state)
}

async function responseJson(response) {
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : {} } catch { body = { message: text.slice(0, 500) } }
  if (!response.ok) {
    const error = new Error(body.message || body.code || `HTTP ${response.status}`)
    error.status = response.status
    error.responseBody = body
    throw error
  }
  return body
}

async function checkedResponse(response) {
  if (response.ok) return response
  const retryAfter = Number(response.headers.get('retry-after') || 0)
  try {
    await responseJson(response)
  } catch (error) {
    error.retryAfter = retryAfter
    throw error
  }
  throw new Error(`HTTP ${response.status}`)
}

export async function withHttpRetry(run, { attempts = 5, sleepImpl = sleep, random = Math.random } = {}) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await run(attempt) } catch (error) {
      lastError = error
      if (attempt === attempts || (error.status && !RETRYABLE_STATUS.has(error.status))) throw error
      const retryAfter = Number(error.retryAfter || 0) * 1_000
      const backoff = Math.min(60_000, 1_000 * 2 ** (attempt - 1)) + Math.floor(random() * 250)
      await sleepImpl(Math.max(retryAfter, backoff))
    }
  }
  throw lastError
}

function authHeaders(apiKey, extra = {}) {
  return { authorization: `Bearer ${apiKey}`, ...extra }
}

export function createRateGate(rpm, { now = Date.now, sleepImpl = sleep } = {}) {
  const interval = Math.ceil(60_000 / rpm)
  let lastStarted = null
  return async () => {
    const wait = lastStarted == null ? 0 : Math.max(0, interval - (now() - lastStarted))
    if (wait) await sleepImpl(wait)
    lastStarted = now()
  }
}

async function uploadTemporaryImage(bytes, filename, client) {
  const policyUrl = `${client.apiBase}/uploads?action=getPolicy&model=${encodeURIComponent(MODEL)}`
  const policyResponse = await withHttpRetry(async () => checkedResponse(await client.fetchImpl(policyUrl, {
      headers: authHeaders(client.apiKey, { 'content-type': 'application/json' }),
      signal: AbortSignal.timeout(30_000),
    })), client.retryOptions)
  const policy = (await responseJson(policyResponse)).data
  for (const field of ['upload_host', 'upload_dir', 'oss_access_key_id', 'signature', 'policy', 'x_oss_object_acl', 'x_oss_forbid_overwrite']) {
    if (typeof policy?.[field] !== 'string') throw new Error(`上传凭证缺少 ${field}`)
  }
  const uniqueName = `${path.basename(filename, path.extname(filename))}-${randomUUID()}.jpg`
  const key = `${policy.upload_dir}/${uniqueName}`
  const form = new FormData()
  form.set('OSSAccessKeyId', policy.oss_access_key_id)
  form.set('Signature', policy.signature)
  form.set('policy', policy.policy)
  form.set('x-oss-object-acl', policy.x_oss_object_acl)
  form.set('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  form.set('key', key)
  form.set('success_action_status', '200')
  form.set('file', new Blob([bytes], { type: 'image/jpeg' }), uniqueName)
  await withHttpRetry(async () => checkedResponse(await client.fetchImpl(policy.upload_host, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60_000),
    })), client.retryOptions)
  return `oss://${key}`
}

async function uploadedSource(job, client) {
  const response = await withHttpRetry(async () => checkedResponse(await client.fetchImpl(job.sourceUrl, {
      signal: AbortSignal.timeout(60_000),
    })), client.retryOptions)
  const source = Buffer.from(await response.arrayBuffer())
  if (!source.length) throw new Error('原始卡图为空')
  const jpeg = await sharp(source).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer()
  return uploadTemporaryImage(jpeg, `${job.art}.jpg`, client)
}

async function submitTask(job, imageUrl, client) {
  await client.rateGate()
  const response = await withHttpRetry(async () => checkedResponse(await client.fetchImpl(`${client.apiBase}/services/aigc/image2image/image-synthesis`, {
      method: 'POST',
      headers: authHeaders(client.apiKey, {
        'content-type': 'application/json',
        'x-dashscope-async': 'enable',
        ...(imageUrl.startsWith('oss://') ? { 'x-dashscope-ossresourceresolve': 'enable' } : {}),
      }),
      body: JSON.stringify({
        model: MODEL,
        input: {
          image_url: imageUrl,
          source_lang: 'en',
          target_lang: 'zh',
          ext: {
            domainHint: DOMAIN_HINT,
            terminologies: job.terminologies,
            config: { imageSegment: false },
          },
        },
      }),
      signal: AbortSignal.timeout(60_000),
    })), client.retryOptions)
  const body = await responseJson(response)
  const taskId = body.output?.task_id
  if (typeof taskId !== 'string' || !taskId) throw new Error('创建翻译任务未返回 task_id')
  return taskId
}

async function pollTask(taskId, client) {
  const started = Date.now()
  while (Date.now() - started < client.pollTimeoutMs) {
    const response = await withHttpRetry(async () => checkedResponse(await client.fetchImpl(`${client.apiBase}/tasks/${encodeURIComponent(taskId)}`, {
        headers: authHeaders(client.apiKey),
        signal: AbortSignal.timeout(30_000),
      })), client.retryOptions)
    const body = await responseJson(response)
    const output = body.output || {}
    if (output.task_status === 'SUCCEEDED') {
      if (typeof output.image_url !== 'string' || !output.image_url) throw new Error('翻译成功但缺少 image_url')
      return { imageUrl: output.image_url, requestId: body.request_id || null, message: output.message || null }
    }
    if (output.task_status === 'FAILED' || output.task_status === 'CANCELED' || output.task_status === 'UNKNOWN') {
      const error = new Error(output.message || output.code || `翻译任务${output.task_status}`)
      error.taskStatus = output.task_status
      throw error
    }
    await client.sleepImpl(client.pollMs)
  }
  throw new Error(`翻译任务轮询超时：${taskId}`)
}

export async function saveTranslatedImage(imageUrl, targetFile, {
  fetchImpl = fetch,
  attempts = 5,
  sleepImpl = sleep,
} = {}) {
  // Qwen result URLs deliberately return Content-Disposition: attachment and
  // x-oss-force-download. Fetch the bytes in-process; never navigate a browser.
  const response = await withHttpRetry(async () => checkedResponse(await fetchImpl(imageUrl, {
      signal: AbortSignal.timeout(60_000),
    })), { attempts, sleepImpl })
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (contentType && !contentType.startsWith('image/')) throw new Error(`翻译结果不是图片：${contentType}`)
  const source = Buffer.from(await response.arrayBuffer())
  if (!source.length) throw new Error('翻译结果为空')
  const metadata = await sharp(source).metadata()
  if (!metadata.width || !metadata.height || metadata.width < 15 || metadata.height < 15) throw new Error('翻译结果尺寸无效')
  const avif = await sharp(source).avif({ quality: 90, effort: 5 }).toBuffer()
  inspectImage(avif, targetFile)
  mkdirSync(path.dirname(targetFile), { recursive: true })
  const temporary = `${targetFile}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporary, avif)
    renameSync(temporary, targetFile)
  } finally {
    rmSync(temporary, { force: true })
  }
  return { bytes: avif.length, width: metadata.width, height: metadata.height, sha256: sha256(avif) }
}

function validExisting(file) {
  if (!existsSync(file) || !statSync(file).isFile()) return false
  try { inspectImage(readFileSync(file), file); return true } catch { return false }
}

async function translateJob(job, state, client) {
  if (validExisting(job.targetFile)) {
    updateState(state, job.code, { status: 'succeeded', art: job.art, target: job.targetRelative, skippedExisting: true }, client.stateFile)
    return { status: 'skipped' }
  }
  try {
    const sourceModes = job.directSource ? ['public-url', 'temporary-upload'] : ['temporary-upload']
    let completed
    let lastError
    for (const sourceMode of sourceModes) {
      try {
        const imageUrl = sourceMode === 'public-url' ? job.sourceUrl : await uploadedSource(job, client)
        const taskId = await submitTask(job, imageUrl, client)
        updateState(state, job.code, {
          status: 'submitted',
          art: job.art,
          target: job.targetRelative,
          taskId,
          sourceMode,
          attempts: (state.jobs[job.code]?.attempts || 0) + 1,
          error: null,
        }, client.stateFile)
        completed = { taskId, ...(await pollTask(taskId, client)) }
        break
      } catch (error) {
        lastError = error
        if (error.status === 401 || error.status === 403 || sourceMode === sourceModes.at(-1)) throw error
      }
    }
    if (!completed) throw lastError || new Error('翻译任务未完成')
    const image = await saveTranslatedImage(completed.imageUrl, job.targetFile, {
      fetchImpl: client.fetchImpl,
      attempts: client.retryOptions.attempts,
      sleepImpl: client.sleepImpl,
    })
    updateState(state, job.code, {
      status: 'succeeded',
      requestId: completed.requestId,
      message: completed.message,
      result: image,
      completedAt: new Date().toISOString(),
    }, client.stateFile)
    return { status: 'translated', ...image }
  } catch (error) {
    updateState(state, job.code, {
      status: 'failed',
      art: job.art,
      target: job.targetRelative,
      error: String(error.message || error).replaceAll(client.apiKey, '[REDACTED]').slice(0, 1_000),
      attempts: (state.jobs[job.code]?.attempts || 0) + (state.jobs[job.code]?.status === 'submitted' ? 0 : 1),
    }, client.stateFile)
    throw error
  }
}

function walkFiles(directory, root = directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const child = path.join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(child, root) : entry.isFile() ? [{
      path: normalizeSlashes(path.relative(root, child)),
      bytes: statSync(child).size,
    }] : []
  })
}

export function refreshLocalInventory({
  publicImg = PUBLIC_IMG,
  inventoryFile = INVENTORY_FILE,
  host = DEFAULT_ASSET_HOST,
} = {}) {
  const files = walkFiles(publicImg)
  const inventory = {
    schemaVersion: 1,
    host,
    scope: 'local-plus-generated',
    languages: ['en', 'zh-cn'],
    total: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    byLanguage: {
      en: files.filter(file => !file.path.startsWith('zh/')).length,
      zh: files.filter(file => file.path.startsWith('zh/')).length,
    },
    fingerprint: sha256(files.map(file => `${file.path}:${file.bytes}`).join('\n')),
    files: files.map(file => file.path),
    note: '卡面美术版权归 Fantasy Flight Games；Qwen 翻译图仅供本地离线使用，不得再分发。',
  }
  atomicJson(inventoryFile, inventory)
  return inventory
}

export function verifyTranslationJobs(jobs) {
  const missing = []
  const invalid = []
  let bytes = 0
  for (const job of jobs) {
    if (!existsSync(job.targetFile)) { missing.push(job.code); continue }
    try {
      const result = inspectImage(readFileSync(job.targetFile), job.targetFile)
      bytes += result.bytes
    } catch (error) {
      invalid.push({ code: job.code, error: error.message })
    }
  }
  return { ok: !missing.length && !invalid.length, total: jobs.length, complete: jobs.length - missing.length - invalid.length, missing, invalid, bytes }
}

export function writeBatchManifest(jobs, {
  manifestPath = path.join(PUBLIC_IMG, '.translation', 'qwen-mt-image-manifest.json'),
} = {}) {
  const absolute = path.resolve(manifestPath)
  const metadataPath = absolute.replace(/\.json$/i, '') + '.metadata.json'
  atomicJson(absolute, jobs.map(job => ({
    id: job.code,
    image_url: job.sourceUrl,
    filename: `${job.art}.jpg`,
    terminologies: job.terminologies,
  })))
  atomicJson(metadataPath, {
    schemaVersion: 1,
    model: MODEL,
    createdAt: new Date().toISOString(),
    items: jobs.map((job, index) => ({
      index,
      code: job.code,
      art: job.art,
      sourceUrl: job.sourceUrl,
      targetRelative: job.targetRelative,
      targetFile: job.targetFile,
    })),
  })
  return { manifestPath: absolute, metadataPath, items: jobs.length }
}

export async function runTranslations(options, dependencies = {}) {
  const jobs = dependencies.jobs || buildTranslationJobs({ options })
  if (options.mode === 'estimate') {
    const existing = jobs.filter(job => validExisting(job.targetFile)).length
    const pending = jobs.length - existing
    return {
      mode: 'estimate',
      total: jobs.length,
      existing,
      pending,
      publicSources: jobs.filter(job => job.directSource).length,
      uploadSources: jobs.filter(job => !job.directSource).length,
      estimatedCostCny: Number((pending * 0.004).toFixed(2)),
      minimumMinutesAtConfiguredRpm: Number((pending / options.rpm).toFixed(1)),
      rpm: options.rpm,
    }
  }
  if (options.mode === 'manifest') {
    return {
      mode: 'manifest',
      ...writeBatchManifest(jobs, { manifestPath: options.manifestPath }),
      publicSources: jobs.filter(job => job.directSource).length,
      avifSources: jobs.filter(job => !job.directSource).length,
    }
  }
  if (options.mode === 'verify') {
    const result = verifyTranslationJobs(jobs)
    return {
      mode: 'verify',
      ...result,
      mb: Number((result.bytes / 1024 ** 2).toFixed(1)),
      sampleMissing: result.missing.slice(0, 20),
      sampleInvalid: result.invalid.slice(0, 10),
    }
  }

  const apiKey = dependencies.apiKey ?? process.env.DASHSCOPE_API_KEY
  if (!apiKey) throw new Error('缺少 DASHSCOPE_API_KEY；请在本机环境变量中设置后重试')
  const sleepImpl = dependencies.sleepImpl || sleep
  const client = {
    apiKey,
    apiBase: options.apiBase,
    fetchImpl: dependencies.fetchImpl || fetch,
    pollMs: options.pollMs,
    pollTimeoutMs: options.pollTimeoutMs,
    sleepImpl,
    retryOptions: { attempts: options.retries, sleepImpl },
    rateGate: dependencies.rateGate || createRateGate(options.rpm, { sleepImpl }),
    stateFile: dependencies.stateFile || STATE_FILE,
  }
  const state = readState(client.stateFile)
  const stats = { mode: 'run', total: jobs.length, translated: 0, skipped: 0, failed: 0, failures: [], startedAt: new Date().toISOString() }
  let stopping = false
  const stop = () => { stopping = true }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    for (const [index, job] of jobs.entries()) {
      if (stopping) break
      try {
        const result = await translateJob(job, state, client)
        if (result.status === 'skipped') stats.skipped++
        else stats.translated++
      } catch (error) {
        stats.failed++
        stats.failures.push({ code: job.code, error: String(error.message || error).replaceAll(apiKey, '[REDACTED]').slice(0, 500) })
      }
      if ((index + 1) % 10 === 0 || index + 1 === jobs.length) {
        console.error(`翻译进度 ${index + 1}/${jobs.length} · 新增 ${stats.translated} · 跳过 ${stats.skipped} · 失败 ${stats.failed}`)
      }
    }
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
  const inventory = (dependencies.refreshInventory || refreshLocalInventory)({ host: options.assetHost })
  stats.stopped = stopping
  stats.finishedAt = new Date().toISOString()
  stats.localImages = inventory.total
  stats.localZhImages = inventory.byLanguage.zh
  stats.sampleFailures = stats.failures.slice(0, 20)
  delete stats.failures
  return stats
}

async function main(argv) {
  const options = parseTranslationArgs(argv)
  const result = await runTranslations(options)
  console.log(JSON.stringify(result, null, 2))
  if (options.mode === 'verify') return result.ok ? 0 : 1
  if (options.mode === 'run') return result.failed ? 1 : 0
  return 0
}

if (import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  try { process.exitCode = await main(process.argv.slice(2)) }
  catch (error) {
    console.error(String(error.message || error).replaceAll(process.env.DASHSCOPE_API_KEY || '\0', '[REDACTED]'))
    process.exitCode = 1
  }
}
