import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentRegistry } from '../content/registered.js'
import { missingMechanics } from '../content/mechanics.js'
import { NON_PLAYER_ABILITY_CODES } from '../src/cards/encounter-abilities.js'
import { mod, sha, writeOrCheck } from './scan-tdc-scope.mjs'
import { inspectChapter, inspectFlow } from './tdc-p7-readiness.mjs'

const read = path => readFileSync(join(mod, path))
const readOptional = path => existsSync(join(mod, path)) ? read(path).toString('utf8') : null
const scopeSource = 'audit/tdc-scope.json'
const input = read(scopeSource)
const scope = JSON.parse(input)
const mechanismScan = JSON.parse(read('audit/tdc-mechanism-scan.json'))
const registered = new Map(contentRegistry.listScenarios(scope.campaignId).map(scenario => [scenario.id, scenario]))
const expectedIds = scope.scenarios.map(scenario => scenario.id)
const unscopedScenarioIds = [...registered.keys()].filter(id => !expectedIds.includes(id))
const groupByOwner = codes => Map.groupBy(codes, code => scope.cards[code].group)
const shared = [...groupByOwner(scope.partitions.shared)].map(([group, codes]) => ({
  group, codes, registeredBehaviors: codes.filter(code => NON_PLAYER_ABILITY_CODES.has(code)),
}))
const chapterCodes = groupByOwner(scope.partitions.scenarios)
const scenarios = scope.scenarios.map(source => {
  const scenario = registered.get(source.id)
  const cards = chapterCodes.get(source.group) || []
  return {
    id: source.id, referenceCode: source.code, group: source.group, cards,
    registeredBehaviors: cards.filter(code => NON_PLAYER_ABILITY_CODES.has(code)),
    setupDependencies: source.gather.map(({ group, external, codes }) => ({ group, external, codes })),
    sourceGuideParagraphs: mechanismScan.guides.find(item => item.scenario === source.id)?.paragraphs.length || 0,
    scenarioStatus: scenario?.status || 'catalog-only',
    ...inspectChapter(source, scope.campaignId, scenario, readOptional),
  }
})
assert.equal(scenarios.flatMap(entry => entry.cards).length, scope.partitions.scenarios.length, '专属卡归属不完整')
assert.equal(new Set(scenarios.flatMap(entry => entry.cards)).size, scope.partitions.scenarios.length, '专属卡归属重复')
assert.equal(shared.flatMap(entry => entry.codes).length, scope.partitions.shared.length)
const campaign = contentRegistry.getCampaign(scope.campaignId)
const campaignPack = contentRegistry.getPack('tdcCampaign')
const flowCoverage = inspectFlow(campaign, expectedIds)
const packs = contentRegistry.listPacks().filter(pack => ['playable', 'verified'].includes(pack.status))
const externalReuse = scope.externalEncounterDependencies.map(code => ({
  code,
  compatiblePacks: packs.filter(pack => pack.cards.some(card => card.code === code && card.rulesImplemented
    && !card.blockedReason && !missingMechanics(card.requiredMechanicIds).length)).map(pack => pack.id),
}))
const { replay: baseline } = JSON.parse(read('audit/tdc-baseline.json'))
const { recovered, recoveredSha256 } = baseline.metadataRecovery
assert.equal(sha(read(`../../${baseline.baseline}`)), baseline.baselineSha256)
assert.equal(sha(read(`../../${recovered}`)), recoveredSha256)
const targetedPath = 'artifacts/migration/tdc/p7/targeted-parallel-final.log'
const targetedFile = read(`../../${targetedPath}`)
const targetedLog = targetedFile.toString('utf8')
const targetedCases = Number(/^ℹ pass (\d+)\r?$/m.exec(targetedLog)?.[1])
assert(targetedCases > 0)
assert.match(targetedLog, /^ℹ fail 0\r?$/m)
assert.match(targetedLog, /^ℹ cancelled 0\r?$/m)
assert.match(targetedLog, /^ℹ skipped 0\r?$/m)
const replayPath = 'artifacts/migration/tdc/p7/replay-final-verified.log'
const replayFile = read(`../../${replayPath}`)
const replayLog = replayFile.toString('utf8')
assert(replayLog.split(/\r?\n/, 1)[0].replaceAll('\\', '/').includes(recovered))
const replayCases = [...replayLog.matchAll(/^  ✔ \S+ +([0-9]+) 步 +[a-f\d]+\r?$/gm)]
assert.equal(replayCases.length, baseline.cases)
assert.equal(replayCases.reduce((moves, [, steps]) => moves + Number(steps), 0), baseline.moves)
assert.match(replayLog, /与基线逐条一致/)
const fastPath = 'artifacts/migration/tdc/p7/fast-final-verified.log'
const fastFile = read(`../../${fastPath}`)
const fastLog = fastFile.toString('utf8')
const fastCounts = Object.fromEntries([...fastLog.matchAll(/^ℹ (tests|pass|fail|cancelled|skipped) (\d+)\r?$/gm)]
  .map(([, key, count]) => [key, Number(count)]))
assert(fastCounts.tests > 0)
assert.equal(fastCounts.fail, 0)
assert.equal(fastCounts.cancelled, 0)
assert.equal(fastCounts.pass + fastCounts.skipped, fastCounts.tests)
const counts = {
  sharedGroups: shared.length,
  sharedCards: scope.partitions.shared.length,
  sharedBehaviorsRegistered: shared.flatMap(group => group.registeredBehaviors).length,
  scenarioCards: scope.partitions.scenarios.length,
  scenarioBehaviorsRegistered: scenarios.flatMap(scenario => scenario.registeredBehaviors).length,
  scenarios: scenarios.length,
  scenariosRegistered: scenarios.filter(scenario => scenario.definition === 'registered').length,
  bilingualGuides: scenarios.filter(scenario => scenario.guide).length,
  externalDependenciesCovered: externalReuse.filter(dependency => dependency.compatiblePacks.length).length,
}
const ownedContentInputsPending = []
if (!campaignPack) ownedContentInputsPending.push('campaignPackManifest')
if (counts.scenariosRegistered !== counts.scenarios || unscopedScenarioIds.length) ownedContentInputsPending.push('scenarioDefinitionsAndLayouts')
// Descriptor presence inventories entries but cannot confirm scenario encounter behavior.
ownedContentInputsPending.push('encounterContent')
if (!flowCoverage.terminalReachable || flowCoverage.missingChapters.length) ownedContentInputsPending.push('campaignFlowContent')
if (counts.bilingualGuides !== counts.scenarios) ownedContentInputsPending.push('bilingualGuides')
writeOrCheck('audit/tdc-p7.json', {
  schemaVersion: 1,
  campaignId: scope.campaignId,
  phase: 'P7',
  status: 'implementation-in-progress',
  scope: { path: scopeSource, sha256: sha(input) },
  counts, shared, scenarios, unscopedScenarioIds,
  campaignPackStatus: campaignPack?.status ?? null,
  campaignFlowRegistered: flowCoverage.explicit,
  flowCoverage,
  verification: {
    infrastructure: { command: 'npm run test:tdc:p7', report: targetedPath, sha256: sha(targetedFile), cases: targetedCases },
    fast: { report: fastPath, sha256: sha(fastFile), ...fastCounts },
    replay: { report: replayPath, sha256: sha(replayFile), cases: replayCases.length, moves: baseline.moves,
      originalBaseline: baseline.baseline, originalBaselineSha256: baseline.baselineSha256,
      baseline: recovered, baselineSha256: recoveredSha256 },
  },
  externalEncounterDependencies: scope.externalEncounterDependencies,
  externalReuse,
  ownedContentInputsPending,
}, process.argv[2])
console.log(`TDC P7 · ${counts.sharedGroups} 组共享遭遇 · ${counts.scenariosRegistered}/${counts.scenarios} 个剧本已注册 · ${counts.bilingualGuides} 份双语指南`)
