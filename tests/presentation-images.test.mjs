import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { buildImageDescriptor, withExplicitArt, reprintedArt, normalizeArt, GENERIC_BACKS, DECLARED_ART_VARIANTS } from '../presentation/art-rules.js'
import { imageDescriptor, imageResolution, MEDIA_REGISTRY, LOCALIZED_ART_SOURCE, LOCAL_IMAGE_LIBRARY, presentationStats } from '../presentation/images.js'
import { imageCandidates, createImageCache, normalizeImageHost, DEFAULT_IMAGE_HOST } from '../web/images.js'
import { EFFECT_LABELS, AVAILABILITY_LABELS } from '../web/catalog.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const HOST = 'https://example.test'
// 三个卡牌符号字体都拷自参考项目，见 web/fonts/README.txt；少登记一个就会误报成越界媒体。
const SYMBOL_FONTS = ['arkham.ttf', 'arkhamicons.ttf', 'arkhamslim.ttf']
const paths = face => face.candidates.map(candidate => candidate.path)

test('卡图解析优先真实美术编号与关联面，而不是统一加 b 猜测', () => {
  // 末位 a 面候选是参考项目 altFrontImage 的一次兜底（实测 03221 只发布 03221a），首选仍是权威编号。
  assert.deepEqual(paths(imageDescriptor('01001').front), ['cards/01001.avif', 'cards/01001a.avif'])
  assert.deepEqual(paths(imageDescriptor('01001').back), ['cards/01001b.avif'])
  // Audited shipped art: bare code is revealed; b is the unrevealed face.
  assert.deepEqual(paths(imageDescriptor('01111').front), ['cards/01111.avif', 'cards/01111a.avif'])
  assert.deepEqual(paths(imageDescriptor('01111').back), ['cards/01111b.avif'])
  // 议程正面与其敌人背面互为关联面，双向索引让背面卡也能找到自己的另一面。
  assert.deepEqual(paths(imageDescriptor('01121a').back), ['cards/01121b.avif'])
  assert.deepEqual(paths(imageDescriptor('01121b').back), ['cards/01121a.avif', 'cards/01121.avif'])
  assert.equal(imageDescriptor('未知卡号'), null)
})

test('无独立背面美术的卡使用通用卡背，并与有背面的卡区分', () => {
  const player = imageDescriptor('01016')
  assert.equal(player.back.kind, 'generic-back')
  assert.equal(player.hasBackArt, false)
  assert.deepEqual(paths(player.back), [GENERIC_BACKS.player])
  const enemy = imageDescriptor('01119')
  assert.deepEqual(paths(enemy.back), [GENERIC_BACKS.encounter])
  assert.equal(imageDescriptor('01001').hasBackArt, true)
})

test('核心战役地点及变体的已揭示面与未揭示面不混用', () => {
  const locations=Object.values(ALL_CARDS).filter(c=>c.type==='location' && /^01\d{3}$/.test(c.code) && c.doubleSided)
  assert.ok(locations.length>=22)
  for(const card of locations){
    const descriptor=imageDescriptor(card.code)
    assert.equal(descriptor.front.candidates[0].art,normalizeArt(card.imagesrc),card.code+' revealed')
    assert.equal(descriptor.back.candidates[0].art,normalizeArt(card.backimagesrc),card.code+' unrevealed')
    assert.ok(!paths(descriptor.front).some(path=>paths(descriptor.back).includes(path)),card.code+' has disjoint faces')
  }
})

test('美术编号不等于目录卡号：允许 01145b 美术，但不虚构目录卡', () => {
  assert.deepEqual(paths(imageDescriptor('01145').back), ['cards/01145b.avif'])
  assert.equal(imageDescriptor('01145').back.candidates[0].source, 'arkhamdb-backimagesrc')
  assert.equal(Object.hasOwn(ALL_CARDS, '01145b'), false)
})

test('修订核心版遭遇重印沿用原版美术，范围外编号不改写', () => {
  assert.equal(reprintedArt('01610'), '01110')
  assert.equal(reprintedArt('01682b'), '01182b')
  assert.equal(reprintedArt('01603'), '01603')
  assert.equal(reprintedArt('01683'), '01683')
  const descriptor = buildImageDescriptor({ code: '01610', type: 'treachery', doubleSided: false })
  assert.deepEqual(paths(descriptor.front), ['cards/01110.avif', 'cards/01110a.avif'])
  assert.match(descriptor.front.candidates[0].source, /revised-core-reprint/)
})

test('显式美术编号优先，非法编号不猜配', () => {
  const explicit = withExplicitArt(imageDescriptor('01119'), '01119b')
  assert.deepEqual(paths(explicit.front), ['cards/01119b.avif', 'cards/01119.avif', 'cards/01119a.avif'])
  assert.deepEqual(paths(withExplicitArt(imageDescriptor('01119'), '../../etc/passwd').front), ['cards/01119.avif', 'cards/01119a.avif'])
  assert.deepEqual(paths(imageDescriptor('01119', { artId: '冰封食尸鬼' }).front), ['cards/01119.avif', 'cards/01119a.avif'])
  assert.equal(normalizeArt('/bundles/cards/01001b.png'), '01001b')
  assert.equal(normalizeArt('javascript:alert(1)'), null)
})

test('中文清单决定语言候选顺序，缺图回退英文', () => {
  const localized = imageCandidates(imageDescriptor('01001'), { host: HOST, language: 'zh-cn' })
  assert.deepEqual(localized.map(candidate => candidate.language), ['zh', 'zh', 'en', 'en', 'en', 'en'])
  assert.deepEqual(localized.filter(candidate => candidate.origin === 'remote').map(candidate => candidate.url), [
    HOST + '/img/arkham/zh/cards/01001.avif',
    HOST + '/img/arkham/cards/01001.avif',
    HOST + '/img/arkham/cards/01001a.avif',
  ])
  const english = imageCandidates(imageDescriptor('01001'), { host: HOST, language: 'en' })
  assert.ok(english.every(candidate => !candidate.url.includes('/zh/')))
  const missingZh = imageDescriptor('60336')
  assert.equal(missingZh.front.candidates[0].localized, false)
  assert.ok(imageCandidates(missingZh, { host: HOST, language: 'zh-cn' }).every(candidate => !candidate.url.includes('/zh/')))
  const back = imageCandidates(imageDescriptor('01016'), { host: HOST, side: 'back', language: 'zh-cn' })
  assert.deepEqual(back.map(candidate => candidate.path), [GENERIC_BACKS.player, GENERIC_BACKS.player])
  assert.deepEqual(back.map(candidate => candidate.origin), ['local', 'remote'])
  assert.ok(back.every(candidate => candidate.language === 'back'))
})

test('主机可配置、可禁用；非法主机显式报错而不静默拼接', () => {
  assert.equal(normalizeImageHost('https://cdn.test/assets/'), 'https://cdn.test/assets')
  assert.equal(normalizeImageHost(''), '')
  assert.equal(normalizeImageHost(null), '')
  assert.equal(DEFAULT_IMAGE_HOST, 'https://assets.arkhamhorror.app')
  for (const value of ['not a host', 'javascript:alert(1)', 'ftp://cdn.test', 'https://u:p@cdn.test', 'https://cdn.test/?a=1', 'https://cdn.test/#x']) {
    assert.throws(() => normalizeImageHost(value), RangeError, value)
  }
  assert.ok(imageCandidates(imageDescriptor('01001'), { host: '', language: 'zh-cn' }).every(candidate => candidate.origin === 'local'))
  const cached = imageCandidates(imageDescriptor('01001'), { host: DEFAULT_IMAGE_HOST, language: 'zh-cn' })
  assert.equal(cached[0].url, '/mods/arkhamhorror/img/zh/cards/01001.avif?cache=cdn')
  assert.equal(cached[1].url, DEFAULT_IMAGE_HOST + '/img/arkham/zh/cards/01001.avif')
  assert.deepEqual(imageCandidates(null, { host: HOST }), [])
})

test('加载缓存让失败候选有限重试，界面重复重建不会再次请求', () => {
  const cache = createImageCache()
  const candidates = imageCandidates(imageDescriptor('01111'), { host: HOST, language: 'zh-cn' })
  assert.equal(candidates.length, 6)
  assert.equal(cache.next(candidates).url, candidates[0].url)
  cache.fail(candidates[0].url)
  assert.equal(cache.next(candidates).url, candidates[1].url)
  cache.succeed(candidates[1].url)
  for (let i = 0; i < 5; i++) assert.equal(cache.next(candidates).url, candidates[1].url)
  assert.equal(cache.state(candidates[0].url), 'failed')
  assert.equal(cache.state(candidates[2].url), 'unknown')
  for (const candidate of candidates) cache.fail(candidate.url)
  assert.equal(cache.next(candidates), null)
  cache.clear()
  assert.equal(cache.next(candidates).url, candidates[0].url)
})

test('描述符只下发候选与语言标记，不含原始追溯或主机', () => {
  const descriptor = imageDescriptor('01001')
  assert.deepEqual(Object.keys(descriptor).sort(), ['art', 'back', 'code', 'doubleSided', 'front', 'hasBackArt'])
  const serialized = JSON.stringify(descriptor)
  for (const leak of ['provenance', 'rawSources', 'assets.arkhamhorror.app', 'http']) assert.equal(serialized.includes(leak), false, leak)
  assert.deepEqual(Object.keys(descriptor.front.candidates[0]).sort(), ['art', 'local', 'localLocalized', 'localized', 'path', 'source'])
  assert.notEqual(imageDescriptor('01001'), imageDescriptor('01001'))
})

test('全部 5,930 张卡都能解析，且逐类型统计可复核', () => {
  const stats = presentationStats()
  assert.equal(stats.cards, 5930)
  assert.equal(stats.resolved, 5930)
  assert.deepEqual(stats.unresolved, [])
  assert.equal(stats.localizedFront, 3778)
  assert.equal(stats.withBackArt, 2592)
  assert.deepEqual(stats.genericBack, { encounter: 1635, player: 1703 })
  assert.equal(stats.localizedArtEntries, 5065)
  assert.equal(stats.localMediaCopied, 0)
  assert.equal(LOCALIZED_ART_SOURCE.language, 'zh')
  assert.equal(LOCALIZED_ART_SOURCE.urlPrefix, 'img/arkham/zh/')
  assert.equal(imageResolution('01001').imageStatus, 'local')
  assert.equal(imageResolution('未知卡号').imageStatus, 'unresolved')
})

test('媒体许可登记保留，运行时图片仅在 Mod 图库；PNG 验收截图仅在测试目录', () => {
  assert.deepEqual(MEDIA_REGISTRY.localCopies, [])
  assert.equal(MEDIA_REGISTRY.remoteManifest.entries, 30895)
  assert.ok(MEDIA_REGISTRY.remoteManifest.cardArtEntries > 0)
  assert.equal(MEDIA_REGISTRY.genericBacks.localCopy, false)
  for (const exclusion of MEDIA_REGISTRY.exclusions) {
    assert.equal(exclusion.decision, 'not-copied')
    assert.ok(exclusion.reason.length > 8, exclusion.scope)
  }
  assert.ok(MEDIA_REGISTRY.exclusions.some(exclusion => exclusion.scope.includes('audio') && exclusion.licenses.length === 3))
  const media = /\.(avif|webp|png|jpe?g|gif|woff2?|ttf|otf|ogg|mp3)$/i
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(resolve(directory, entry.name)) : media.test(entry.name) ? [resolve(directory, entry.name)] : [])
  // 大厅头像属于宿主资源；其余 public/ 仍不得放 Mod 媒体。
  const avatars = resolve(ROOT, 'public/avatars') + sep
  assert.deepEqual(walk(resolve(ROOT, 'public')).filter(file => !file.startsWith(avatars)), [])
  const library = resolve(ROOT, 'games/arkhamhorror/web/img')
  const audio = resolve(ROOT, 'games/arkhamhorror/web/audio')
  const fonts = resolve(ROOT, 'games/arkhamhorror/web/fonts')
  assert.match(readFileSync(resolve(fonts, 'README.txt'), 'utf8'), /No new license or ownership/)
  for (const name of SYMBOL_FONTS) {
    assert.deepEqual(readFileSync(resolve(fonts, name)), readFileSync(resolve(ROOT, '参考资源/ArkhamHorror-main/frontend/public/fonts', name)))
  }
  assert.match(readFileSync(resolve(audio, 'License.txt'), 'utf8'), /Creative Commons Zero, CC0/)
  const snapshots = resolve(ROOT, 'games/arkhamhorror/tests/p7-release.browser.mjs-snapshots')
  const results = resolve(ROOT, 'games/arkhamhorror/test-results')
  for (const file of walk(resolve(ROOT, 'games/arkhamhorror'))) {
    const testPng = file.endsWith('.png') && [snapshots, results].some(dir => file.startsWith(dir + sep))
    const music = file.startsWith(resolve(audio, 'music') + sep) && file.endsWith('.mp3')
    const symbolFont = SYMBOL_FONTS.some(name => file === resolve(fonts, name))
    assert.ok(file.startsWith(library + sep) || (file.startsWith(audio + sep) && file.endsWith('.ogg')) || music || testPng || symbolFont, file)
  }
})

test('展示资源生成工具默认只读，--check 比对产物，未知参数非零退出', () => {
  const entry = resolve(ROOT, 'games/arkhamhorror/tools/build-presentation.mjs')
  const report = resolve(ROOT, 'games/arkhamhorror/audit/presentation-report.json')
  const before = statSync(report).mtimeMs
  const flags = process.allowedNodeEnvironmentFlags.has('--permission') ? ['--permission', '--allow-fs-read=*'] : []
  const summary = spawnSync(process.execPath, [...flags, entry], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 << 20 })
  assert.equal(summary.status, 0, summary.stderr)
  assert.equal(JSON.parse(summary.stdout).mode, 'summary')
  const checked = spawnSync(process.execPath, [...flags, entry, '--check'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 << 20 })
  assert.equal(checked.status, 0, checked.stdout + checked.stderr)
  assert.deepEqual(JSON.parse(checked.stdout).drift, [])
  assert.equal(statSync(report).mtimeMs, before)
  assert.equal(spawnSync(process.execPath, [entry, '--unknown'], { cwd: ROOT, encoding: 'utf8' }).status, 1)
  assert.equal(spawnSync(process.execPath, [entry, '--write', '--check'], { cwd: ROOT, encoding: 'utf8' }).status, 1)
})

test('显式声明的替代美术按面登记，且不被重印规则回映射', () => {
  // 来源：参考只读 Haskell CardDefs 的 cdArtVariants／cdBackArtVariants（7 张卡、8 个面）。
  assert.deepEqual(Object.entries(DECLARED_ART_VARIANTS).map(([art, variants]) => [art, variants.revised]), [
    ['01115b', '01615b'], ['01145b', '01645b'], ['01149', '01649'], ['01149b', '01649b'],
    ['01153', '01653'], ['01157', '01657'], ['01158', '01658'], ['01174', '01674'],
  ])
  for (const art of ['01615b', '01645b', '01649', '01649b', '01653', '01657', '01658', '01674']) {
    assert.equal(reprintedArt(art), art, art)
  }
  const parlor = imageDescriptor('01115')
  assert.deepEqual(paths(parlor.front), ['cards/01115.avif', 'cards/01115a.avif'])
  assert.equal(parlor.back.variants.revised.path, 'cards/01615b.avif')
  assert.deepEqual(parlor.front.variants, {})
  const mainPath = imageDescriptor('01149')
  assert.equal(mainPath.front.variants.revised.path, 'cards/01649.avif')
  assert.equal(mainPath.back.variants.revised.path, 'cards/01649b.avif')
  assert.deepEqual(imageDescriptor('01016').front.variants, {})
  assert.deepEqual(imageDescriptor('01016').back.variants, {})
  // 替代美术只有英文图，中文清单没有收录，不能标成中文可用。
  assert.equal(mainPath.front.variants.revised.localized, false)
})

test('替代美术偏好优先，未声明变体的面保持原画', () => {
  const remotePaths = candidates => candidates.filter(candidate => candidate.origin === 'remote').map(candidate => candidate.path)
  const revised = imageCandidates(imageDescriptor('01149'), { host: HOST, language: 'en', variant: 'revised' })
  assert.equal(revised[0].path, 'cards/01649.avif')
  assert.equal(revised[0].source, 'declared-variant-revised')
  const back = imageCandidates(imageDescriptor('01149'), { host: HOST, side: 'back', language: 'en', variant: 'revised' })
  assert.equal(back[0].path, 'cards/01649b.avif')
  const original = imageCandidates(imageDescriptor('01149'), { host: HOST, language: 'en' })
  assert.equal(original[0].path, 'cards/01149.avif')
  assert.deepEqual(remotePaths(original), ['cards/01149.avif', 'cards/01149a.avif'])
  const untouched = imageCandidates(imageDescriptor('01016'), { host: HOST, language: 'en', variant: 'revised' })
  assert.deepEqual(remotePaths(untouched), ['cards/01016.avif', 'cards/01016a.avif'])
  assert.deepEqual(remotePaths(imageCandidates(imageDescriptor('01149'), { host: HOST, language: 'en', variant: '不存在' })), ['cards/01149.avif', 'cards/01149a.avif'])
})

test('特殊打印面与关联面编号取自数据，不按卡号加 b', () => {
  // 双 a／b 打印面的议程背面是 03276ab、03279bb，而不是 03276b。
  assert.deepEqual(paths(imageDescriptor('03276a').back), ['cards/03276ab.avif'])
  assert.deepEqual(paths(imageDescriptor('03279b').back), ['cards/03279bb.avif'])
  // 82019 的关联面是 82017b，不能推断成 82019b。
  assert.deepEqual(paths(imageDescriptor('82019').back), ['cards/82017b.avif'])
  // 03065b 声明为单面且关联回 03065，不得按「自身即背面」交换正反。
  assert.deepEqual(paths(imageDescriptor('03065b').front), ['cards/03065b.avif'])
  assert.deepEqual(paths(imageDescriptor('03065b').back), ['cards/03065.avif'])
})

test('实现状态与可用性取值与目录一致，展示层有对应中文标签', () => {
  const effects = new Set(), availabilities = new Set()
  for (const card of Object.values(ALL_CARDS)) { effects.add(card.effectStatus); availabilities.add(card.availability) }
    assert.deepEqual([...effects].sort(), ['unimplemented', 'verified'])
    assert.deepEqual([...availabilities].sort(), ['catalog-only', 'strict'])
  for (const value of effects) assert.ok(EFFECT_LABELS[value], value)
  for (const value of availabilities) assert.ok(AVAILABILITY_LABELS[value], value)
})

test('本地图库覆盖全部卡面，候选优先同源地址并可离线使用', () => {
  assert.equal(LOCAL_IMAGE_LIBRARY.available, true)
  assert.equal(LOCAL_IMAGE_LIBRARY.total, 13245)
  assert.deepEqual(LOCAL_IMAGE_LIBRARY.byLanguage, { en: 8180, zh: 5065 })

  let local = 0
  const remote = []
  for (const code of Object.keys(ALL_CARDS)) {
    if (imageResolution(code).imageStatus === 'local') local++
    else remote.push(code)
  }
  assert.equal(local, 5929)
  // 60336 是仅存在于旧后端快照的兼容编号，资产主机上也没有这张图（实测 404）。
  assert.deepEqual(remote, ['60336'])

  const online = imageCandidates(imageDescriptor('01001'), { host: HOST, language: 'zh-cn' })
  assert.deepEqual(online.map(candidate => candidate.origin), ['local', 'remote', 'local', 'remote', 'local', 'remote'])
  assert.deepEqual(online.filter(candidate => candidate.origin === 'local').map(candidate => candidate.url), [
    '/mods/arkhamhorror/img/zh/cards/01001.avif',
    '/mods/arkhamhorror/img/cards/01001.avif',
    '/mods/arkhamhorror/img/cards/01001a.avif',
  ])
  // 主机留空＝不访问远程，但本地图库仍可用，界面照常出图。
  const offline = imageCandidates(imageDescriptor('01001'), { host: '', language: 'zh-cn' })
  assert.deepEqual(offline.map(candidate => candidate.url), [
    '/mods/arkhamhorror/img/zh/cards/01001.avif',
    '/mods/arkhamhorror/img/cards/01001.avif',
    '/mods/arkhamhorror/img/cards/01001a.avif',
  ])
  assert.ok(offline.every(candidate => candidate.origin === 'local'))
})

test('展示报告记录未验证边界，不把远程候选当成离线可用', () => {
  const report = JSON.parse(readFileSync(resolve(ROOT, 'games/arkhamhorror/audit/presentation-report.json'), 'utf8'))
  assert.equal(report.phase, 'N2')
  assert.equal(report.verifiedCounts.localImagesCopied, 0)
  assert.equal(report.verifiedCounts.remoteImagesVerified, 0)
  assert.equal(report.imageResolution.resolved, 5930)
  assert.ok(report.samples.length >= 8)
  assert.ok(report.presentationVersion.length === 64)
  assert.ok(report.implementationFiles.every(file => typeof file.sha256 === 'string' && file.sha256.length === 64), '展示实现文件指纹缺失')
})
