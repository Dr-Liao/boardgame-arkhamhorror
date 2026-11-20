import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { cardRuleIds } from '../web/rulebook-data.js'
import { TDC_KEYWORD_PATTERNS, TDC_RULES } from '../web/tdc-rules.js'
import { guideRoot, mod, sha, writeOrCheck } from './scan-tdc-scope.mjs'

const ledgerPath = 'audit/tdc-rules.json'
const reportDir = 'artifacts/migration/tdc/reports/'
const readProject = path => readFileSync(join(mod, path), 'utf8')
const readReport = file => readFileSync(join(mod, '../..', reportDir, file))
const scope = JSON.parse(readProject('audit/tdc-scope.json'))
const keywordSource = 'https://images-cdn.fantasyflightgames.com/filer_public/c1/3b/c13b0e74-62bb-49bc-bc85-036ab9d1ef10/ahc84_campaign_guide-web_1.pdf#page=3'
const grimoire = 'https://images-cdn.fantasyflightgames.com/filer_public/76/b3/76b332d5-7047-458f-91b6-82c8500cc445/arkham_grimoire.pdf#page=4'
const nodeFile = 'tests/tdc-rules.test.mjs'
const browserFile = 'tests/tdc-rules.browser.mjs'
const keywords = [
  ['tdcAlert', /\bAlert\./, ['11511', '11637', '11702', '11702b', '11703', '11703b'],
    ['src/engine/combat.js'], [keywordSource, grimoire], 'Alert attacks after a failed evade'],
  ['tdcPatrol', /\bPatrol \(/, ['11537b', '11551', '11670', '11701', '11721'],
    ['src/engine/enemy-keyword-movement.js', 'src/engine/turn.js'], [keywordSource], 'Patrol uses reachable'],
  ['tdcRelentless', /\bRelentless\./, ['11573', '11671', '11674b', '11686', '11725', '11726', '11727', '11744'],
    ['src/engine/enemies.js', 'src/engine/turn.js'], [keywordSource], 'Relentless attempts exactly one additional attack'],
  ['tdcSeal', /\bSeal \(/, ['11028', '11043', '11060', '11070'],
    ['src/engine/seal-entry.js', 'src/engine/play-condition.js', 'src/engine/api-misc.js'], [keywordSource], 'Seal requires a matching token'],
].map(([id, printedPattern, representativeCards, engine, sources, test]) => {
  const linked = scope.codes.filter(code => cardRuleIds(ALL_CARDS[code]).includes(id))
  const printed = scope.codes.filter(code => printedPattern.test(ALL_CARDS[code].text || ''))
  assert.deepEqual(printed, representativeCards, `印刷关键词漂移: ${id}`)
  assert(scope.codes.filter(code => TDC_KEYWORD_PATTERNS[id].test(ALL_CARDS[code].text || ''))
    .every(code => linked.includes(code)), `缺少关键词直达: ${id}`)
  return { id, printedCards: printed, relatedCards: linked.filter(code => !printed.includes(code)), engine, sources, test }
})
const topics = TDC_RULES.map(({ id, related }) => ({
  id, related, linkedCards: scope.codes.filter(code => cardRuleIds(ALL_CARDS[code]).includes(id)).length,
}))
assert(topics.every(topic => topic.linkedCards > 0))
const sourcePaths = ['base', 'interludes', 'theWesternWall', 'obsidianCanyons', 'theDoomOfArkhamPartII']
  .map(name => `${guideRoot}/${name}.json`)
const browserNames = ['desktop', 'mobile'].flatMap(viewport => [
  `P3 ${viewport} zh-CN rulebook`, `P3 ${viewport} en rulebook`, `P3 ${viewport} card link and focus`,
])
const scripts = [nodeFile, browserFile, 'tests/playwright/playwright.tdc.config.mjs',
  'tools/run-tdc-rules-browser.mjs', 'web/tdc-rules.js', 'web/rulebook-data.js', 'web/rulebook.js', 'web/catalog.js',
  'web/card-text.js', 'src/engine/ability.js', 'src/engine/actions.js', ...new Set(keywords.flatMap(item => item.engine))]
const scriptSha256 = Object.fromEntries(scripts.map(file => [file, sha(readProject(file))]))

function recordAcceptance() {
  const browser = readReport('p3-browser.json')
  const browserReport = JSON.parse(browser)
  assert.equal(browserReport.stats.expected, browserNames.length)
  assert.equal(browserReport.stats.unexpected + browserReport.stats.flaky + browserReport.stats.skipped, 0)
  assert.deepEqual(browserReport.suites.flatMap(suite => suite.specs.map(spec => spec.title)), browserNames)
  const node = readReport('p3-node.log')
  const output = node.toString('utf8')
  const nodePassed = Number(/^ℹ pass (\d+)/m.exec(output)?.[1])
  assert(nodePassed >= 14)
  assert.match(output, /^ℹ fail 0\s*$/m)
  for (const { test } of keywords) assert(output.includes('✔ TDC ' + test), test)
  const replay = readReport('p3-replay.log')
  assert(replay.toString('utf8').includes('与基线逐条一致'))
  const fastReport = readReport('p3-fast-accepted.log')
  const summary = fastReport.toString('utf8').match(/^ℹ tests (\d+)\r?\nℹ suites \d+\r?\nℹ pass (\d+)\r?\nℹ fail (\d+)\r?\nℹ cancelled (\d+)\r?\nℹ skipped (\d+)/m)
  assert(summary, '缺少快速回归汇总')
  const [tests, passed, failed, cancelled, skipped] = summary.slice(1).map(Number)
  assert(failed === 0 && cancelled === 0 && tests === passed + skipped)
  return { nodePassed, browserCases: browserNames, replayMatches: true,
    fast: { tests, passed, failed, cancelled, skipped }, scriptSha256,
    artifacts: Object.fromEntries([['p3-node.log', node], ['p3-browser.json', browser], ['p3-replay.log', replay],
      ['p3-fast-accepted.log', fastReport]]
      .map(([file, data]) => [reportDir + file, sha(data)])) }
}

const mode = process.argv[2]
const acceptance = mode === '--record' ? recordAcceptance() : JSON.parse(readProject(ledgerPath)).acceptance
assert.deepEqual(acceptance.scriptSha256, scriptSha256, '规则源码或验收用例有变更，请复跑后记录验收')
assert.deepEqual(acceptance.browserCases, browserNames)
assert(acceptance.nodePassed >= 14 && acceptance.replayMatches)
assert(acceptance.fast?.failed === 0 && acceptance.fast.cancelled === 0)
const ledger = { schemaVersion: 1, campaignId: scope.campaignId, scope: 'audit/tdc-scope.json',
  sources: { officialGuide: keywordSource, referenceGuides: sourcePaths },
  web: 'web/tdc-rules.js', tests: { node: nodeFile, browser: browserFile }, keywords, topics, acceptance }
writeOrCheck(ledgerPath, ledger, mode === '--record' ? '--write' : mode)
console.log(`TDC P3 · ${keywords.length} 个关键词 · ${topics.length} 个规则条目 · ${browserNames.length} 个浏览器用例`)
