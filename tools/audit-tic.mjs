import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MOD, emit, sha, json } from './tic-migration-lib.mjs'
import { buildScope } from './scan-tic-scope.mjs'
import { buildScan } from './scan-tic-mechanisms.mjs'
import { buildPrimitivePlan } from './audit-tic-primitives.mjs'
import { currentEvidence } from './tic-evidence.mjs'
import { buildInteractionAudit } from './audit-tic-interactions.mjs'
import { buildInvestigatorAudit } from './audit-tic-investigators.mjs'
import { buildPlayerStageAudit } from './audit-tic-player.mjs'
import { TIC_KEYWORDS } from '../content/campaigns/theInnsmouthConspiracy/keywords.js'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { TIC_RULE_IDS } from '../web/tic-rules.js'
import { cardRuleIds, ruleById } from '../web/rulebook-data.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { SCENARIO_MIGRATION_CHECKS, assertMigrationConfirmations } from '../content/migration-confirmation.js'

const scope = buildScope(), scan = buildScan(), plan = await buildPrimitivePlan()
const node = currentEvidence('node-acceptance'), browser = currentEvidence('browser-acceptance'), regression = currentEvidence('interaction-regression') || currentEvidence('regression')
const interactions = buildInteractionAudit()
const investigators = buildInvestigatorAudit()
const players = buildPlayerStageAudit()
const ok = gates => Object.values(gates).every(value => value === true)
const same = (name, report) => { try { return readFileSync(join(MOD, `audit/tic-${name}.json`), 'utf8') === json(report) } catch { return false } }
const keywordItems = TIC_KEYWORDS.map(keyword => {
  const checks = { sourceInventoried: scan.mechanisms.some(row => row.id === keyword.id && row.cards.length),
    engineBehavior: keyword.primitives.every(id => [...plan.new, ...plan.reuse].some(row => row.id === id && row.status === 'done')),
    nodeAcceptance: !!node, rulebookEntry: ruleById(keyword.ruleId).id === keyword.ruleId,
    cardLinks: keyword.cardCodes.every(code => cardRuleIds(ALL_CARDS[code]).includes(keyword.ruleId)) }
  checks.sourceInventoried = !!checks.sourceInventoried
  return { id: keyword.id, ruleId: keyword.ruleId, cards: keyword.cardCodes, checks, status: ok(checks) ? 'verified' : 'pending',
    evidence: ['audit/tic-mechanism-scan.json', 'audit/tic-primitive-plan.json', 'audit/tic-node-acceptance.json', 'web/tic-rules.js'] }
})
const scenarioItems = chapters.map(chapter => ({ id: chapter.id, code: chapter.code, status: 'pending',
  checks: Object.fromEntries(SCENARIO_MIGRATION_CHECKS.map(id => [id, ['sourceLocked', 'identityRegistered'].includes(id)])),
  evidence: ['audit/tic-scope.json', `content/campaigns/theInnsmouthConspiracy/scenarios/${chapter.id}/index.js`] }))
const rulebookChecks = { campaignOverview: ruleById('ticCampaign').body.join('').includes('暗潮之下'),
  scenarioMechanics: ok(plan.gates), keywordEntries: keywordItems.every(item => item.checks.rulebookEntry),
  cardLinks: keywordItems.every(item => item.checks.cardLinks),
  desktopBrowser: !!browser && browser.coverage['desktop:zh-CN'] && browser.coverage['desktop:en'] && browser.links.desktop,
  mobileBrowser: !!browser && browser.coverage['mobile:zh-CN'] && browser.coverage['mobile:en'] && browser.links.mobile }
const gates = { p0: ok(scope.gates) && same('scope', scope) && !!node,
  p1: ok(scan.gates) && same('mechanism-scan', scan) && !!node,
  p2: ok(plan.gates) && same('primitive-plan', plan),
  p3: keywordItems.every(row => row.status === 'verified') && ok(rulebookChecks) && !!regression,
  p4: interactions.status === 'verified' && same('interactions', interactions),
  p5: investigators.status === 'verified' && same('investigators', investigators),
  p6: players.status === 'verified' }
const report = { schemaVersion: 1, campaignId: 'theInnsmouthConspiracy', status: 'catalog-only', playable: false, earlyAccess: false,
  equivalenceCertified: false, generatedBy: 'node tools/audit-tic.mjs --write',
  stages: Object.fromEntries(Object.entries(gates).map(([id, value]) => [id.toUpperCase(), value ? 'verified' : 'pending'])),
  summary: { records: scope.cards.length, partitions: Object.fromEntries(Object.entries(scope.partitions).map(([id, cards]) => [id, cards.length])),
    sourceFiles: scope.sources.length, mechanisms: scan.mechanisms.length, newPrimitives: plan.new.length, reusedPrimitives: plan.reuse.length,
    keywords: keywordItems.length, rulebookEntries: TIC_RULE_IDS.length },
  sourcePolicy: { root: scope.sourceRoot, scopeSha256: sha(json(scope)), scanSha256: sha(json(scan)),
    canonicalSnapshots: 'audit/tic-*.json', runtimeArtifacts: '大厅根目录 artifacts/migration/tic/', sourceDriftBlocksCheck: true },
  confirmations: { scenarios: { status: 'pending', items: scenarioItems },
    keywords: { status: keywordItems.every(item => item.status === 'verified') ? 'verified' : 'pending', items: keywordItems },
    rulebook: { status: ok(rulebookChecks) ? 'verified' : 'pending', checks: rulebookChecks, evidence: ['web/tic-rules.js', 'audit/tic-browser-acceptance.json'] } },
  regressionEvidence: ['audit/tic-baseline.json', 'audit/tic-node-acceptance.json', 'audit/tic-regression.json', 'audit/tic-control-regression.json', 'audit/tic-p4-baseline.json', 'audit/tic-interaction-regression.json'],
  interactions: { status: interactions.status, evidence: 'audit/tic-interactions.json' },
  investigators: { status: investigators.status, evidence: 'audit/tic-investigators.json',
    items: investigators.items.map(({ code, status }) => ({ code, status })) },
  players,
  remaining: [
    ...(!gates.p4 ? ['P4：新增卡牌操作与场景交互仍需当前源码的专项验收。'] : []),
    ...(!gates.p5 ? ['P5：五位调查员与专属依赖仍需当前源码的逐人验收。'] : []),
    ...(!gates.p6 ? ['P6：一般玩家卡仍需当前源码的逐卡、界面及回归验收。'] : []),
    'P7：共享遭遇、八章规则、幕间、完整中英叙事和冒险指南；占位章尚不注册到生产关卡列表。',
    'P8：完整战役、失败分支、存档、多人与 AI、真实联机和发布验收；内容不可启动。',
  ], gates }
assertMigrationConfirmations(report, chapters.map(ch => ch.id))
emit('migration', report)
