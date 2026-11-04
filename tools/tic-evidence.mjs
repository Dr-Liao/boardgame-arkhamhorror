import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { MOD, sourceLock, walk, readJson, json, sha } from './tic-migration-lib.mjs'
const sources = [
  'tests/ability-layer.test.mjs', 'tests/availability.test.mjs', 'tests/reaction-preferences.test.mjs', 'tests/i18n-dict.test.mjs',
  'package.json', 'tests/suites.mjs', 'tests/node-suite.mjs',
  'tests/tic-player-fixture.mjs', 'tests/tic-player.browser.mjs',
  'tests/tic-player-primitives.test.mjs', 'tests/tic-player-guardian-seeker.test.mjs', 'tests/tic-player-rogue-mystic.test.mjs', 'tests/tic-player-survivor-neutral.test.mjs',
  'tools/audit-tic-player.mjs', 'audit/tic-player-shards.json', 'audit/tic-player-queue.json', 'audit/tic-p6-baseline.json', 'tests/fixtures/replay/tic-p6-baseline.json',
  'src/engine/investigator-mechanics.js', 'tests/tic-investigators.test.mjs', 'tests/tic-investigators.browser.mjs',
  'tools/audit-tic-investigators.mjs', 'audit/tic-p5-baseline.json', 'tests/fixtures/replay/tic-p5-baseline.json',
  'src/engine/mechanic-choices.js', 'src/integration/mechanic-view.js', 'web/mechanic-ui.js', 'web/mechanic-ui.css', 'web/style.css',
  'tests/tic-interactions.test.mjs', 'tests/tic-interaction-fixture.mjs', 'tests/tic-interactions.browser.mjs',
  'tools/audit-tic-interactions.mjs', 'tools/run-tic-interactions-browser.mjs', 'tools/playwright-tic-p4-reporter.mjs', 'tests/playwright/playwright.tic-p4.config.mjs',
  'tests/script-actions-tfa.browser.mjs', 'tests/scenario-guides.browser.mjs', 'web/scenario-setup-view.js', 'web/scenario-setup.css',
  'audit/tic-p4-baseline.json', 'tests/fixtures/replay/tic-p4-baseline.json',
  'src/engine/api-mechanics.js', 'src/engine/mechanic-state.js', 'src/engine/chaos-token-pool.js', 'src/engine/chaos-token-effects.js',
  'src/engine/flood.js', 'src/engine/scenario-keys.js', 'src/engine/vehicles.js', 'src/engine/map-graph.js', 'src/engine/commit-origins.js',
  'src/engine/use-transfer.js', 'src/engine/turn-promises.js', 'src/campaign/record-sets.js',
  'src/engine/engine.js', 'src/engine/tests.js', 'src/engine/turn.js', 'src/engine/turn-flow.js', 'src/engine/movement.js',
  'src/engine/hidden-rules.js', 'src/engine/chaos-bag.js', 'src/engine/scenario-runtime.js', 'src/engine/save-migration.js',
  'src/engine/harm-threat.js', 'src/engine/enemies.js', 'src/engine/phases.js', 'src/engine/windows.js', 'src/engine/actions.js', 'src/engine/deck-ops.js',
  'src/engine/assets.js', 'src/engine/api-enemy.js',
  'content/registry.js', 'content/registered.js', 'content/mechanics.js', 'web/deck-rules.js', 'web/rulebook-data.js', 'web/rulebook.js', 'web/tic-rules.js',
  'web/locales/zh-CN.misc.js', 'web/locales/en.misc.js', 'web/game-ui.js',
  'tests/tic-migration.test.mjs', 'tests/tic-primitives.test.mjs', 'tests/tic-rules.test.mjs', 'tests/tic-rules.browser.mjs',
  'tools/tic-mechanisms.mjs', 'tools/scan-tic-scope.mjs', 'tools/scan-tic-mechanisms.mjs',
  'tools/tic-migration-lib.mjs', 'tools/tic-evidence.mjs', 'tools/verify-tic.mjs', 'tools/audit-tic-primitives.mjs', 'tools/audit-tic.mjs',
  'tools/tic-control-regression.mjs', 'tools/playwright-tic-reporter.mjs', 'tools/run-tic-browser.mjs', 'tests/playwright/playwright.tic.config.mjs',
  'audit/tic-scope.json', 'audit/tic-mechanism-scan.json',
  'tools/replay-fixtures.mjs', 'tools/replay-games.mjs', 'tests/core-fixture.mjs',
  'tests/p0-regressions.test.mjs', 'tests/reprint-aliases.test.mjs', 'tests/tcu-wages-of-sin.test.mjs',
  'tools/tic-replay-snapshot.mjs',
]
// P8 发布收口新增的证据输入：生产注册章节/包、逐章验收生成器、发布浏览器链、P8 Node 验收与重放。
// 这些文件由并行任务创建，生成证据时要求全部存在；为避免半成品阶段让所有 runner 因缺文件抛错，
// 这里只纳入当前已落盘的文件（正式 --write 时它们必须全部存在，缺一个会改变 sourceFiles 并触发重跑）。
const p8Sources = [
  'tools/audit-tic-scenarios.mjs',
  'tools/check-tic-registry.mjs',
  'tools/audit-tic-release.mjs',
  'tools/playwright-tic-release-reporter.mjs',
  'tools/run-tic-release-browser.mjs',
  'tools/replay-tic-recipes.mjs',
  'tools/replay-tic-fixtures.mjs',
  'tests/playwright/playwright.tic-release.config.mjs',
  'tests/tic-browser-helpers.mjs',
  'tests/tic-release.browser.mjs',
  'tests/tic-online.browser.mjs',
  'tests/tic-progression.browser.mjs',
  'tests/tic-p8-fixture.mjs',
  'tests/tic-p8-registration.test.mjs',
  'tests/tic-p8-campaign.test.mjs',
  'tests/tic-p8-multiplayer.test.mjs',
  'tests/replay-tic-p8.test.mjs',
  'tests/replay-tic-p8-recipes.test.mjs',
  'tests/tic-late-b-cards.test.mjs',
  'tests/fixtures/replay/tic-p8-baseline.json',
  'content/campaigns/theInnsmouthConspiracy/chapter-data.json',
  ...['thePitOfDespair', 'theVanishingOfElinaHarper', 'inTooDeep', 'devilReef', 'horrorInHighGear',
    'aLightInTheFog', 'theLairOfDagon', 'intoTheMaelstrom'].map(id => `web/scenario-guides/${id}.json`),
].filter(path => existsSync(join(MOD, path)))
const allSources = [...sources, ...p8Sources]
export function evidenceFiles() {
  // Include transitive server/content code as well: another chat can change an existing reader
  // without touching our new modules. Never let such a change inherit an earlier passing proof.
  const unrelatedGenerated = new Set(['src/cards/tde-campaign-acceptance.js', 'src/cards/tde-player-acceptance.js'])
  return [...new Set([...allSources, ...['src', 'content', 'web'].flatMap(dir => walk(join(MOD, dir))
    .filter(path => /\.(js|css)$/.test(path)).map(path => relative(MOD, path).replaceAll('\\', '/')))])]
    // These two generated acceptance lists are rewritten by the concurrent TDE audit. They are
    // outside this cycle; their failures and legacy behavior are compared with the control run.
    .filter(path => !unrelatedGenerated.has(path)).sort()
}
export const evidenceHashes = () => evidenceFiles().map(path => sourceLock(path, MOD))
export function currentEvidence(reportName) {
  const target = join(MOD, `audit/tic-${reportName}.json`)
  if (!existsSync(target)) return null
  const report = readJson(target)
  return report.status === 'passed' && report.sourceFiles && json(report.sourceFiles) === json(evidenceHashes()) ? report : null
}
