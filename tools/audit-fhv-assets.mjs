#!/usr/bin/env node
// 《铁杉谷盛宴》(FHV) P8 素材/图片库存与远程回退、展示数据审计账本。
//
//   node tools/audit-fhv-assets.mjs --write             生成 audit/fhv-assets.json（status!==verified 时写盘后非零退出）
//   node tools/audit-fhv-assets.mjs --check             逐字节复算账本，且必须 status=verified
//   node tools/audit-fhv-assets.mjs                     打印当前复算结果（不写盘）
//   node tools/audit-fhv-assets.mjs --write-inventory   只补写 audit/local-images.json 缺失的 FHV 条目（默认只读）
//   node tools/audit-fhv-assets.mjs --probe-remote=8    抽样 HEAD 远程主面（只打印，不写账本）
//
// 口径（与 TSK P8 audit/tsk-migration.json#gates.assets 对齐）：
//   · 图片账：441 条记录 = content/campaigns/theFeastOfHemlockVale/shared.js#partitions
//     （fhvCampaign 301 + fhvInvestigators 20 + fhvPlayer 120），并与 audit/fhv-scope.json#codes 交叉核对；
//     逐卡用 presentation/images.js#imageResolution 解析，local/remote 是二元状态；
//     候选只代表「可以拼出的地址」，不代表远程可用，因此 remote 计数不等于远程已验证。
//   · 本地库存：以 audit/local-images.json（路径清单 + 指纹）与 audit/image-digests.json（SHA-256 基线）为准，
//     只读校验；缺条目只在 disclosed 登记，不修改既有账本（--write-inventory 是显式例外）。
//   · 运行时独立性：静态扫描 src/content/web/presentation 对「参考资源」目录的 import／fs 读取／路径构造；
//     注释（含块注释）与溯源字符串（如 cards-data 的 source 字段）不算命中。
//   · 展示数据：presentationStats() 复算全目录解析；presentation/localized-arts.json 与
//     presentation/media-registry.json 的映射来源哈希对照 参考资源/ArkhamHorror-main 的原清单复算
//     （与 tools/build-presentation.mjs 同一口径，但不重跑整份展示报告）；
//     audit/presentation-report.json 只作 N2 证据登记，不参与门禁——它内嵌 web 文件指纹，与展示数据无关。
//   · 已知缺图不得掩盖：未解析卡号、缺中文面、摘要基线缺口、远程 404 的可选候选全部进 disclosed。
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ALL_CARDS } from '../src/cards/cards-data.js'
import { partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import { imageDescriptor, imageResolution, presentationStats } from '../presentation/images.js'
import { DEFAULT_IMAGE_HOST, LOCALIZED_PREFIX, remoteImagePath } from '../web/images.js'
// 展示管线（tools/build-presentation.mjs）按 retired-localized-arts.json 剔除已退役中文图；
// 本审计必须与同一口径复算，否则只要退役清单非空就会误报映射漂移。
import retiredLocalizedArts from '../presentation/retired-localized-arts.json' with { type: 'json' }
const RETIRED_LOCALIZED_ARTS = new Set(retiredLocalizedArts)

const MOD = fileURLToPath(new URL('../', import.meta.url))
const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
const LEDGER = 'audit/fhv-assets.json'
const SCOPE_LEDGER = 'audit/fhv-scope.json'
const LOCAL_INVENTORY = 'audit/local-images.json'
const IMAGE_DIGESTS = 'audit/image-digests.json'
const PRESENTATION_REPORT = 'audit/presentation-report.json'
const IMAGE_ROOT = 'web/img'
const REFERENCE_CAMPAIGN = 'ArkhamHorror-main'
const REFERENCE_ZH_DIGEST = 'frontend/src/digests/zh.json'
const REFERENCE_IMAGE_MANIFEST = 'frontend/image-manifest.json'
const RUNTIME_ROOTS = ['src', 'content', 'web', 'presentation']
const SCAN_FILE = /\.(?:js|mjs|cjs|json)$/
// 「参考资源」用码点写出，避免任何编码/转写差异让扫描静默失效。
export const REFERENCE_MARKER = '\u53c2\u8003\u8d44\u6e90'
const FS_READ = /\b(?:readFileSync|readFile|readdirSync|readdir|lstatSync|statSync|stat|existsSync|exists|createReadStream|openSync|open|accessSync|globSync)\s*\(/
const FS_WRITE = /\b(?:writeFileSync|writeFile|appendFileSync|copyFileSync|cpSync|mkdirSync|rmSync|unlinkSync)\s*\(/
const PATH_BUILD = /\b(?:join|resolve)\s*\(|new\s+URL\s*\(/
const REFERENCE_FIELD = /\breferenceRoot\b/
const FHV_IMAGE_PATH = /^(?:zh\/)?cards\/10/
// 只锁「卡图解析语义」的三个运行时模块：库存与摘要基线已在 localImagesLedger 里锁定哈希，
// 展示映射产物已在 presentation.artifacts 里锁定哈希，分区与 441 条记录以派生数字入账，
// 因此正在被其它 P8 工作改动的 content/**、audit/fhv-scope.json 不整文件锁哈希（改分区会直接改账本数字）。
const SOURCE_FILES = [
  'presentation/images.js',
  'presentation/art-rules.js',
  'web/images.js',
]
const PRESENTATION_ARTIFACTS = [
  'presentation/localized-arts.json',
  'presentation/generated-localized-arts.json',
  'presentation/media-registry.json',
]

const json = value => JSON.stringify(value, null, 2) + '\n'
const sha256 = value => createHash('sha256').update(value).digest('hex')
const existsAt = relative => existsSync(join(MOD, relative))
const readTextAt = relative => readFileSync(join(MOD, relative), 'utf8').replace(/^\uFEFF/, '')
const readJsonAt = relative => JSON.parse(readTextAt(relative))
const readJsonMaybe = relative => {
  try { return existsAt(relative) ? readJsonAt(relative) : null } catch { return null }
}
const fileSha256 = relative => (existsAt(relative) ? sha256(readFileSync(join(MOD, relative))) : null)
const ordered = value => Array.isArray(value) ? value.map(ordered)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]))
    : value
const errorLine = error => String(error && error.message ? error.message : error).split('\n')[0].slice(0, 240)

// ---------------------------------------------------------------------------
// 1. 运行时「参考资源」读取的静态扫描
// ---------------------------------------------------------------------------

/** 把 // 与 /* *\/ 注释替换成空格（保留换行与字符串内容），避免注释里的溯源被误判为读取。 */
export function maskComments(source) {
  const characters = String(source).split('')
  let index = 0
  let quote = null
  while (index < characters.length) {
    const character = source[index]
    const next = source[index + 1]
    if (quote) {
      if (character === '\\') { index += 2; continue }
      if (character === quote) quote = null
      index += 1
      continue
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; index += 1; continue }
    if (character === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') { characters[index] = ' '; index += 1 }
      continue
    }
    if (character === '/' && next === '*') {
      characters[index] = ' '; characters[index + 1] = ' '
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] !== '\n') characters[index] = ' '
        index += 1
      }
      if (index < source.length) { characters[index] = ' '; characters[index + 1] = ' '; index += 2 }
      continue
    }
    index += 1
  }
  return characters.join('')
}

function moduleSpecifier(line) {
  const match = /\bfrom\s*(['"])([^'"]+)\1/.exec(line)
    || /\b(?:import|require)\s*\(\s*(['"`])([^'"`]+)\1/.exec(line)
  return match ? match[2] : null
}

/** 单行级判定：只有真实 import／fs 读取／路径构造才算依赖，注释与纯元数据字符串不算。 */
export function scanReferenceDependencies(text, relative = '<memory>') {
  const lines = maskComments(text).split('\n')
  const tainted = new Set()
  for (const line of lines) {
    const assignment = /(?:^|[;{}])\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s*=\s*([^=].*)$/.exec(line)
    if (assignment && assignment[2].includes(REFERENCE_MARKER)) tainted.add(assignment[1])
  }
  const taintedPattern = tainted.size ? new RegExp(`\\b(?:${[...tainted].join('|')})\\b`) : null
  const hits = []
  lines.forEach((line, index) => {
    if (!line.trim()) return
    const hasMarker = line.includes(REFERENCE_MARKER)
    const hasField = REFERENCE_FIELD.test(line)
    const hasTaint = Boolean(taintedPattern && taintedPattern.test(line))
    if (!hasMarker && !hasField && !hasTaint) return
    const specifier = moduleSpecifier(line)
    const kind = specifier && specifier.includes(REFERENCE_MARKER) ? 'module-import'
      : FS_READ.test(line) ? 'fs-read'
        : FS_WRITE.test(line) ? 'fs-write'
          : PATH_BUILD.test(line) ? 'path-construction'
            : null
    if (!kind) return
    hits.push({ path: relative.split('\\').join('/'), line: index + 1, kind, excerpt: line.trim().slice(0, 160) })
  })
  return hits
}

/** 逐文件扫描；先做子串预筛，绝大多数文件不含标记，不需要做注释屏蔽。 */
function scanReferenceFile(absolute, relative) {
  const text = readFileSync(absolute, 'utf8')
  if (!text.includes(REFERENCE_MARKER) && !text.includes('referenceRoot')) return []
  return scanReferenceDependencies(text, relative)
}

function scanRuntimeReferenceDependencies() {
  const hits = []
  const visit = relativeDirectory => {
    const absolute = join(MOD, relativeDirectory)
    if (!existsSync(absolute)) return
    const entries = readdirSync(absolute, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))
    for (const entry of entries) {
      const childRelative = `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) visit(childRelative)
      else if (SCAN_FILE.test(entry.name)) hits.push(...scanReferenceFile(join(absolute, entry.name), childRelative))
    }
  }
  for (const root of RUNTIME_ROOTS) visit(root)
  return hits
}

// ---------------------------------------------------------------------------
// 2. 441 条记录 × 展示解析
// ---------------------------------------------------------------------------

function partitionCodes() {
  const codes = []
  const seen = new Set()
  for (const key of ['fhvCampaign', 'fhvInvestigators', 'fhvPlayer']) {
    for (const code of partitions[key] || []) {
      if (seen.has(code)) continue
      seen.add(code)
      codes.push(code)
    }
  }
  return codes.sort()
}

function auditImages(codes) {
  const cards = []
  const unresolved = []
  const required = { local: new Set(), localized: new Set() }
  const faces = {
    frontFaces: 0,
    backFaces: 0,
    backArt: 0,
    genericBack: 0,
    primaryNotLocal: [],
    remoteOnlyFaces: [],
    localizedMissingOnDisk: [],
    optionalRemoteCandidates: { count: 0, bySource: {} },
  }
  for (const code of codes) {
    const descriptor = imageDescriptor(code)
    const resolution = imageResolution(code)
    const row = {
      code,
      resolved: Boolean(descriptor),
      local: resolution.imageStatus === 'local',
      remote: resolution.imageStatus === 'remote-candidate',
      localized: Boolean(resolution.localizedFront),
    }
    if (!row.resolved) {
      row.unresolvedReason = Object.hasOwn(ALL_CARDS, code) ? 'no-descriptor' : 'not-in-catalog'
      unresolved.push(code)
    }
    cards.push(row)
    if (!descriptor) continue
    for (const faceName of ['front', 'back']) {
      faces[`${faceName}Faces`] += 1
      const candidates = descriptor[faceName].candidates
      const primary = candidates[0]
      if (!primary) { faces.remoteOnlyFaces.push({ code, face: faceName, candidates: [] }); continue }
      const displayable = candidates.find(candidate => candidate.local || candidate.localLocalized)
      if (!displayable) {
        faces.remoteOnlyFaces.push({ code, face: faceName, candidates: candidates.map(candidate => candidate.path) })
      } else {
        required.local.add(displayable.path)
        if (displayable.localLocalized) required.localized.add(displayable.path)
        if (!(primary.local || primary.localLocalized)) {
          faces.primaryNotLocal.push({ code, face: faceName, primary: primary.path, displayable: displayable.path })
        }
      }
      for (const candidate of candidates) {
        if (candidate.localized) {
          required.localized.add(candidate.path)
          if (!existsAt(`${IMAGE_ROOT}/${LOCALIZED_PREFIX}/${candidate.path}`)) {
            faces.localizedMissingOnDisk.push({ code, face: faceName, path: candidate.path })
          }
        }
        if (!(candidate.local || candidate.localLocalized)) {
          faces.optionalRemoteCandidates.count += 1
          const source = candidate.source || 'unknown'
          faces.optionalRemoteCandidates.bySource[source] = (faces.optionalRemoteCandidates.bySource[source] || 0) + 1
        }
      }
      if (faceName === 'back') {
        if (descriptor.hasBackArt) faces.backArt += 1
        else faces.genericBack += 1
      }
    }
  }
  faces.optionalRemoteCandidates.bySource = Object.fromEntries(
    Object.keys(faces.optionalRemoteCandidates.bySource).sort()
      .map(source => [source, faces.optionalRemoteCandidates.bySource[source]]))
  return {
    cards,
    unresolved,
    required: { local: [...required.local].sort(), localized: [...required.localized].sort() },
    faces,
  }
}

// ---------------------------------------------------------------------------
// 3. 本地库存 / SHA-256 基线（只读）
// ---------------------------------------------------------------------------

function auditLocalInventory(englishPaths, localizedPaths) {
  const inventory = readJsonMaybe(LOCAL_INVENTORY)
  const digests = readJsonMaybe(IMAGE_DIGESTS)
  const inventoryFiles = new Set(Array.isArray(inventory?.files) ? inventory.files : [])
  const records = (digests && digests.records) || {}
  const fhvEntries = [...inventoryFiles].filter(relative => FHV_IMAGE_PATH.test(relative))
  const verify = [...new Set([...englishPaths, ...fhvEntries.filter(relative => !relative.startsWith(LOCALIZED_PREFIX + '/'))])].sort()
  const missingOnDisk = []
  const missingFromInventory = new Set()
  const missingDigest = []
  const digestMismatch = []
  const byteMismatch = []
  let sha256Verified = 0
  for (const relative of verify) {
    const absolute = join(MOD, IMAGE_ROOT, relative)
    const onDisk = existsSync(absolute)
    if (!onDisk) missingOnDisk.push(relative)
    if (!inventoryFiles.has(relative)) missingFromInventory.add(relative)
    const record = records[relative]
    if (!record) { missingDigest.push(relative); continue }
    if (!onDisk) continue
    const bytes = readFileSync(absolute)
    const digest = sha256(bytes)
    if (bytes.length !== record.bytes) {
      byteMismatch.push({ path: relative, expected: record.bytes, actual: bytes.length })
    }
    if (digest !== record.sha256) {
      digestMismatch.push({ path: relative, expected: record.sha256, actual: digest })
    } else {
      sha256Verified += 1
    }
  }
  const localizedMissingOnDisk = []
  for (const relative of localizedPaths) {
    const zhRelative = `${LOCALIZED_PREFIX}/${relative}`
    if (!existsSync(join(MOD, IMAGE_ROOT, zhRelative))) localizedMissingOnDisk.push(zhRelative)
    if (!inventoryFiles.has(zhRelative)) missingFromInventory.add(zhRelative)
  }
  return {
    inventory: inventory
      ? {
        path: LOCAL_INVENTORY,
        present: true,
        sha256: fileSha256(LOCAL_INVENTORY),
        scope: inventory.scope || null,
        host: inventory.host || null,
        total: inventory.total ?? null,
        bytes: inventory.bytes ?? null,
        fingerprint: inventory.fingerprint || null,
        fhvEntries: {
          total: fhvEntries.length,
          english: fhvEntries.filter(relative => !relative.startsWith(LOCALIZED_PREFIX + '/')).length,
          localized: fhvEntries.filter(relative => relative.startsWith(LOCALIZED_PREFIX + '/')).length,
        },
      }
      : { path: LOCAL_INVENTORY, present: false, sha256: null },
    digests: digests
      ? {
        path: IMAGE_DIGESTS,
        present: true,
        sha256: fileSha256(IMAGE_DIGESTS),
        scope: digests.scope || null,
        records: Object.keys(records).length,
        fhvRecords: Object.keys(records).filter(relative => FHV_IMAGE_PATH.test(relative) && !relative.startsWith(LOCALIZED_PREFIX + '/')).length,
        fhvLocalizedRecords: Object.keys(records).filter(relative => relative.startsWith(LOCALIZED_PREFIX + '/') && FHV_IMAGE_PATH.test(relative)).length,
      }
      : { path: IMAGE_DIGESTS, present: false, sha256: null },
    checked: {
      localFiles: englishPaths.length,
      localizedFiles: localizedPaths.length,
      sha256Verified,
    },
    missingOnDisk: missingOnDisk.sort(),
    missingFromInventory: [...missingFromInventory].sort(),
    missingDigest: missingDigest.sort(),
    digestMismatch,
    byteMismatch,
    localizedMissingOnDisk: localizedMissingOnDisk.sort(),
  }
}

// ---------------------------------------------------------------------------
// 4. 展示数据（本地 Node 侧复算，不跑浏览器套件）
// ---------------------------------------------------------------------------

const referenceRoot = join(WORKSPACE, REFERENCE_MARKER, REFERENCE_CAMPAIGN)

/**
 * 展示映射的来源复算：与 tools/build-presentation.mjs 同一路径规则，
 * 但只比对来源哈希与条数，不重写任何产物（参考目录被 .gitignore 排除，缺失时置 unavailable）。
 */
function auditPresentationMapping(localizedArts, mediaRegistry) {
  const digestPath = join(referenceRoot, REFERENCE_ZH_DIGEST)
  const manifestPath = join(referenceRoot, REFERENCE_IMAGE_MANIFEST)
  if (!existsSync(digestPath) || !existsSync(manifestPath)) {
    return {
      available: false,
      reason: `${REFERENCE_MARKER}/${REFERENCE_CAMPAIGN} 缺失（仓库 .gitignore 排除），无法复算展示映射来源哈希`,
      drift: [],
      excluded: [PRESENTATION_REPORT],
    }
  }
  const digestBytes = readFileSync(digestPath)
  const manifestBytes = readFileSync(manifestPath)
  const entries = JSON.parse(digestBytes.toString('utf8').replace(/^\uFEFF/, ''))
  if (!Array.isArray(entries)) throw new TypeError(`参考中文清单不是数组：${REFERENCE_ZH_DIGEST}`)
  const regenerated = [...new Set(entries
    .filter(entry => typeof entry === 'string')
    .map(entry => entry.replace(/^\//, ''))
    .filter(entry => /^cards\/[0-9a-z]+\.avif$/.test(entry))
    .filter(entry => !RETIRED_LOCALIZED_ARTS.has(entry)))].sort()
  const declared = Array.isArray(localizedArts?.arts) ? localizedArts.arts : []
  const localized = {
    path: 'presentation/localized-arts.json',
    sourcePath: `${REFERENCE_CAMPAIGN}/${REFERENCE_ZH_DIGEST}`,
    sourceSha256: sha256(digestBytes),
    declaredSourceSha256: localizedArts?.source?.sha256 || null,
    sourceMatches: sha256(digestBytes) === localizedArts?.source?.sha256,
    entries: regenerated.length,
    declaredEntries: declared.length,
    artsMatch: regenerated.length === declared.length && regenerated.every((path, index) => path === declared[index]),
  }
  const remoteManifest = {
    path: 'presentation/media-registry.json',
    sourcePath: `${REFERENCE_CAMPAIGN}/${REFERENCE_IMAGE_MANIFEST}`,
    sourceSha256: sha256(manifestBytes),
    declaredSourceSha256: mediaRegistry?.remoteManifest?.sha256 || null,
    sourceMatches: sha256(manifestBytes) === mediaRegistry?.remoteManifest?.sha256,
  }
  const drift = []
  if (!localized.sourceMatches || !localized.artsMatch) drift.push('presentation/localized-arts.json')
  if (!remoteManifest.sourceMatches) drift.push('presentation/media-registry.json')
  return { available: true, reason: null, drift, excluded: [PRESENTATION_REPORT], localizedArts: localized, remoteManifest }
}

function auditPresentation(images, required) {
  const stats = presentationStats()
  const localizedArts = readJsonMaybe('presentation/localized-arts.json')
  const generatedArts = readJsonMaybe('presentation/generated-localized-arts.json')
  const mediaRegistry = readJsonMaybe('presentation/media-registry.json')
  const counts = {
    'presentation/localized-arts.json': Array.isArray(localizedArts?.arts) ? localizedArts.arts.length : null,
    'presentation/generated-localized-arts.json': Array.isArray(generatedArts?.arts) ? generatedArts.arts.length : null,
    'presentation/media-registry.json': mediaRegistry?.remoteManifest?.entries ?? null,
  }
  const artifacts = PRESENTATION_ARTIFACTS.map(path => ({ path, sha256: fileSha256(path), entries: counts[path] }))
  const mapping = auditPresentationMapping(localizedArts, mediaRegistry)
  const generatedFhvEntries = Array.isArray(generatedArts?.arts)
    ? generatedArts.arts.filter(relative => FHV_IMAGE_PATH.test(relative)).length
    : null
  const localizedOnDisk = required.localized.length - images.faces.localizedMissingOnDisk.length
  const report = readJsonMaybe(PRESENTATION_REPORT)
  const resolved = images.cards.filter(row => row.resolved).length
  const local = images.cards.filter(row => row.local).length
  const localized = images.cards.filter(row => row.localized).length
  const fhv = { cards: images.cards.length, resolved, local, localized, localizedFilesOnDisk: localizedOnDisk }
  const pass = stats.cards > 0
    && stats.resolved === stats.cards
    && stats.unresolved.length === 0
    && mapping.available
    && mapping.drift.length === 0
    && fhv.resolved === fhv.cards
    && images.faces.localizedMissingOnDisk.length === 0
  return {
    pass,
    resolution: {
      catalogCards: stats.cards,
      resolved: stats.resolved,
      unresolved: stats.unresolved.length,
      localizedFrontCandidates: stats.localizedFront,
      cardsWithBackArt: stats.withBackArt,
    },
    fhv,
    mapping,
    artifacts,
    generatedFhvEntries,
    ledger: report
      ? {
        path: PRESENTATION_REPORT,
        sha256: fileSha256(PRESENTATION_REPORT),
        phase: report.phase || null,
        schemaVersion: report.schemaVersion ?? null,
        verifiedCounts: report.verifiedCounts || null,
      }
      : null,
    browserSuite: {
      tool: 'tools/check-presentation.mjs',
      status: 'not-run',
      reason: '该入口跑 Playwright/Edge 全量 *.browser.mjs 浏览器套件（分钟到小时级），不在素材审计内运行；'
        + '本轮以 presentationStats() 与映射来源哈希在 Node 侧复算展示解析与映射产物，浏览器展示验收由各阶段账本承担。',
    },
  }
}

// ---------------------------------------------------------------------------
// 5. 披露（已知缺口逐条登记，不掩盖）
// ---------------------------------------------------------------------------

function buildDisclosures({ images, inventory, presentation }) {
  const disclosed = []
  for (const code of images.unresolved) {
    const row = images.cards.find(card => card.code === code)
    disclosed.push({ kind: 'card-image-unresolved', code, reason: row?.unresolvedReason || 'unresolved' })
  }
  const localizedCodes = images.cards.filter(row => row.resolved && !row.localized).map(row => row.code)
  if (localizedCodes.length) {
    disclosed.push({
      kind: 'localized-front-missing',
      codes: localizedCodes,
      detail: '这些记录正面没有已声明的中文图，按英文图展示；其余记录的中文图均在本地图库中',
    })
  }
  if (inventory.digests.present && inventory.checked.localizedFiles > 0 && inventory.digests.fhvLocalizedRecords === 0) {
    disclosed.push({
      kind: 'zh-sha-baseline-absent',
      files: inventory.checked.localizedFiles,
      detail: 'audit/image-digests.json 的 SHA-256 基线不含 FHV 的 zh/ 条目（中文图由 AI 汉化流程生成，未回写摘要），'
        + '本审计对中文面只做「文件存在 + 已在 audit/local-images.json 登记」校验，未声称内容摘要已锁定',
    })
  }
  if (images.faces.optionalRemoteCandidates.count > 0) {
    disclosed.push({
      kind: 'optional-remote-candidate',
      count: images.faces.optionalRemoteCandidates.count,
      bySource: images.faces.optionalRemoteCandidates.bySource,
      detail: '这些是末位兜底候选（裸号/替代 a 面回退），既不在本地库存也不保证远程存在（抽样 10501a 远程 404）；'
        + '每张卡的正面与背面首选候选均在本地，兜底候选只有在首选失败后才会被请求',
    })
  }
  if (presentation.generatedFhvEntries) {
    disclosed.push({
      kind: 'generated-localized-art',
      files: presentation.generatedFhvEntries,
      source: 'presentation/generated-localized-arts.json（codex-imagegen AI 汉化）',
      detail: 'FHV 的中文卡图来自 AI 汉化流程，不在参考项目中文清单（presentation/localized-arts.json）内；'
        + '本仓库以本地文件为展示事实源',
    })
  }
  if (presentation.ledger) {
    disclosed.push({
      kind: 'presentation-report-stale',
      path: PRESENTATION_REPORT,
      detail: '该报告是 N2 期产物（verifiedCounts.localImagesCopied=0，早于本地图库），且内嵌 web 文件指纹；'
        + '本轮以 presentation/*.json 复算为准，不把它当门禁依据',
    })
  }
  return disclosed
}

// ---------------------------------------------------------------------------
// 6. 账本
// ---------------------------------------------------------------------------

export function buildFhvAssets() {
  const scopeLedger = readJsonAt(SCOPE_LEDGER)
  const codes = partitionCodes()
  const scopeCodes = new Set(Array.isArray(scopeLedger.codes) ? scopeLedger.codes : [])
  const scope = {
    partitions: {
      fhvCampaign: (partitions.fhvCampaign || []).length,
      fhvInvestigators: (partitions.fhvInvestigators || []).length,
      fhvPlayer: (partitions.fhvPlayer || []).length,
    },
    records: codes.length,
    scopeLedger: SCOPE_LEDGER,
    scopeMatches: codes.every(code => scopeCodes.has(code)) && scopeCodes.size === codes.length,
    missingFromScope: codes.filter(code => !scopeCodes.has(code)),
    missingFromPartitions: [...scopeCodes].filter(code => !codes.includes(code)).sort(),
    catalogMissing: codes.filter(code => !Object.hasOwn(ALL_CARDS, code)),
  }

  const images = auditImages(codes)
  const runtimeReferenceHits = scanRuntimeReferenceDependencies()
  const inventory = auditLocalInventory(images.required.local, images.required.localized)
  const presentation = auditPresentation(images, images.required)
  const disclosed = buildDisclosures({ images, inventory, presentation })

  const totals = {
    total: images.cards.length,
    resolved: images.cards.filter(row => row.resolved).length,
    local: images.cards.filter(row => row.local).length,
    remote: images.cards.filter(row => row.remote).length,
    localized: images.cards.filter(row => row.localized).length,
    unresolved: images.unresolved,
  }
  const undisclosedUnresolved = images.unresolved.filter(code =>
    !disclosed.some(entry => entry.kind === 'card-image-unresolved' && entry.code === code))

  const gates = {
    imagesResolved: undisclosedUnresolved.length === 0 && totals.resolved === totals.total,
    mediaComplete: totals.resolved === totals.total
      && images.faces.primaryNotLocal.length === 0
      && images.faces.remoteOnlyFaces.length === 0
      && images.faces.localizedMissingOnDisk.length === 0
      && inventory.missingOnDisk.length === 0
      && inventory.localizedMissingOnDisk.length === 0,
    runtimeIndependent: runtimeReferenceHits.length === 0,
    localInventoryStable: Boolean(inventory.inventory.present && inventory.inventory.fingerprint)
      && inventory.missingFromInventory.length === 0
      && inventory.missingDigest.length === 0
      && inventory.digestMismatch.length === 0
      && inventory.byteMismatch.length === 0,
    presentationClean: presentation.pass,
  }
  const status = Object.values(gates).every(Boolean) ? 'verified' : 'pending'

  return ordered({
    schemaVersion: 1,
    cycle: 'fhv',
    campaignId: 'theFeastOfHemlockVale',
    milestone: 'P8',
    step: 'P8 素材/图片库存与远程回退、展示数据审计',
    generatedBy: 'tools/audit-fhv-assets.mjs',
    status,
    gates,
    scope,
    images: {
      ...totals,
      cards: images.cards,
      faces: images.faces,
      required: {
        localFiles: images.required.local.length,
        localizedFiles: images.required.localized.length,
      },
    },
    runtimeReferenceHits,
    runtimeReferenceScan: {
      roots: [...RUNTIME_ROOTS],
      markers: [REFERENCE_MARKER, 'referenceRoot'],
      kinds: ['module-import', 'fs-read', 'fs-write', 'path-construction'],
      note: '逐行判定 import／require／fs 读取／路径构造；注释与溯源字符串不计（presentation/ 也在扫描内，因为它是卡图解析运行时）',
    },
    localImagesLedger: inventory,
    presentation,
    disclosed,
    sources: SOURCE_FILES.map(path => ({ path, sha256: fileSha256(path) })).filter(source => source.sha256),
  })
}

// ---------------------------------------------------------------------------
// 7. CLI
// ---------------------------------------------------------------------------

function summaryOf(report) {
  return {
    ledger: LEDGER,
    status: report.status,
    gates: report.gates,
    images: {
      total: report.images.total,
      resolved: report.images.resolved,
      local: report.images.local,
      remote: report.images.remote,
      localized: report.images.localized,
      unresolved: report.images.unresolved.length,
    },
    runtimeReferenceHits: report.runtimeReferenceHits.length,
    presentation: { pass: report.presentation.pass, drift: report.presentation.mapping.drift },
    disclosed: report.disclosed.map(entry => entry.kind),
  }
}

function writeLedger(report) {
  mkdirSync(join(MOD, 'audit'), { recursive: true })
  writeFileSync(join(MOD, LEDGER), json(report))
}

/** 只补写本地清单缺失的 FHV 条目：不删除、不改语义、指纹按 fetch-images 的同一算法重算。 */
function writeInventory() {
  const inventory = readJsonMaybe(LOCAL_INVENTORY)
  if (!inventory || !Array.isArray(inventory.files)) {
    throw new Error(`${LOCAL_INVENTORY} 不存在或缺少 files：本工具只补写既有清单，不新建账本`)
  }
  const images = auditImages(partitionCodes())
  const present = new Set(inventory.files)
  const wanted = [
    ...images.required.local,
    ...images.required.localized.map(relative => `${LOCALIZED_PREFIX}/${relative}`),
  ].filter(relative => !present.has(relative)).sort()
  if (!wanted.length) return { mode: 'write-inventory', changed: false, added: [], note: 'FHV 条目已在清单内，未写盘' }
  const files = [...inventory.files]
  const bytesOf = new Map()
  const sizeOf = relative => {
    if (!bytesOf.has(relative)) {
      const absolute = join(MOD, IMAGE_ROOT, relative)
      if (!existsSync(absolute)) throw new Error(`清单条目在本地缺失，不能重算指纹：${IMAGE_ROOT}/${relative}`)
      bytesOf.set(relative, statSync(absolute).size)
    }
    return bytesOf.get(relative)
  }
  for (const relative of wanted) {
    const index = files.findIndex(existing => existing > relative)
    files.splice(index === -1 ? files.length : index, 0, relative)
  }
  const next = {
    ...inventory,
    total: files.length,
    bytes: files.reduce((sum, relative) => sum + sizeOf(relative), 0),
    byLanguage: {
      en: files.filter(relative => !relative.startsWith(LOCALIZED_PREFIX + '/')).length,
      zh: files.filter(relative => relative.startsWith(LOCALIZED_PREFIX + '/')).length,
    },
    fingerprint: sha256(files.map(relative => relative + ':' + sizeOf(relative)).join('\n')),
    files,
  }
  writeFileSync(join(MOD, LOCAL_INVENTORY), JSON.stringify(next, null, 1) + '\n')
  return { mode: 'write-inventory', changed: true, added: wanted, total: files.length, fingerprint: next.fingerprint }
}

/** 抽样 HEAD 远程主面：只打印证据，不写账本（远程可达性不是发布事实源）。 */
async function probeRemote(sampleSize = 8) {
  const codes = partitionCodes()
  const size = Math.max(1, Math.min(24, Number(sampleSize) || 8))
  const step = Math.max(1, Math.floor(codes.length / size))
  const picks = codes.filter((_, index) => index % step === 0).slice(0, size)
  const targets = []
  for (const code of picks) {
    const descriptor = imageDescriptor(code)
    if (!descriptor) continue
    const front = descriptor.front.candidates[0]
    targets.push({ code, face: 'front', path: front.path, url: `${DEFAULT_IMAGE_HOST}/${remoteImagePath(front.path)}` })
    if (front.localized) {
      targets.push({ code, face: 'front-zh', path: `${LOCALIZED_PREFIX}/${front.path}`, url: `${DEFAULT_IMAGE_HOST}/${remoteImagePath(`${LOCALIZED_PREFIX}/${front.path}`)}` })
    }
  }
  const results = []
  for (const target of targets) {
    try {
      const response = await fetch(target.url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })
      results.push({ ...target, status: response.status, bytes: Number(response.headers.get('content-length') || 0) || null })
    } catch (error) {
      results.push({ ...target, status: null, error: errorLine(error) })
    }
  }
  return {
    mode: 'probe-remote',
    host: DEFAULT_IMAGE_HOST,
    sampled: results.length,
    ok: results.filter(row => row.status === 200).length,
    missing: results.filter(row => row.status === 404).length,
    failed: results.filter(row => row.status === null).length,
    results,
    note: 'HEAD 抽样只说明该时刻的可达性；发布的离线性以本地库存为准',
  }
}

async function main(argv) {
  const flags = argv.filter(argument => argument.startsWith('--'))
  const unknown = flags.filter(flag => !['--write', '--check', '--write-inventory'].includes(flag.split('=')[0])
    && !flag.startsWith('--probe-remote'))
  if (unknown.length) throw new RangeError('未知参数：' + unknown.join('、'))
  const modes = flags.filter(flag => !flag.startsWith('--probe-remote'))
  if (modes.length > 1) throw new RangeError('--write、--check、--write-inventory 只能选一个')
  const probeFlag = flags.find(flag => flag.startsWith('--probe-remote'))

  if (modes[0] === '--write-inventory') {
    console.log(JSON.stringify(writeInventory(), null, 2))
    return 0
  }
  if (probeFlag) {
    console.log(JSON.stringify(await probeRemote(probeFlag.split('=')[1]), null, 2))
    return 0
  }

  const report = buildFhvAssets()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)

  if (modes[0] === '--write') {
    writeLedger(report)
    console.log(JSON.stringify({ ...summaryOf(report), mode: 'write', file: LEDGER }, null, 2))
    if (report.status !== 'verified') throw new Error(`fhv assets 门禁未通过（status=${report.status}）：${failed.join('、')}`)
    return 0
  }
  if (modes[0] === '--check') {
    if (!existsAt(LEDGER)) throw new Error(`${LEDGER} 不存在：先跑 node tools/audit-fhv-assets.mjs --write`)
    const expected = json(report)
    const actual = readTextAt(LEDGER)
    if (actual !== expected) throw new Error(`${LEDGER} 漂移：复算内容与账本不一致，请显式 --write`)
    if (report.status !== 'verified') throw new Error(`fhv assets 账本 status=${report.status}，发布门禁必须 verified：${failed.join('、')}`)
    console.log(JSON.stringify({ ...summaryOf(report), mode: 'check', bytes: Buffer.byteLength(actual) }, null, 2))
    return 0
  }
  console.log(JSON.stringify(report, null, 2))
  return report.status === 'verified' ? 0 : 1
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isCli) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(errorLine(error))
    process.exitCode = 1
  }
}
