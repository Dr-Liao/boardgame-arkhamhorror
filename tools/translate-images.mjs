// Plan concurrent Codex image edits and stage their results outside the game library.
// This CLI does not call an image service. Codex runs each planned wave with its
// built-in image tool, then stages the returned files with --stage.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { imageDescriptor, imageResolution } from '../presentation/images.js'

const GAME = fileURLToPath(new URL('../', import.meta.url))
const STAGING_ROOT = path.join(GAME, 'artifacts', 'card-translation')
const DEFAULT_PLAN = path.join(STAGING_ROOT, 'next-batch.json')
const SAFE_CODE = /^[0-9A-Za-z_-]+$/

export function parseTranslationArgs(argv) {
  const options = { mode: '', next: 0, limit: 0, concurrency: 3, codes: [], packs: [], input: '', planPath: DEFAULT_PLAN, quiet: false }
  for (const argument of argv) {
    const [key, ...parts] = argument.replace(/^--/, '').split('=')
    const value = parts.join('=')
    if (['plan', 'status', 'stage'].includes(key) && !value) {
      if (options.mode) throw new RangeError('只能指定一个模式')
      options.mode = key
    } else if (key === 'quiet' && !value) options.quiet = true
    else if (key === 'next') options.next = Number(value)
    else if (key === 'limit') options.limit = Number(value)
    else if (key === 'concurrency') options.concurrency = Number(value)
    else if (key === 'codes') options.codes = value.split(',').map(item => item.trim()).filter(Boolean)
    else if (key === 'packs') options.packs = value.split(',').map(item => item.trim()).filter(Boolean)
    else if (key === 'input') options.input = value
    else if (key === 'plan-path') options.planPath = value
    else throw new RangeError(`未知参数：${argument}`)
  }
  if (!options.mode) throw new RangeError('必须指定 --plan、--status 或 --stage')
  for (const name of ['next', 'limit']) {
    if (!Number.isSafeInteger(options[name]) || options[name] < 0) throw new RangeError(`${name} 必须是非负整数`)
  }
  if (options.next && options.limit) throw new RangeError('next 与 limit 不能同时指定')
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 20) throw new RangeError('concurrency 必须在 1–20 之间')
  if (options.codes.some(code => !SAFE_CODE.test(code))) throw new RangeError('卡号格式无效')
  if (options.mode === 'stage' && (options.codes.length !== 1 || !options.input)) throw new RangeError('stage 需要一个 --codes=<卡号> 和 --input=<生图文件>')
  return options
}

export function buildTranslationJobs({
  cards = ALL_CARDS,
  options,
  descriptor = code => imageDescriptor(code),
  localized = code => imageResolution(code).localizedFront,
  stagingRoot = STAGING_ROOT,
  sourceExists = existsSync,
} = {}) {
  if (!options) throw new TypeError('options is required')
  const codes = new Set(options.codes)
  const packs = new Set(options.packs)
  let jobs = Object.values(cards)
    .filter(card => card.code !== '01000') // This placeholder's image is a text-free card back.
    .filter(card => !localized(card.code))
    .filter(card => !codes.size || codes.has(card.code))
    .filter(card => !packs.size || packs.has(card.pack))
    .map(card => {
      const candidate = descriptor(card.code)?.front?.candidates?.[0]
      if (!/^cards\/[0-9A-Za-z_-]+\.avif$/.test(candidate?.path || '')) return null
      const art = path.basename(candidate.path, '.avif')
      const source = path.join(GAME, 'web', 'img', candidate.path)
      const target = path.join(stagingRoot, 'zh', 'cards', `${art}.avif`)
      return {
        code: card.code, art, pack: card.pack || '',
        name: card.name, nameZh: card.nameZh,
        subnameZh: card.subnameZh || '', traitsZh: card.traitsZh || [],
        textZh: card.textZh || '', flavorZh: card.flavorZh || '',
        source, sourceAvailable: sourceExists(source),
        target, staged: existsSync(target),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.code.localeCompare(b.code, 'en'))
  const seenTargets = new Set()
  jobs = jobs.filter(job => {
    if (seenTargets.has(job.target)) return false
    seenTargets.add(job.target)
    return true
  })
  if (options.next) jobs = jobs.filter(job => !job.staged && job.sourceAvailable).slice(0, options.next)
  if (options.limit) jobs = jobs.slice(0, options.limit)
  return jobs
}

export function buildBatchPlan(jobs, concurrency) {
  const waves = []
  for (let index = 0; index < jobs.length; index += concurrency) {
    waves.push(jobs.slice(index, index + concurrency))
  }
  return { schemaVersion: 1, method: 'codex-imagegen', stagingRoot: STAGING_ROOT, concurrency, total: jobs.length, waves }
}

export async function stageGeneratedImage(job, input) {
  if (!existsSync(input)) throw new Error(`生图文件不存在：${input}`)
  if (!job.sourceAvailable) throw new Error(`英文原图不存在：${job.source}`)
  if (existsSync(job.target)) throw new Error(`暂存图已存在：${job.target}`)
  const original = await sharp(job.source).metadata()
  mkdirSync(path.dirname(job.target), { recursive: true })
  const output = await sharp(input)
    .resize(original.width, original.height, { fit: 'fill' })
    .avif({ quality: 90, effort: 5 })
    .toFile(job.target)
  return { code: job.code, target: job.target, bytes: output.size }
}

async function main(argv) {
  const options = parseTranslationArgs(argv)
  const jobs = buildTranslationJobs({ options })
  if (options.mode === 'status') {
    const staged = jobs.filter(job => job.staged).length
    return { mode: 'status', total: jobs.length, staged, pending: jobs.length - staged, missingEnglishSources: jobs.filter(job => !job.sourceAvailable).length }
  }
  if (options.mode === 'plan') {
    const plan = buildBatchPlan(jobs, options.concurrency)
    const output = path.resolve(options.planPath)
    mkdirSync(path.dirname(output), { recursive: true })
    writeFileSync(output, JSON.stringify(plan, null, 2) + '\n')
    return { mode: 'plan', file: output, cards: plan.total, waves: plan.waves.length, concurrency: plan.concurrency }
  }
  const job = jobs[0]
  if (!job) throw new Error(`卡号没有待翻译正面：${options.codes[0]}`)
  return { mode: 'stage', ...await stageGeneratedImage(job, options.input) }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  try {
    const options = parseTranslationArgs(process.argv.slice(2))
    const result = await main(process.argv.slice(2))
    if (!options.quiet) console.log(JSON.stringify(result, null, 2))
  }
  catch (error) { console.error(String(error.message || error)); process.exitCode = 1 }
}
