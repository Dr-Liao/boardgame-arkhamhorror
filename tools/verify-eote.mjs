#!/usr/bin/env node
// 七循环《地球边缘》验收证据生成器（P2 起使用）。
//
//   node tools/verify-eote.mjs --node        跑全部 eote Node 专项，写 audit/eote-node-acceptance.json
//   node tools/verify-eote.mjs --regression  跑 test:fast + replay 对比，写 audit/eote-regression.json
//
// 两种模式都记录运行前后「证据源文件」的 SHA-256；若运行期间源码被并发修改则 status=failed
//（迁移规范 §4 的控制跑口径：并发编辑只用于控制对比，不能当作验收证据）。
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MOD, RUN, readJson, sha, json } from './eote-migration-lib.mjs'

// 证据源：本循环的账本、工具、引擎/内容模块、测试与文档。缺失文件不记入（迁移早期可能尚未创建）。
export const EVIDENCE_SOURCES = [
  'audit/eote-scope.json', 'audit/eote-baseline.json', 'audit/eote-mechanism-scan.json',
  'audit/eote-primitive-plan.json', 'audit/eote-primitive-catalog.json',
  'tools/eote-migration-lib.mjs', 'tools/scan-eote-scope.mjs', 'tools/scan-eote-baseline.mjs',
  'tools/scan-eote-mechanisms.mjs', 'tools/eote-mechanisms.mjs', 'tools/eote-mechanism-primitives.mjs',
  'tools/eote-guide-scan.mjs', 'tools/audit-eote-primitives.mjs', 'tools/eote-primitive-spec.mjs', 'tools/verify-eote.mjs',
  'src/engine/eote-state.js', 'src/engine/frost.js', 'src/engine/eote-shelter.js', 'src/engine/eote-camp.js',
  'src/engine/eote-facilities.js', 'src/engine/eote-climb.js', 'src/engine/eote-city.js', 'src/engine/eote-tekeli.js',
  'src/engine/eote-deck-top.js', 'src/engine/eote-round-distance.js', 'src/engine/eote-disciplines.js',
  'src/engine/chaos-token-pool.js', 'src/engine/chaos-token-effects.js', 'src/engine/scenario-keys.js',
  'src/engine/vertical-chain.js', 'src/engine/grid-map.js', 'src/engine/scenario-decks.js',
  'src/engine/physical-faces.js', 'src/engine/play-channels.js', 'src/engine/mechanic-state.js',
  'src/engine/api-mechanics.js', 'src/engine/save-migration.js',
  'src/campaign/eote-partners.js', 'src/campaign/eote-seals.js', 'src/campaign/eote-memorials.js',
  'src/campaign/eote-supplies.js', 'src/campaign/record-sets.js', 'src/campaign/campaign-flow.js',
  'src/campaign/epilogue-matrix.js', 'src/campaign/campaign-parts.js',
  'tests/eote-migration.test.mjs', 'tests/eote-primitives-frost.test.mjs', 'tests/eote-primitives-campaign.test.mjs',
  'tests/eote-primitives-flow.test.mjs', 'tests/eote-primitives-geo.test.mjs', 'tests/eote-primitives-travel.test.mjs',
  'tests/eote-primitives-investigator.test.mjs',
  'tests/fixtures/replay/eote-baseline.json',
  'content/campaigns/edgeOfTheEarth/shared.js', 'content/campaigns/edgeOfTheEarth/manifest.js',
  'content/campaigns/edgeOfTheEarth/keywords.js',
  'web/eote-rules.js', 'web/rulebook-data.js',
  'tools/audit-eote-rules.mjs', 'tools/run-eote-browser.mjs', 'tools/playwright-eote-reporter.mjs',
  'tests/eote-rules.test.mjs', 'tests/eote-rules.browser.mjs', 'tests/playwright/playwright.eote.config.mjs',
  'audit/eote-rules.json', 'audit/eote-browser-acceptance.json',
  // P4（交互与界面）：引擎事务、投影、UI、夹具、浏览器验收与账本。
  'src/engine/eote-interactions.js', 'src/engine/mechanic-choices.js',
  'src/integration/mechanic-view.js', 'web/mechanic-ui.js', 'web/chaos-token.js', 'web/mechanic-ui.css',
  'web/locales/zh-CN.misc.js', 'web/locales/en.misc.js',
  'tools/audit-eote-interactions.mjs', 'tools/run-eote-interactions-browser.mjs', 'tools/playwright-eote-p4-reporter.mjs',
  'tests/eote-interactions.test.mjs', 'tests/eote-interactions.browser.mjs', 'tests/eote-interaction-fixture.mjs',
  'tests/playwright/playwright.eote-p4.config.mjs',
  'audit/eote-interactions.json', 'audit/eote-interactions-browser.json',
  'docs/edgeOfTheEarth/interactions.md',
  // P5（调查员及专属依赖）：条目、构筑接入、引擎读点、测试与账本。
  'src/cards/entries/08001.js',
  'src/cards/entries/08002.js',
  'src/cards/entries/08003.js',
  'src/cards/entries/08004.js',
  'src/cards/entries/08005.js',
  'src/cards/entries/08006.js',
  'src/cards/entries/08007.js',
  'src/cards/entries/08008.js',
  'src/cards/entries/08009.js',
  'src/cards/entries/08010.js',
  'src/cards/entries/08011a.js',
  'src/cards/entries/08011b.js',
  'src/cards/entries/08012a.js',
  'src/cards/entries/08012b.js',
  'src/cards/entries/08013a.js',
  'src/cards/entries/08013b.js',
  'src/cards/entries/08014a.js',
  'src/cards/entries/08014b.js',
  'src/cards/entries/08015.js',
  'src/cards/entries/08016.js',
  'src/cards/entries/08017.js',
  'src/cards/entries/08018.js',
  'content/campaigns/edgeOfTheEarth/investigator-data.js', 'content/packs/eoteInvestigators/manifest.js',
  'src/deck/availability.js', 'src/deck/deckbuilding.js', 'web/deck-rules.js',
  'src/engine/eote-investigator-support.js', 'src/engine/restricted-actions.js',
  // P6（一般玩家卡）：分片行为测试、分片/队列账本、生成码表与浏览器验收账本。
  'tests/eote-player-m2-1.test.mjs',
  'tests/eote-player-m2-2.test.mjs',
  'tests/eote-player-m2-3.test.mjs',
  'tests/eote-player-m2-4.test.mjs',
  'tests/eote-player-primitives.test.mjs',
  'tests/eote-scenario-iceAndDeathPart1.test.mjs',
  'tests/eote-scenario-iceAndDeathPart2.test.mjs',
  'tests/eote-scenario-iceAndDeathPart3.test.mjs',
  'tests/eote-scenario-fatalMirage.test.mjs',
  'tests/eote-scenario-toTheForbiddenPeaks.test.mjs',
  'tests/eote-scenario-cityOfTheElderThings.test.mjs',
  'tests/eote-scenario-theHeartOfMadnessPart1.test.mjs',
  'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs',
  'tests/eote-scenario-shared.test.mjs',
  'tests/eote-campaign-flow.test.mjs',
  'tests/eote-story.test.mjs',
  'tests/eote-all-cards.test.mjs',
  'tests/eote-p8-registration.test.mjs',
  'tests/eote-p8-campaign.test.mjs',
  'tests/eote-p8-multiplayer.test.mjs',
  'tests/replay-eote-p8.test.mjs',
  'tests/eote-migration-ledger.test.mjs',
  'tests/eote-player-fixture.mjs', 'tests/eote-player.browser.mjs',
  'tools/audit-eote-player.mjs', 'tools/run-eote-player-browser.mjs', 'tools/playwright-eote-p6-reporter.mjs',
  'tests/playwright/playwright.eote-p6.config.mjs',
  'audit/eote-player-shards.json', 'audit/eote-player-queue.json', 'audit/eote-player-acceptance.json', 'audit/eote-player-browser.json',
  'src/cards/eote-player-acceptance.js', 'content/packs/eotePlayer/manifest.js', 'docs/edgeOfTheEarth/player-cards.md',
  'tests/eote-investigator-daniela.test.mjs',
  'tests/eote-investigator-norman.test.mjs',
  'tests/eote-investigator-lily.test.mjs',
  'tests/eote-investigator-monterey.test.mjs',
  'tests/eote-investigator-bob.test.mjs',
  'tools/audit-eote-investigators.mjs', 'tools/run-eote-investigators-browser.mjs', 'tools/playwright-eote-p5-reporter.mjs',
  'tests/eote-investigators.browser.mjs', 'tests/playwright/playwright.eote-p5.config.mjs',
  'audit/eote-investigators.json', 'audit/eote-investigators-browser.json',
  // P7（战役）：章节/共享遭遇/流程/指南/浏览器账本与生成器。
  'tools/audit-eote-scenarios.mjs', 'tools/import-eote-story.mjs',
  // P8（地球边缘发布）：逐卡/发布/迁移账本与浏览器发布证据。
  'tools/audit-eote-all-cards.mjs', 'tools/audit-eote-release.mjs', 'tools/audit-eote.mjs',
  'tools/run-eote-release-browser.mjs', 'tools/playwright-eote-release-reporter.mjs',
  'tests/eote-release.browser.mjs', 'tests/eote-progression.browser.mjs', 'tests/eote-online.browser.mjs',
  'tests/eote-browser-helpers.mjs', 'tests/playwright/playwright.eote-p8.config.mjs',
  'audit/eote-all-card-acceptance.json', 'audit/eote-release-browser.json',
  'audit/eote-release-acceptance.json', 'audit/eote-migration.json',
  'tests/fixtures/replay/eote-p8-baseline.json', 'docs/edgeOfTheEarth/p8-release.md', 'tools/import-scenario-guides.mjs',
  'content/campaigns/edgeOfTheEarth/story-text.js', 'content/campaigns/edgeOfTheEarth/story-access.js',
  'content/campaigns/edgeOfTheEarth/flow.js', 'content/campaigns/edgeOfTheEarth/records.js',
  'content/campaigns/edgeOfTheEarth/parts.js', 'content/campaigns/edgeOfTheEarth/shared-encounters.js',
  'content/campaigns/edgeOfTheEarth/manifest.js', 'content/packs/eoteCampaign/manifest.js',
  'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart1/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart2/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/iceAndDeathPart3/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart1/definition.js',
  'content/campaigns/edgeOfTheEarth/scenarios/theHeartOfMadnessPart2/definition.js',
  'audit/eote-scenario-acceptance.json', 'audit/eote-scenarios-browser.json', 'audit/eote-scenario-shards.json',
  'docs/edgeOfTheEarth/scenarios.md',
  'web/scenario-guides/iceAndDeathPart1.json', 'web/scenario-guides/theHeartOfMadnessPart2.json',
  'docs/edgeOfTheEarth/investigators.md',
  'docs/edgeOfTheEarth/primitives.md', 'docs/edgeOfTheEarth/README.md',
]
export const EOTE_NODE_TESTS = [
  'tests/eote-migration.test.mjs',
  'tests/eote-primitives-frost.test.mjs',
  'tests/eote-primitives-campaign.test.mjs',
  'tests/eote-primitives-flow.test.mjs',
  'tests/eote-primitives-geo.test.mjs',
  'tests/eote-primitives-travel.test.mjs',
  'tests/eote-primitives-investigator.test.mjs',
  'tests/eote-rules.test.mjs',
  'tests/eote-interactions.test.mjs',
  'tests/eote-investigator-daniela.test.mjs',
  'tests/eote-investigator-norman.test.mjs',
  'tests/eote-investigator-lily.test.mjs',
  'tests/eote-investigator-monterey.test.mjs',
  'tests/eote-investigator-bob.test.mjs',
  // P6 一般玩家卡（四片 + 原语）。
  'tests/eote-player-m2-1.test.mjs',
  'tests/eote-player-m2-2.test.mjs',
  'tests/eote-player-m2-3.test.mjs',
  'tests/eote-player-m2-4.test.mjs',
  'tests/eote-player-primitives.test.mjs',
  // P7 八章、共享遭遇、战役流程、剧情/指南。
  'tests/eote-scenario-iceAndDeathPart1.test.mjs',
  'tests/eote-scenario-iceAndDeathPart2.test.mjs',
  'tests/eote-scenario-iceAndDeathPart3.test.mjs',
  'tests/eote-scenario-fatalMirage.test.mjs',
  'tests/eote-scenario-toTheForbiddenPeaks.test.mjs',
  'tests/eote-scenario-cityOfTheElderThings.test.mjs',
  'tests/eote-scenario-theHeartOfMadnessPart1.test.mjs',
  'tests/eote-scenario-theHeartOfMadnessPart2.test.mjs',
  'tests/eote-scenario-shared.test.mjs',
  'tests/eote-campaign-flow.test.mjs',
  'tests/eote-story.test.mjs',
  // P8 发布验收：逐卡账本、注册/战役/多人/replay 与总迁移账本。
  'tests/eote-all-cards.test.mjs',
  'tests/eote-p8-registration.test.mjs',
  'tests/eote-p8-campaign.test.mjs',
  'tests/eote-p8-multiplayer.test.mjs',
  'tests/replay-eote-p8.test.mjs',
  'tests/eote-migration-ledger.test.mjs',
]

export function sourceHashes() {
  return EVIDENCE_SOURCES.filter(path => existsSync(join(MOD, path)))
    .map(path => ({ path, sha256: sha(readFileSync(join(MOD, path))) }))
}

function run(args, logName, { concurrency = null } = {}) {
  const fullArgs = concurrency ? [...args, `--test-concurrency=${concurrency}`] : args
  const result = spawnSync(process.execPath, fullArgs, { cwd: MOD, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = (result.stdout || '') + (result.stderr || '')
  mkdirSync(join(RUN, 'reports'), { recursive: true })
  const log = join(RUN, `reports/${logName}.log`)
  writeFileSync(log, output)
  return { command: 'node ' + fullArgs.join(' '), exitCode: result.status,
    log: `artifacts/migration/eote/reports/${logName}.log`, logSha256: sha(output), output }
}

// node --test 在管道下是 TAP（`# tests N`），在 TTY 下是 spec（`ℹ tests N`）；两种都接受。
function parseSummary(output) {
  const numbers = {}
  for (const match of output.matchAll(/^(?:ℹ|#) (tests|pass|fail|skipped|cancelled) (\d+)$/gm)) {
    numbers[match[1]] = Number(match[2])
  }
  return numbers
}
const failureTitles = output => [...new Set([...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1].trim()))].sort()
const passTitles = output => [...new Set([...output.matchAll(/^ok \d+ - (.+)$/gm)].map(match => match[1].trim()))].sort()

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (mode_() === '--node') {
    const before = sourceHashes()
    const missing = EOTE_NODE_TESTS.filter(path => !existsSync(join(MOD, path)))
    if (missing.length) {
      console.error(`缺少 eote 测试文件：${missing.join('、')}；先完成 P2 再运行 --node`)
      process.exit(2)
    }
    const result = run(['--test', ...EOTE_NODE_TESTS], 'eote-node-acceptance')
    const after = sourceHashes()
    const stable = json(before) === json(after)
    const { output, ...evidence } = result
    const report = {
      schemaVersion: 1, cycle: 'eote', phase: 'P2/P3', generatedBy: 'node tools/verify-eote.mjs --node',
      status: result.exitCode === 0 && stable ? 'passed' : 'failed', sourceStableDuringRun: stable,
      ...evidence, summary: parseSummary(output), testFiles: EOTE_NODE_TESTS,
      failures: failureTitles(output), tests: passTitles(output), sourceFiles: after,
    }
    writeFileSync(join(MOD, 'audit/eote-node-acceptance.json'), json(report))
    mkdirSync(RUN, { recursive: true }); writeFileSync(join(RUN, 'node-acceptance.json'), json(report))
    console.log(json({ status: report.status, summary: report.summary, sourceStableDuringRun: stable }))
    process.exitCode = report.status === 'passed' ? 0 : 1
  } else if (mode_() === '--regression') {
    const before = sourceHashes()
    const replay = run(['tools/replay-fixtures.mjs', '--compare', 'tests/fixtures/replay/eote-baseline.json'], 'eote-replay-final')
    const fast = run(['tools/run-tests.mjs', 'fast'], 'eote-fast-final', { concurrency: 6 })
    const after = sourceHashes()
    const stable = json(before) === json(after)
    const baseline = readJson(join(MOD, 'audit/eote-baseline.json'))
    const failures = failureTitles(fast.output)
    const additions = failures.filter(title => !(baseline.fastFailures || []).includes(title))
    const { output: replayOutput, ...replayEvidence } = replay
    const { output: fastOutput, ...fastEvidence } = fast
    const report = {
      schemaVersion: 1, cycle: 'eote', phase: 'P2/P3', generatedBy: 'node tools/verify-eote.mjs --regression',
      status: replay.exitCode === 0 && stable && additions.length === 0 ? 'passed' : 'failed',
      sourceStableDuringRun: stable,
      replay: { ...replayEvidence, baseline: 'tests/fixtures/replay/eote-baseline.json', matches: replay.exitCode === 0 },
      fast: { ...fastEvidence, summary: parseSummary(fastOutput), failures, additionsSinceInitialBaseline: additions },
      sourceFiles: after,
    }
    writeFileSync(join(MOD, 'audit/eote-regression.json'), json(report))
    mkdirSync(RUN, { recursive: true }); writeFileSync(join(RUN, 'regression.json'), json(report))
    console.log(json({ status: report.status, replayExitCode: replay.exitCode,
      fastSummary: report.fast.summary, additions, sourceStableDuringRun: stable }))
    process.exitCode = report.status === 'passed' ? 0 : 1
  } else {
    console.error('用法：node tools/verify-eote.mjs --node | --regression')
    process.exit(2)
  }
}

function mode_() { return process.argv[2] }
