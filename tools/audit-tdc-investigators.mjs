import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { CARD_ABILITY_CODES } from '../src/cards/card-abilities.js'
import { investigatorIdentity } from '../src/deck/investigator-identity.js'
import { canSelectInvestigator, getAvailability, isCardAvailable } from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList, deckBuilderData } from '../src/deck/deckbuilding.js'
import { manifest, TDC_INVESTIGATOR_CODES, TDC_DEPENDENCY_CODES } from '../content/packs/tdcInvestigators/manifest.js'
import { mod, sha, writeOrCheck } from './scan-tdc-scope.mjs'

const target = 'audit/tdc-investigators.json'
const artifacts = 'artifacts/migration/tdc'
const read = path => readFileSync(join(mod, path))
const scope = JSON.parse(read('audit/tdc-scope.json'))
const builder = deckBuilderData()
const builderInvestigators = new Map(builder.investigators.map(inv => [inv.code, inv]))
const builderCards = new Set(builder.cardPool.map(card => card.code))
const identities = new Map()
const entries = [...TDC_INVESTIGATOR_CODES, ...TDC_DEPENDENCY_CODES]
const nodeSpec = 'tests/tdc-investigators.test.mjs'
const browserSpec = 'tests/tdc-investigators.browser.mjs'

function inspectVersion(code, dependencies) {
  const def = INVESTIGATORS[code]
  assert(def?.deckRequirements?.size && dependencies?.length, code)
  const requirements = Object.entries(def.deckRequirements.card)
  assert.deepEqual(requirements.map(([primary]) => primary), def.deckRequirements.signatureCards, code)
  assert.deepEqual(requirements.map(([, choices]) => Object.keys(choices).sort()), dependencies, code)
  for (const [primary, choices] of requirements) {
    const primaryCard = ALL_CARDS[primary]
    assert(Object.hasOwn(choices, primary) && primaryCard, primary)
    for (const alternative of Object.keys(choices)) {
      const card = ALL_CARDS[alternative]
      assert(card?.signatureFor?.includes(code), code + ': ' + alternative)
      assert.equal(card.subtype, primaryCard.subtype, primary + ': ' + alternative)
      assert(card.subtype === 'weakness' || ['asset', 'event', 'skill'].includes(card.type), alternative)
      assert(isCardAvailable(alternative, 'strict') && getAvailability(alternative).dependencyOnly, alternative)
      assert(!builderCards.has(alternative), alternative)
    }
  }
  assert(canSelectInvestigator(code, 'strict') && canSelectInvestigator(code), code)
  const projected = builderInvestigators.get(code)
  const automatic = buildDeck(def, { seed: 'tdc-p5-audit' })
  const manual = buildDeckFromList(def, automatic.playerCards, { seed: 'tdc-p5-audit' })
  assert.deepEqual(manual.errors, [], code)
  assert.deepEqual(manual.playerCards, automatic.playerCards, code)
  assert.deepEqual(manual.signatureCards, automatic.signatureCards, code)
  assert.deepEqual(manual.signatureWeaknesses, automatic.signatureWeaknesses, code)
  assert.equal(automatic.playerCards.length, def.deckRequirements.size, code)
  assert(buildDeckFromList(def, automatic.playerCards.slice(1)).errors.length, code)
  const signatureCards = automatic.signatureCards
  const signatureWeaknesses = automatic.signatureWeaknesses
  assert.deepEqual(projected.signatureCards.map(card => card.code), [...new Set(signatureCards)], code)
  assert.deepEqual(projected.signatureWeaknesses.map(card => card.code), [...new Set(signatureWeaknesses)], code)
  return { code, dependencies, deckSize: def.deckRequirements.size, signatureCards, signatureWeaknesses, selectable: true }
}

for (const code of scope.partitions.investigators) {
  const result = inspectVersion(code, scope.investigatorDependencies[code])
  const key = investigatorIdentity(code)
  const group = identities.get(key) || []
  group.push(result)
  identities.set(key, group)
}
const relatedEditions = scope.reprintCandidates.flatMap(({ code, matches, differingDeckRequirements }) =>
  differingDeckRequirements || !Object.hasOwn(scope.investigatorDependencies, code) ? [] : matches.map(related => {
    assert.equal(investigatorIdentity(related), investigatorIdentity(code), related)
    return { relatedTo: code, ...inspectVersion(related, scope.investigatorDependencies[code]) }
  }))
assert.deepEqual(relatedEditions.map(({ code }) => code).sort(), scope.crossPackInvestigatorCodes.filter(code => INVESTIGATORS[code]))
assert.equal(identities.size, 6)
assert.equal(scope.partitions.investigators.length, 7)
assert.equal(new Set(entries).size, 22)
assert.deepEqual(manifest.cards.map(card => card.code).sort(), [...entries].sort())
assert(entries.every(code => CARD_ABILITY_CODES.has(code)))
assert(scope.partitions.scenarios.every(code => getAvailability(code).availability === 'catalog-only'))

const implementations = [
  ...entries.map(code => 'src/cards/entries/' + code + '.js'),
  'src/deck/availability.js', 'src/deck/deckbuilding.js', 'web/deck-rules.js',
  'src/engine/ability-rules.js', 'src/engine/ability.js', 'src/engine/actions.js', 'src/engine/asset-search-play.js', 'src/engine/assets.js',
  'src/engine/api-clue.js', 'src/engine/api-mechanics.js', 'src/engine/api-test.js',
  'src/engine/chaos-bag.js', 'src/engine/combat.js', 'src/engine/commit-origins.js', 'src/engine/deck-ops.js',
  'src/engine/discard-costs.js', 'src/engine/encounter.js', 'src/engine/encounter-look.js', 'src/engine/engine.js',
  'src/engine/limits.js', 'src/engine/locations.js', 'src/engine/play-attempt.js', 'src/engine/play-channels.js',
  'src/engine/reveal.js', 'src/engine/setup.js', 'src/engine/stats.js', 'src/engine/tests.js',
  'src/engine/turn-flow.js', 'src/engine/turn.js', 'src/engine/uses.js', 'src/engine/windows.js',
  'content/packs/tdcInvestigators/manifest.js', nodeSpec, browserSpec,
]
const implementationSha256 = Object.fromEntries(implementations.map(file => [file, sha(read(file))]))
const report = file => read('../../' + artifacts + '/' + file)
const specs = suite => [...(suite.specs || []), ...(suite.suites || []).flatMap(specs)]
const expected = [['desktop', 1440, 900], ['mobile', 390, 844]].flatMap(([device, width, height]) =>
  TDC_INVESTIGATOR_CODES.map(code => ({ device, code, size: [width, height] })))

function record() {
  const rawBrowser = report('p5/browser.json')
  const browser = JSON.parse(rawBrowser)
  const browserSpecs = browser.suites.flatMap(specs)
  assert.equal(browser.stats.expected, expected.length)
  assert.equal(browser.stats.unexpected + browser.stats.skipped + browser.stats.flaky, 0)
  assert.deepEqual(browserSpecs.map(spec => spec.title), expected.map(row => row.code))
  assert(browserSpecs.every(spec => spec.ok))
  const screenshots = expected.map(({ device, code, size }) => {
    const screenshot = 'p5/screenshots/' + device + '-' + code + '.png'
    const png = report(screenshot)
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], size, screenshot)
    return { device, code, path: artifacts + '/' + screenshot, size, sha256: sha(png) }
  })
  const nodeFile = 'reports/p5-investigators-targeted.log'
  const replayFile = 'reports/p5-investigators-replay-before-shared-edits.log'
  const latestReplayFile = 'reports/p5-investigators-replay.log'
  const fastFile = 'reports/p5-investigators-fast-verified.log'
  const node = report(nodeFile)
  const replay = report(replayFile)
  const latestReplay = report(latestReplayFile)
  const fast = report(fastFile)
  const nodeLog = node.toString('utf8')
  const replayLog = replay.toString('utf8')
  assert.match(nodeLog, /^ℹ fail 0\s*$/m)
  const nodeCases = Number(nodeLog.match(/^ℹ pass (\d+)/m)?.[1])
  assert(nodeCases >= 17)
  assert.equal((replayLog.match(/^  ✔ /gm) || []).length, 13)
  assert(replayLog.includes('与基线逐条一致'))
  const latestReplayLog = latestReplay.toString('utf8')
  const latestReplayPassed = (latestReplayLog.match(/^  ✔ /gm) || []).length
  const latestReplayFailures = [...latestReplayLog.matchAll(/^  ✖ (\S+)/gm)].map(match => match[1])
  assert.equal(latestReplayPassed + latestReplayFailures.length, 13)
  const fastLog = fast.toString('utf8')
  assert.match(fastLog, /^ℹ fail 0\s*$/m)
  assert.match(fastLog, /^ℹ cancelled 0\s*$/m)
  const passed = Number(fastLog.match(/^ℹ pass (\d+)/m)?.[1])
  const skipped = Number(fastLog.match(/^ℹ skipped (\d+)/m)?.[1])
  assert.equal(passed + skipped, Number(fastLog.match(/^ℹ tests (\d+)/m)?.[1]))
  assert(passed > nodeCases)
  return { nodeCases, replayCases: 13, browserCases: expected.length, fast: { passed, skipped },
    latestReplay: { passed: latestReplayPassed, failures: latestReplayFailures }, screenshots, implementationSha256,
    reports: Object.fromEntries(Object.entries({ [nodeFile]: node, [replayFile]: replay, [latestReplayFile]: latestReplay, [fastFile]: fast, 'p5/browser.json': rawBrowser })
      .map(([file, data]) => [artifacts + '/' + file, sha(data)])) }
}

const mode = process.argv[2]
const acceptance = mode === '--record' ? record() : JSON.parse(read(target)).acceptance
assert.deepEqual(acceptance.implementationSha256, implementationSha256, 'P5 实现或用例已变更，请重新验收')
assert.deepEqual(acceptance.screenshots.map(({ device, code, size }) => ({ device, code, size })), expected)
assert.equal(acceptance.replayCases, 13)
assert.equal(acceptance.latestReplay.passed + acceptance.latestReplay.failures.length, 13)
assert.equal(acceptance.browserCases, expected.length)
assert(acceptance.nodeCases >= 17)
assert(acceptance.fast.passed > acceptance.nodeCases && Number.isInteger(acceptance.fast.skipped))
writeOrCheck(target, {
  schemaVersion: 2, campaignId: scope.campaignId, phase: 'P5', status: 'verified',
  productionStatus: manifest.status, pack: manifest.id, source: 'audit/tdc-scope.json',
  investigators: [...identities.values()], relatedEditions, dependencies: TDC_DEPENDENCY_CODES,
  tests: { behavior: nodeSpec, identity: 'tests/hub-concurrent.test.mjs', browser: browserSpec },
  pending: [], acceptance,
}, mode === '--record' ? '--write' : mode)
console.log('TDC P5 · 6 个调查员身份 · 8 个版本 · 14 张专属依赖 · 台面、构筑和回放通过')

