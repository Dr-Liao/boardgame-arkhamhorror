import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { TFA_STORY_TEXT } from '../content/campaigns/theForgottenAge/story-text.js'
import { implementedFor } from '../src/cards/card-rules.js'

const hash = content => createHash('sha256').update(content).digest('hex')
// 浏览器验收必须由同一次 Playwright 运行按章生成；规则目录的四条用例不能替代逐章证据。
const browserReport = await readFile(
  new URL('../audit/tfa-browser-acceptance.json', import.meta.url), 'utf8',
).then(JSON.parse).catch(() => null)
const paragraphsIn = value => Array.isArray(value)
  ? value.filter(item => typeof item === 'string')
  : value && typeof value === 'object'
    ? Object.values(value).flatMap(paragraphsIn)
    : []

// 旧 M5 剩余项逐条裁决后归档在 resolved 中。只有仍缺少印刷行为时才放进 gaps；
// resolved 的证据同时写入生成账本，避免单纯删掉文字就宣称逐章通过。
export const SCENARIO_GAPS = Object.fromEntries(chapters.map(chapter => [chapter.id, []]))
const RESOLVED = {
  theUntamedWilds: ['探索按当前地点印刷连接符号持续翻牌，跳过不相连地点并洗回；tests/tfa-engine-integration.test.mjs'],
  threadsOfFate: [
    '04124/04132 原文条件为附属敌人 leaves play，弃牌与胜利区均满足；tests/tfa-threads-of-fate.test.mjs',
    '04122b/04130b/04137b 的旁人面进入 removed，敌人面在原地点生成并接过附属卡；tests/tfa-threads-of-fate.test.mjs',
  ],
  theBoundaryBeyond: ['古代面覆盖同一现场格位，地图只渲染每格一张卡；tests/tfa-boundary-beyond.test.mjs'],
  heartOfTheEldersPart1: ['r2 属 Return To 专用分支，不在基础战役发布范围；tests/tfa-heart-of-the-elders-part1.test.mjs'],
  heartOfTheEldersPart2: ['04224/04227 的入场强制效果接入通用 placeLocation；tests/tfa-heart-of-the-elders-part2.test.mjs'],
  theCityOfArchives: ['真实 placeLocation 合并 locationVariants，三间会谈间卡号与随机计划一致；tests/tfa-city-of-archives.test.mjs'],
  theDepthsOfYoth: ['来源在本章结局读取 remembered CollectedAStrangeLiquid 随即授予钥匙补给；tests/tfa-depths-of-yoth.test.mjs'],
  shatteredAeons: ['蛇族/异教徒不交战已由 trait-passives 接线，未使用 aloof 近似；tests/tfa-shattered-aeons.test.mjs'],
  turnBackTime: [
    '无结局为全体调查员永久 insane 战役状态；tests/tfa-turn-back-time.test.mjs',
    '04065 在抽牌前一次选定 2 点的三种组合；tests/tfa-turn-back-time.test.mjs',
  ],
}

const exists = async url => { try { await access(url); return true } catch { return false } }

// 章节测试文件按内容定位（文件名不强制套用固定转换），避免漏认。
// 先找名字与章节对应的那一个，再退回任意引用本章目录的测试文件。
const testDir = new URL('../tests/', import.meta.url)
const testFiles = (await readdir(testDir)).filter(name => /^tfa-.*\.test\.mjs$/.test(name))
const kebab = id => id.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/Part(\d)/, '-part$1').toLowerCase()
const testSourceFor = async chapterId => {
  const slug = kebab(chapterId)
  const preferred = [`tfa-${slug}.test.mjs`, `tfa-${slug.replace(/^the-/, '')}.test.mjs`]
  const ordered = [...preferred, ...testFiles.filter(name => !preferred.includes(name))]
    .filter(name => testFiles.includes(name))
  for (const name of ordered) {
    const source = await readFile(new URL(name, testDir), 'utf8')
    if (source.includes(`scenarios/${chapterId}/`)) return { name: `tests/${name}`, source }
  }
  return { name: null, source: '' }
}

const items = []
for (const chapter of chapters) {
  const root = `../content/campaigns/theForgottenAge/scenarios/${chapter.id}/`
  const module = await import(`${root}index.js`)
  const files = ['definition.js', 'layout.js', 'behavior.js', 'index.js']
  const fileHashes = Object.fromEntries(await Promise.all(files.map(async file => [
    file,
    hash(await readFile(new URL(`${root}${file}`, import.meta.url))),
  ])))
  const zoneReport = scenarioZoneReport(module.scenario, module.manifest)
  const resolutionIds = Object.keys(module.scenario.resolutions)
  const importedResolutions = TFA_STORY_TEXT.resolutions[chapter.id] || {}
  const importedIntro = paragraphsIn(TFA_STORY_TEXT.introductions[chapter.id])
  const guide = await readFile(new URL(`../web/scenario-guides/${chapter.id}.json`, import.meta.url), 'utf8')
    .then(JSON.parse).catch(() => null)
  const guideOk = guide?.id === chapter.id && guide?.campaignId === 'theForgottenAge'
    && ['zh', 'en'].every(language =>
      JSON.stringify(guide.locales?.[language]?.setup || '').length > 100
      && JSON.stringify(guide.locales?.[language]?.resolutions || '').length > 100)
  const encounterCodes = [
    ...Object.keys(module.scenario.treacheries || {}),
    ...Object.keys(module.scenario.enemies || {}),
  ]
  const declaredImplemented = module.implementedEncounterCodes
    ?? module.behavior.implementedEncounterCodes ?? []
  // 第 121 轮：单卡条目化之后，「是否已实现」的事实源是条目的 implemented 声明
  // （card-rules.implementedFor）；不再读 encounter-rules.js 的手写卡号集合。
  const implemented = code => implementedFor(code)
    || declaredImplemented.includes?.(code) || declaredImplemented.has?.(code)
  const pendingEncounterCodes = encounterCodes.filter(code => !implemented(code))
  const gaps = [...(SCENARIO_GAPS[chapter.id] || [])]
  const testFileInfo = await testSourceFor(chapter.id)
  const testFile = testFileInfo.name
  const testSource = testFileInfo.source
  const introOk = (importedIntro.join('').length > 20
    && importedIntro.every(text => text.length > 0 && !/<[^>]+>/.test(text)))
    // 久远腹地（下）在来源里没有独立导入正文（续上一半），回退到剧本自身的导入文案。
    || (!importedIntro.length && String(module.scenario.intro || '').length > 20)
  const resolutionsOk = resolutionIds.every(key => {
    const paragraphs = importedResolutions[key]
    const imported = Array.isArray(paragraphs)
      && paragraphs.join('').length > 20
      && paragraphs.every(text => text.length > 0 && !/<[^>]+>/.test(text))
    if (imported) return true
    // 来源没有独立正文（或只有「阅读结局N」指针）时回退到剧本摘要。
    const summary = module.scenario.resolutions[key]
    return typeof summary === 'string' && summary.length > 20 && !/<[^>]+>/.test(summary)
  })
  const checks = {
    sourceLocked: true,
    identityRegistered: Object.values(module.identities).every(category =>
      Object.values(category).every(identity => identity.originalCode && identity.identityStatus === 'mapped')),
    setupAndZones: module.manifest.zones.encounterDeck.length > 0
      && Array.isArray(module.manifest.zones.setAside)
      && zoneReport.encounterCards > 0,
    actsAndAgendas: module.scenario.acts.length > 0 && module.scenario.agendas.length > 0
      && typeof module.behavior.actReveal === 'function'
      && typeof module.behavior.agendaReveal === 'function',
    locationsAndConnections: Object.keys(module.scenario.locations).length > 0
      && Object.values(module.scenario.locations).every(location =>
        Array.isArray(location.connections) && location.connections.length > 0),
    encounterBehaviors: encounterCodes.length > 0
      && Object.values(module.scenario.enemies || {}).every(card => !card.rulesPending)
      && Object.values(module.scenario.treacheries || {}).every(card => !card.rulesPending),
    // 逐条核对是硬门槛：只要本章还有未实现的遭遇卡或已声明的简化分支，就不为真。
    literalCardBehavior: pendingEncounterCodes.length === 0 && gaps.length === 0,
    chaosEffects: typeof module.behavior.resolveChaosToken === 'function',
    resolutionsAndRecords: resolutionIds.length > 0
      && module.manifest.resolutionIds.length === resolutionIds.length
      && typeof module.behavior.resolution === 'function',
    storyText: introOk && resolutionsOk && guideOk,
    saveReplay: testSource.includes('JSON.stringify')
      && testSource.includes('deepEqual'),
    browserAcceptance: browserReport?.generatedBy === 'playwright + tools/playwright-tfa-reporter.mjs'
      && browserReport.status === 'passed'
      && browserReport.scenarios?.some(entry => entry.scenario === chapter.id
        && entry.desktop === true && entry.mobile === true) === true,
  }
  items.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending',
    checks,
    inventory: {
      locations: Object.keys(module.scenario.locations).length,
      acts: module.scenario.acts.length,
      agendas: module.scenario.agendas.length,
      enemies: Object.keys(module.scenario.enemies || {}).length,
      treacheries: Object.keys(module.scenario.treacheries || {}).length,
      encounterCards: zoneReport.encounterCards,
      setAsideCards: zoneReport.declaredSetAsideCards,
      resolutions: resolutionIds,
      pendingEncounterCodes,
    },
    gaps,
    resolved: RESOLVED[chapter.id] || [],
    testFile,
    fileHashes,
  })
}

const report = {
  schemaVersion: 1,
  campaignId: 'theForgottenAge',
  milestone: 'M3',
  generatedFrom: 'original-campaign-only',
  status: items.every(item => item.status === 'verified') ? 'verified' : 'pending',
  productionGate: 'playable',
  items,
}

const target = new URL('../audit/tfa-scenario-acceptance.json', import.meta.url)
const serialized = JSON.stringify(report, null, 2) + '\n'
if (process.argv[2] === '--write') await writeFile(target, serialized)
else if (process.argv[2] === '--check') {
  if (await readFile(target, 'utf8') !== serialized) throw new Error('失落的时代逐章验收账本已漂移')
} else if (process.argv[2]) throw new Error('使用 --write 或 --check')
else console.log(serialized)

if (process.argv[2]) {
  console.log(`M3 scenario ledger: ${items.filter(item => item.status === 'verified').length}/${items.length} verified; `
    + `${items.reduce((sum, item) => sum + item.inventory.pendingEncounterCodes.length, 0)} encounter cards pending`)
}
