import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { MOD, emit, json, readJson, sha } from './tic-migration-lib.mjs'
import { currentEvidence } from './tic-evidence.mjs'
export function buildInteractionAudit() {
  const node = currentEvidence('node-acceptance'), browser = currentEvidence('interactions-browser'), regression = currentEvidence('interaction-regression')
  const passed = (file, title) => !!browser?.tests.some(row => row.status === 'passed' && row.file === file && row.title.includes(title))
  const coverage = Object.fromEntries(['desktop', 'mobile'].map(viewport => [viewport, Object.fromEntries([
    ['seal', '封印多选'], ['keys', '隐藏钥匙'], ['vehicle', '载具座位'], ['origins', '原区投入'],
  ].map(([id, title]) => [id, passed('tests/tic-interactions.browser.mjs', `P4 ${viewport} ${title}`)]))]))
  const baseline = readJson(join(MOD, 'audit/tic-p4-baseline.json'))
  const checks = {
    nodeAcceptance: !!node, sourceStable: !!node && !!browser && !!regression,
    desktopAndMobile: Object.values(coverage).every(value => Object.values(value).every(Boolean)),
    scriptOwnership: ['desktop', 'mobile'].every(view => passed('tests/script-actions-tfa.browser.mjs', view)),
    guidePlacementAndPrivacy: passed('tests/scenario-guides.browser.mjs', '完整指南按需加载'),
    guideFailureRetryAndKeyboard: passed('tests/scenario-guides.browser.mjs', '指南加载失败'),
    baselineUnchanged: baseline.replaySha256 === sha(readFileSync(join(MOD, baseline.replayFile))),
    fastZeroFailures: !!regression && regression.fast.exitCode === 0 && regression.fast.failures.length === 0,
    replayExact: !!regression && regression.replay.exitCode === 0,
  }
  return { schemaVersion: 1, cycle: 'tic', phase: 'P4', generatedBy: 'tools/audit-tic-interactions.mjs',
    status: Object.values(checks).every(Boolean) ? 'verified' : 'pending', coverage, checks,
    contract: {
      actions: 'Only server legalMoves and requestChoice; no browser rule checks or arbitrary client mechanics commands.',
      privacy: 'Private beneath codes and private tokens are owner-only. Explicitly public investigator origins are shared. Hidden keys use opaque ids; future road decks, answers and unreached story are not projected.',
      cancellation: 'Optional effect choices cancel before mechanics writes; mandatory choices have no cancel. Printed action/card costs remain governed by their descriptor.',
      guide: 'Existing setup/reference entry is reused and tested. Full eight-chapter TIC guide content remains P7.',
      release: 'Test-only HTTP seed is confined to tools/tests. P4 opens no content; investigator and player availability are independently certified by P5 and P6. The campaign remains catalog-only.',
    },
    evidence: ['audit/tic-node-acceptance.json', 'audit/tic-interactions-browser.json', 'audit/tic-interaction-regression.json', 'audit/tic-p4-baseline.json'],
    gates: checks }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) emit('interactions', buildInteractionAudit())
