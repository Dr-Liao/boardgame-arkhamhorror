import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mod, sha, writeOrCheck } from './scan-tdc-scope.mjs'

const target = 'audit/tdc-interactions.json'
const artifacts = 'artifacts/migration/tdc'
const browserSpec = 'tests/tdc-interactions.browser.mjs'
const nodeSpec = 'tests/tdc-primitives.test.mjs'
const read = path => readFileSync(join(mod, path))
const report = file => read(`../../${artifacts}/${file}`)
const files = [
  'src/engine/tdc-interactions.js', 'src/integration/tdc-view.js',
  'web/tdc-interaction-ui.js', 'web/mechanic-ui.js', 'web/mechanic-ui.css',
  'web/scenario-setup-view.js', 'web/table-regions.js',
  nodeSpec, browserSpec, 'tests/tdc-interaction-fixture.mjs',
]
const implementationSha256 = Object.fromEntries(files.map(file => [file, sha(read(file))]))
const cases = [
  ['task', 'task privacy, cancel and retry'],
  ['map', 'routes, glyphs and map'],
  ['board', 'artifact tie and multipart targets'],
  ['guide', 'script ownership and guide recovery'],
]
const viewports = { desktop: [1440, 900], mobile: [390, 844] }
const expected = Object.entries(viewports).flatMap(([viewport, size]) => cases.map(([image, label]) => ({
  title: `P4 ${viewport} ${label}`, screenshot: `p4/screenshots/${viewport}-${image}.png`, size,
})))

function record() {
  const rawBrowser = report('p4/browser.json')
  const browser = JSON.parse(rawBrowser)
  assert.equal(browser.stats.expected, expected.length)
  assert.equal(browser.stats.unexpected + browser.stats.skipped + browser.stats.flaky, 0)
  assert.deepEqual(browser.suites.flatMap(suite => suite.specs.map(spec => spec.title)), expected.map(row => row.title))
  const shots = expected.map(({ title, screenshot, size }) => {
    const png = report(screenshot)
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], size, title)
    return { title, screenshot: `${artifacts}/${screenshot}`, size, sha256: sha(png) }
  })
  const node = report('reports/p4-node.log')
  const nodeLog = node.toString('utf8')
  assert.equal((nodeLog.match(/^✔ TDC P4 /gm) || []).length, 4)
  assert.match(nodeLog, /^ℹ fail 0\s*$/m)
  const replay = report('reports/p4-replay.log')
  assert.equal((replay.toString('utf8').match(/^  ✔ /gm) || []).length, 13)
  assert(replay.toString('utf8').includes('与基线逐条一致'))
  return { nodeCases: 4, replayCases: 13, screenshots: shots, implementationSha256,
    reports: Object.fromEntries(Object.entries({
      'p4/browser.json': rawBrowser, 'reports/p4-node.log': node, 'reports/p4-replay.log': replay,
    }).map(([file, bytes]) => [`${artifacts}/${file}`, sha(bytes)])) }
}

const mode = process.argv[2]
const acceptance = mode === '--record' ? record() : JSON.parse(read(target)).acceptance
assert.deepEqual(acceptance.implementationSha256, implementationSha256, 'P4 实现或用例已变更，请重新验收')
assert.deepEqual(acceptance.screenshots.map(row => row.title), expected.map(row => row.title))
assert.equal(acceptance.nodeCases, 4)
assert.equal(acceptance.replayCases, 13)
writeOrCheck(target, {
  schemaVersion: 1, campaignId: 'theDrownedCity', phase: 'P4', status: 'verified', productionStatus: 'catalog-only',
  node: nodeSpec, browser: browserSpec,
  coverage: ['task', 'routes', 'glyphs', 'artifactAssignment', 'nearestArtifactHandoff', 'dynamicLocations',
    'multipartTargets', 'scriptCard', 'scenarioGuide', 'seatPrivacy', 'cancelResume', 'emptyBlocked', 'retryFocus'],
  acceptance,
}, mode === '--record' ? '--write' : mode)
console.log(`TDC P4 · ${acceptance.nodeCases} 个交互用例 · ${acceptance.screenshots.length} 个浏览器用例 · ${acceptance.replayCases} 局严格回放`)
