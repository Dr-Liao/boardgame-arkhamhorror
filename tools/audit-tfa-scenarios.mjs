import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'
import { scenarioZoneReport } from '../content/scenario-manifest.js'
import { TFA_STORY_TEXT } from '../content/campaigns/theForgottenAge/story-text.js'
import { implementedTreacheries, implementedEnemies } from '../content/campaigns/theForgottenAge/encounter-rules.js'

const hash = content => createHash('sha256').update(content).digest('hex')
// 浏览器验收结果由 `npm run test:tfa:rules:browser` 写入；没有产物时按未验收处理。
const browserReport = await readFile(
  new URL('../audit/tfa-browser-acceptance.json', import.meta.url), 'utf8',
).then(JSON.parse).catch(() => null)
const paragraphsIn = value => Array.isArray(value)
  ? value.filter(item => typeof item === 'string')
  : value && typeof value === 'object'
    ? Object.values(value).flatMap(paragraphsIn)
    : []

// 逐章尚未逐条核对的卡面分支。写入迁移审计的 remaining，并让 literalCardBehavior
// 保持 false（规范 5.2：简化分支不得同时标为逐条实现）。
export const SCENARIO_GAPS = {
  theUntamedWilds: [
    '「探索」的失败判定以「抽到的是敌人/诡计」近似，未逐张核对探索地点时的成功条件',
  ],
  theDoomOfEztli: [],
  threadsOfFate: [
    '04124/04132 的目标以「附属敌人是否仍在场」近似，未区分进胜利区与被弃掉',
    '04122b/04130b/04137b 的「与旁人资产互换」用移除剧情资产 + 生成敌人近似',
  ],
  theBoundaryBeyond: [
    '古代地点与现代格位共用桌面坐标，静态地图上会重叠',
  ],
  heartOfTheEldersPart1: [
    'r2 是忠实移植但原版基础流程不可达（仅 ReturnTo 触发）',
  ],
  heartOfTheEldersPart2: [
    '地点强制效果只覆盖「探索放置/进入」路径，卡牌直接放入场不触发',
  ],
  theCityOfArchives: [
    '会谈间槽位的 frontCode 固定，运行期用 locationVariants 换位，身份与卡面可能错位',
  ],
  theDepthsOfYoth: [
    '「收集了一种奇怪的液体」存 scenarioFlags 而非战役记录，粘稠物→钥匙只在本章内生效',
  ],
  shatteredAeons: [
    '「答应伊塔卡/亚历山卓」用 enemy.aloof 近似「蛇族/异教徒不与你交战」',
  ],
  turnBackTime: [
    '无结局把「陷入疯狂」近似为 defeated + 1 点精神创伤',
    '04065「抽 2 张或放 2 点毁灭任意组合」实现为两次独立的 1 点二选一',
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
  const encounterCodes = [
    ...Object.keys(module.scenario.treacheries || {}),
    ...Object.keys(module.scenario.enemies || {}),
  ]
  const declaredImplemented = module.implementedEncounterCodes
    ?? module.behavior.implementedEncounterCodes ?? []
  const implemented = code => implementedTreacheries.has(code) || implementedEnemies.has(code)
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
    storyText: introOk && resolutionsOk,
    saveReplay: testSource.includes('JSON.stringify')
      && testSource.includes('deepEqual'),
    browserAcceptance: Boolean(browserReport) && browserReport.failed === 0
      && browserReport.passed === browserReport.tests,
  }
  items.push({
    id: chapter.id,
    code: chapter.code,
    name: chapter.name,
    status: Object.entries(checks).filter(([key]) => key !== 'browserAcceptance')
      .every(([, value]) => value) ? 'verified' : 'pending',
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
