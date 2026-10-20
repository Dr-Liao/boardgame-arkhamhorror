// N2 展示资源生成工具：离线、只读参考源，生成卡图语言清单、媒体范围登记与展示报告。
//
//   node games/arkhamhorror/tools/build-presentation.mjs            只读摘要，不写文件
//   node games/arkhamhorror/tools/build-presentation.mjs --write    生成产物
//   node games/arkhamhorror/tools/build-presentation.mjs --check    逐字节比对，漂移时非零退出
//
// 明确边界：本工具不下载、不复制任何图片／字体／音频，也不验证远程资源可达性。
// 「远程候选数」只是可拼出的路径数量，不能当作离线可用数量。

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildImageDescriptor, GENERIC_BACKS } from '../presentation/art-rules.js'
import { ALL_CARDS, META } from '../src/cards/cards-data.js'

const GAME = new URL('../', import.meta.url)
const REFERENCE = new URL('../../../参考资源/ArkhamHorror-main/', import.meta.url)
const PUBLIC_DIR = new URL('../../../public/', import.meta.url)
const SCOPE = JSON.parse(readFileSync(new URL('./audit/migration-scope.json', GAME), 'utf8'))

const LOCALIZED_DIGEST = 'frontend/src/digests/zh.json'
const REMOTE_MANIFEST = 'frontend/image-manifest.json'
const MEDIA_DIRECTORIES = [
  'frontend/public/img/arkham',
  'frontend/public/img/icons',
  'frontend/public/fonts',
  'frontend/public/audio',
]

const sha256 = value => createHash('sha256').update(value).digest('hex')
const ordered = value => Array.isArray(value) ? value.map(ordered)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]))
    : value

function readReference(relative) {
  const url = new URL(relative, REFERENCE)
  const bytes = readFileSync(url)
  return { relative, bytes, sha256: sha256(bytes) }
}

function walk(relative) {
  const root = fileURLToPath(new URL(relative, REFERENCE))
  if (!existsSync(root)) return []
  const files = []
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const child = directory + '/' + entry.name
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile()) files.push({ path: relative + child.slice(root.length).replaceAll('\\', '/'), bytes: statSync(child).size })
    }
  }
  visit(root)
  return files
}

function localizedArtList() {
  const digest = readReference(LOCALIZED_DIGEST)
  const entries = JSON.parse(digest.bytes.toString('utf8'))
  if (!Array.isArray(entries)) throw new TypeError('中文图片清单不是数组：' + LOCALIZED_DIGEST)
  const arts = [...new Set(entries
    .filter(entry => typeof entry === 'string')
    .map(entry => entry.replace(/^\//, ''))
    .filter(entry => /^cards\/[0-9a-z]+\.avif$/.test(entry)))].sort()
  return {
    source: { path: LOCALIZED_DIGEST, sha256: digest.sha256, entries: entries.length, cardArts: arts.length, language: 'zh', urlPrefix: 'img/arkham/zh/' },
    arts,
  }
}

function mediaRegistry() {
  const licenses = new Map(SCOPE.mediaLicenses.map(entry => [entry.path, entry]))
  const manifest = readReference(REMOTE_MANIFEST)
  const manifestEntries = JSON.parse(manifest.bytes.toString('utf8'))
  // 清单是「目录 → 文件路径数组」，必须按叶子路径统计，不能把目录数当候选数。
  const manifestPaths = Object.values(manifestEntries).flatMap(value => Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : [])
  const files = MEDIA_DIRECTORIES.flatMap(walk)
  const groups = {}
  for (const file of files) {
    const directory = file.path.slice(0, file.path.lastIndexOf('/'))
    groups[directory] = (groups[directory] || 0) + 1
  }
  return {
    generatedFrom: { referenceRoot: SCOPE.referenceRoot, directories: MEDIA_DIRECTORIES },
    referenceLocalFiles: { total: files.length, byDirectory: ordered(groups), note: '仅统计上列目录；N0 的 299 个图片口径还包含自制扩展与其他位置，两者不可混用' },
    // 参考项目本地媒体没有再分发许可声明，因此本阶段复制数为 0；缺图一律用文字／样式回退。
    localCopies: [],
    exclusions: [
      { scope: 'frontend/public/img/**', decision: 'not-copied', reason: '参考源未声明图片再分发许可，仅迁移解析规则，卡背等通用图改用文字／CSS 回退' },
      { scope: 'frontend/public/fonts/**', decision: 'not-copied', reason: '字体无许可声明，界面使用系统字体栈，不影响卡牌可读性' },
      { scope: 'frontend/public/audio/**', decision: 'not-copied', reason: '两份 CC0 与一份生成声明已登记，但 N2 没有音频功能需求，不为凑数量复制', licenses: SCOPE.mediaLicenses },
    ],
    genericBacks: {
      files: Object.values(GENERIC_BACKS),
      handling: 'remote-candidate-or-text-fallback',
      localCopy: false,
      licenseStatus: [...new Set(Object.values(GENERIC_BACKS).map(path => licenses.get('frontend/public/img/arkham/' + path)?.status || 'undeclared'))],
    },
    remoteManifest: {
      path: REMOTE_MANIFEST,
      sha256: manifest.sha256,
      directories: Object.keys(manifestEntries).length,
      entries: manifestPaths.length,
      cardArtEntries: manifestPaths.filter(entry => entry.startsWith('img/arkham/cards/')).length,
      note: '远程清单路径不等于本地文件，也未验证可达性；不计入离线可用数',
    },
  }
}

function descriptorStats(localizedArts) {
  const linkedFronts = new Map()
  for (const card of Object.values(ALL_CARDS)) {
    for (const linked of [card.linkedCardCode, card.linkedToCode]) {
      if (typeof linked === 'string' && linked && Object.hasOwn(ALL_CARDS, linked) && !linkedFronts.has(linked)) linkedFronts.set(linked, card.code)
    }
  }
  const stats = {
    cards: 0, resolved: 0, unresolved: [], localizedFront: 0, withBackArt: 0,
    genericBack: { encounter: 0, player: 0 }, byType: {}, candidateSources: {},
    frontCandidateCounts: {}, revisedCoreReprints: [],
  }
  for (const code of Object.keys(ALL_CARDS).sort()) {
    const card = ALL_CARDS[code]
    stats.cards++
    const descriptor = buildImageDescriptor(card, { localizedArts, linkedFronts })
    if (!descriptor) { stats.unresolved.push(code); continue }
    stats.resolved++
    const type = stats.byType[card.type] || (stats.byType[card.type] = { cards: 0, localizedFront: 0, withBackArt: 0 })
    type.cards++
    if (descriptor.front.candidates.some(candidate => candidate.localized)) { stats.localizedFront++; type.localizedFront++ }
    if (descriptor.hasBackArt) { stats.withBackArt++; type.withBackArt++ }
    else stats.genericBack[descriptor.back.candidates[0].path === GENERIC_BACKS.encounter ? 'encounter' : 'player']++
    const count = descriptor.front.candidates.length
    stats.frontCandidateCounts[count] = (stats.frontCandidateCounts[count] || 0) + 1
    for (const candidate of [...descriptor.front.candidates, ...descriptor.back.candidates]) {
      stats.candidateSources[candidate.source] = (stats.candidateSources[candidate.source] || 0) + 1
      if (candidate.source.includes('revised-core-reprint')) stats.revisedCoreReprints.push({ code, path: candidate.path })
    }
  }
  return ordered(stats)
}

const SAMPLE_CODES = Object.freeze(['01001', '01016', '01111', '01119', '01121a', '01121b', '01149', '01104', '01145', '60336'])
const PRESENTATION_FILES = Object.freeze([
  'games/arkhamhorror/presentation/art-rules.js',
  'games/arkhamhorror/presentation/images.js',
  'games/arkhamhorror/src/cards/card-catalog.js',
  'games/arkhamhorror/src/integration/web-api.js',
  'games/arkhamhorror/web/images.js',
  'games/arkhamhorror/web/catalog.js',
  'games/arkhamhorror/web/game-ui.js',
  'games/arkhamhorror/web/hub.js',
  'games/arkhamhorror/web/hub-office.css',
  'games/arkhamhorror/web/table-art.js',
  'games/arkhamhorror/web/table-regions.js',
  'games/arkhamhorror/web/table-components.js',
  'games/arkhamhorror/web/table-presentation.js',
  'games/arkhamhorror/web/noir.css',
  'games/arkhamhorror/web/story-book.css',
  'games/arkhamhorror/web/command-deck.css',
  'games/arkhamhorror/web/card-interactions.js',
  'games/arkhamhorror/web/card-interactions.css',
  'games/arkhamhorror/web/supply-picker.js',
  'games/arkhamhorror/web/table-surface.css',
  'games/arkhamhorror/web/map-layout.js',
])

function fingerprint() {
  const root = new URL('../../../', import.meta.url)
  return PRESENTATION_FILES.map(relative => {
    const url = new URL(relative, root)
    return { path: relative, sha256: existsSync(url) ? sha256(readFileSync(url)) : null }
  })
}

export function buildPresentation() {
  const localized = localizedArtList()
  const localizedArts = new Set(localized.arts)
  const registry = mediaRegistry()
  const linkedFronts = new Map()
  for (const card of Object.values(ALL_CARDS)) {
    for (const linked of [card.linkedCardCode, card.linkedToCode]) {
      if (typeof linked === 'string' && linked && Object.hasOwn(ALL_CARDS, linked) && !linkedFronts.has(linked)) linkedFronts.set(linked, card.code)
    }
  }
  const stats = descriptorStats(localizedArts)
  const files = fingerprint()
  const report = ordered({
    phase: 'N2',
    schemaVersion: 1,
    catalog: { schemaVersion: META.schemaVersion, resourceVersion: META.resourceVersion, total: META.total },
    presentationVersion: sha256(JSON.stringify({ localized: localized.source, registry: registry.remoteManifest, files })),
    localizedArtSource: localized.source,
    media: registry,
    imageResolution: stats,
    samples: SAMPLE_CODES.filter(code => Object.hasOwn(ALL_CARDS, code))
      .map(code => ({ code, descriptor: buildImageDescriptor(ALL_CARDS[code], { localizedArts, linkedFronts }) })),
    implementationFiles: files,
    verifiedCounts: {
      localImagesCopied: 0,
      remoteImagesVerified: 0,
      note: '本阶段没有下载或复制媒体；可展示与缺图数量需由浏览器验收记录，不由候选数推断',
    },
  })
  return {
    'presentation/localized-arts.json': JSON.stringify(ordered(localized), null, 1) + '\n',
    'presentation/media-registry.json': JSON.stringify(ordered(registry), null, 1) + '\n',
    'audit/presentation-report.json': JSON.stringify(report, null, 1) + '\n',
    summary: {
      mode: 'summary',
      catalogCards: stats.cards,
      resolvedDescriptors: stats.resolved,
      unresolved: stats.unresolved.length,
      localizedFrontCandidates: stats.localizedFront,
      cardsWithBackArt: stats.withBackArt,
      genericBacks: stats.genericBack,
      localizedArtEntries: localized.arts.length,
      localImagesCopied: 0,
      remoteManifestEntries: registry.remoteManifest.entries,
      referenceLocalMediaFiles: registry.referenceLocalFiles.total,
      presentationVersion: report.presentationVersion,
    },
  }
}

function main(argv) {
  const modes = argv.filter(argument => argument.startsWith('--'))
  const unknown = modes.filter(mode => !['--write', '--check', '--summary'].includes(mode))
  if (unknown.length || modes.length > 1) {
    console.error('用法：build-presentation.mjs [--write|--check|--summary]')
    return 1
  }
  const { summary, ...artifacts } = buildPresentation()
  const mode = modes[0] || '--summary'
  if (mode === '--write') {
    for (const [relative, content] of Object.entries(artifacts)) writeFileSync(new URL(relative, GAME), content)
    console.log(JSON.stringify({ ...summary, mode: 'write', files: Object.keys(artifacts) }, null, 1))
    return 0
  }
  if (mode === '--check') {
    const drift = Object.entries(artifacts).filter(([relative, content]) => {
      const url = new URL(relative, GAME)
      return !existsSync(url) || readFileSync(url, 'utf8') !== content
    }).map(([relative]) => relative)
    console.log(JSON.stringify({ ...summary, mode: 'check', drift }, null, 1))
    return drift.length ? 1 : 0
  }
  console.log(JSON.stringify(summary, null, 1))
  return 0
}

if (import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) process.exit(main(process.argv.slice(2)))
