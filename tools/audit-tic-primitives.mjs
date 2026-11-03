import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { PRIMITIVES } from './tic-mechanisms.mjs'
import { buildScan } from './scan-tic-mechanisms.mjs'
import { MOD, emit, json, sha, writeJson, RUN } from './tic-migration-lib.mjs'
import { currentEvidence } from './tic-evidence.mjs'
import { ABILITY_KINDS } from '../src/engine/ability.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'
import { windows } from '../src/engine/windows.js'
import { MECHANIC_OPERATIONS } from '../src/engine/mechanic-choices.js'
export async function buildPrimitivePlan() {
  const scan = buildScan(), node = currentEvidence('node-acceptance'), regression = currentEvidence('interaction-regression') || currentEvidence('regression')
  const regressionPath = regression?.generatedBy.includes('--p4-regression') ? 'audit/tic-interaction-regression.json' : 'audit/tic-regression.json'
  const rows = await Promise.all(Object.entries(PRIMITIVES).map(async ([id, spec]) => {
    const present = existsSync(join(MOD, spec.module))
    const module = present ? await import(pathToFileURL(join(MOD, spec.module))) : {}
    const exportsPresent = spec.names.every(name => typeof module[name] === 'function')
    return { id, ...spec, cards: [...new Set(scan.mechanisms.filter(m => m.candidatePrimitives.includes(id)).flatMap(m => m.cards))].sort(),
      status: present && exportsPresent && node && regression ? 'done' : 'pending',
      api: spec.new ? 'ctx.api（域接口见 docs/theInnsmouthConspiracy/primitives.md）' : '复用既有规则入口',
      docs: 'docs/theInnsmouthConspiracy/primitives.md', tests: ['tests/tic-primitives.test.mjs', 'tests/tic-rules.test.mjs', 'tests/tic-interactions.test.mjs', 'tests/tic-investigators.test.mjs'],
      evidence: ['audit/tic-node-acceptance.json', regressionPath], exportsPresent,
    }
  }))
  return { schemaVersion: 1, cycle: 'tic', scanSha256: sha(json(scan)),
    reuse: rows.filter(row => !row.new), new: rows.filter(row => row.new), escape: [],
    catalog: { abilityKinds: ABILITY_KINDS, effectPrimitives: EFFECT_PRIMITIVES, windows: windows(),
      interactionOperations: MECHANIC_OPERATIONS,
      apiModule: 'src/engine/api-mechanics.js', scenarioApi: 'scenarioRuntime(...).mechanics',
      investigatorApiModule: 'src/engine/investigator-mechanics.js',
      playerExtensions: {
        tokenCost: { module: 'src/engine/token-cost.js', api: 'additionalTokenCost; exact add/pay; dynamic shroud/difficulty' },
        playerTools: { module: 'src/engine/player-mechanics.js', api: 'ctx.api.playerTools', tests: ['tests/tic-player-primitives.test.mjs', 'tests/tic-player-guardian-seeker.test.mjs', 'tests/tic-player-rogue-mystic.test.mjs', 'tests/tic-player-survivor-neutral.test.mjs'] },
        playTiming: { module: 'src/engine/play-timing.js', api: 'playTimingProvider; fastSourceId' },
        sharedUses: { module: 'src/engine/use-transfer.js', api: 'availableUseCost/payUseCost; assetRule.sharedUses' },
        queue: 'audit/tic-player-queue.json',
      },
      state: 'scenarioFlags.mechanics.version=1; optional and lazy; validated by save-migration.js' },
    gates: { scanPassed: Object.values(scan.gates).every(Boolean), exportsPresent: rows.every(row => row.exportsPresent),
      nodeAcceptance: !!node, regressionAcceptance: !!regression, allNewDone: rows.filter(row => row.new).every(row => row.status === 'done'),
      primitiveMechanismsPlanned: scan.mechanisms.filter(row => row.type === 'primitive').every(row => row.candidatePrimitives.every(id => rows.some(p => p.id === id))),
      noEscape: true } }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await buildPrimitivePlan(); emit('primitive-plan', report)
  if (process.argv.includes('--check')) {
    const catalog = join(MOD, 'audit/tic-primitive-catalog.json')
    if (!existsSync(catalog) || readFileSync(catalog, 'utf8') !== json(report.catalog)) throw new Error('tic primitive-catalog 漂移；审阅后显式 --write')
  }
  if (process.argv.includes('--write')) {
    writeJson(join(MOD, 'audit/tic-primitive-catalog.json'), report.catalog)
    writeJson(join(RUN, 'primitive-catalog.json'), report.catalog)
  }
}
