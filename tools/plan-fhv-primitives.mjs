import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ABILITY_KINDS } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'
import * as matcher from '../src/engine/matcher.js'
import { PLAY_CHANNEL_ORDER, WINDOW_PLAY_CHANNEL_ORDER } from '../src/engine/play-channels.js'
import { scenarioRuntimeExtras } from '../src/engine/scenario-runtime-extras.js'
import { TARGET_KINDS } from '../src/engine/targets.js'
import { windows } from '../src/engine/windows.js'

const mod = fileURLToPath(new URL('../', import.meta.url))
const run = join(mod, '../../artifacts/migration/fhv')
const tests = 'tests/fhv-primitives.test.mjs'
const docs = 'docs/campaign/theFeastOfHemlockVale/primitives.md'
const input = 'audit/fhv-mechanism-scan.json'
const json = value => JSON.stringify(value, null, 2) + '\n'
const read = path => JSON.parse(readFileSync(join(mod, path), 'utf8'))

const implemented = {
  'assets.sharedUses': ['src/engine/use-transfer.js#payUseCost', 'src/engine/ability-rules.js', 'src/engine/uses.js#afterSuppliesSubstituted'],
  'enemies.patrol': ['src/engine/enemy-keyword-movement.js#resolvePatrol', 'src/engine/turn.js'],
  'campaign.codex': ['src/engine/scenario-calendar.js#normalizeCodex', 'src/engine/scenario-calendar.js#resolveCodex'],
  'campaign.time': ['src/engine/scenario-calendar.js#setScenarioDate', 'src/engine/matcher.js#duringPeriod'],
  'campaign.residents': ['src/engine/resident-record.js#changeRelationship', 'src/engine/resident-record.js#crossOutResident', 'src/campaign/record-sets.js'],
  'locations.grid': ['src/engine/grid-map.js#adjacentGridSpaces', 'src/engine/grid-map.js#relocateGridCells'],
  'assets.clueTransfer': ['src/engine/api-clue.js#transferControlledClues', 'src/engine/asset-clues.js#returnAssetClues', 'src/engine/assets.js'],
  'scenario.sinking': ['src/engine/location-face.js#sinkLocation', 'src/engine/scenario-runtime.js'],
  'campaign.fatigue': ['src/engine/chaos-token-pool.js#replaceCampaignNumericTokens', 'src/engine/api-mechanics.js'],
  'locations.enemyLocation': ['src/engine/enemy-location.js#turnLocationIntoEnemy', 'src/engine/enemy-location.js#removeEnemyLocation', 'src/engine/locations.js#removeLocation', 'src/engine/enemies.js#defeatEnemy'],
  'campaign.persist': ['src/engine/survey-preparation.js#prepareSurvey', 'src/engine/campaign-flow.js#finishScenario', 'src/engine/setup.js#startScenario', 'src/engine/table-decisions.js#runMulligans'],
  'cards.playChannels': ['src/engine/api-card.js#resolveAssetAction', 'src/engine/reveal.js#runExecuteDescriptor', 'src/engine/play-channels.js'],
  'assets.maskLifecycle': ['src/engine/assets.js#exceedsControlledTraitLimit', 'src/engine/locations.js#placeLocation', 'src/engine/act-agenda.js#placeDoomOnCard'],
  'assets.attachmentControl': ['src/engine/hosted-assets.js#attachControlledAsset', 'src/engine/hosted-assets.js#claimHostedAsset', 'src/engine/enemies.js#leaveEnemyPlay'],
  'cards.bondedFaces': ['src/engine/bonded.js#shuffleCopyIntoDeck', 'src/engine/physical-faces.js#applyPhysicalFace', 'src/engine/enemy-location.js#turnLocationIntoEnemy', 'src/engine/investigator-form.js#applyInvestigatorForm'],
  'combat.sourceFilter': ['src/engine/effect-provenance.js#damageSourceMatches', 'src/engine/enemies.js#applyHarm', 'src/engine/harm-threat.js#checkDefeated'],
  'chaos.blessCurse': ['src/engine/chaos-token-pool.js#rankedBagTokens', 'src/engine/api-test.js#revealRankedTokenInstead', 'src/engine/tests.js#beforeChaosTokenReveal'],
  'enemies.elusive': ['src/engine/enemy-keyword-movement.js#setEnemyKeywords', 'src/engine/enemy-keyword-movement.js#resolveElusiveAfterAttack', 'src/engine/combat.js', 'src/engine/enemies.js'],
  'actions.parley': ['src/engine/table-decisions.js#restrictedKindOfMove', 'src/engine/play-channels.js#parleyDiscardProvider', 'src/engine/actions.js#doPlay'],
  'chaos.predationBag': ['src/engine/token-bag.js#transferRevealedToken', 'src/engine/enemy-location.js#changeLocationSeals'],
  'investigators.toolDiscount': ['src/engine/action-history.js#firstAssetDiscount', 'src/engine/api-card.js#swapControlledAssetFromHand'],
  'investigators.harmAndForm': ['src/engine/harm-assignment.js#redirectAllyHarm', 'src/engine/harm-threat.js#assignHarm', 'src/engine/investigator-form.js#replaceLethalHarmWithForm'],
  'scenario.specialZones': ['src/engine/scenario-decks.js#routeEnemyDiscardToScenarioDeck', 'src/engine/enemy-zones.js#createEnemyZoneApi', 'src/engine/encounter.js#drawEncounter'],
  'scenario.defenses': ['src/engine/location-defenses.js#applyLocationDefenses', 'src/engine/movement.js#relocateEnemy'],
  'scenario.rail': ['src/engine/rail-grid.js#advanceRailVehicle', 'src/engine/rail-grid.js#convertRailMarkers'],
  'scenario.fate': ['src/engine/scenario-runtime.js#placeLocationVariant', 'src/engine/scenario-decks.js#drawBottomMatching', 'src/engine/investigator-form.js#applyInvestigatorForm'],
  'campaign.deckProgression': ['src/campaign/purchase-discount.js#temporaryPurchaseDiscount', 'src/campaign/campaign.js#purchaseCard', 'web/deck-rules.js#matchesCardRule'],
}

const reused = {
  'scenario.darkness': ['src/engine/marker-count.js#markerCountOf', 'src/engine/marker-count.js#addMarker', 'src/engine/scenario-runtime-extras.js'],
}

const remaining = {}

const coveredBy = {
  'assets.sharedUses': '支付补给／弹药只能用自己控制的合法来源，非法选择不部分扣费',
  'assets.clueTransfer': '支援线索转移校验归属、特质和容量，真实离场归还地点',
  'combat.sourceFilter': ['谈判额度不能用于普通行动，来源限制拒绝未知的直接伤害', '序曲阻止普通伤恐和直接击败，禁用依赖遭遇牌库的能力'],
  'chaos.blessCurse': ['组合祝福诅咒费用不可部分支付，疲劳仅替换不同的数字刻面', '真实检定在揭示前取出袋内多数标记并继续连抽'],
  'enemies.elusive': ['巡逻与逃逸由真实敌人阶段和攻击结算触发', '逃逸关键词可暂时授予或取消，取消的攻击结算后无连接也会横置'],
  'enemies.patrol': '巡逻与逃逸由真实敌人阶段和攻击结算触发',
  'actions.parley': ['打出弃牌区谈判事件花费宿主一次使用次数，嵌套检定保留谈判行动性质', '谈判能力中的攻击只消费谈判额度且不触发其他敌人的借机攻击'],
  'campaign.codex': '法典按已付费触发者结算首个合格分支，按幕重开并通过存档校验',
  'campaign.time': '日期记录跨场可读，局部昼夜由地点特质决定',
  'campaign.residents': '居民记录按范围增减，划除后笔记不可见且不可修改',
  'campaign.fatigue': '组合祝福诅咒费用不可部分支付，疲劳仅替换不同的数字刻面',
  'chaos.predationBag': ['独立猎杀袋揭示后可归还、转移，标记不会触发玩家检定', '双类型地点存档后仍能调查、躲避和攻击，击败时只进一次胜利区并坍塌'],
  'investigators.toolDiscount': ['首张支援折扣按打出记录与卡种计算，不消费同特质事件', '工具互换按印刷费用与可用槽位检查，原支援退回手牌且新支援原位入场'],
  'locations.grid': '网格交换先校验全部坐标，地点实体及在场内容随地点标识保留',
  'scenario.sinking': '渗坑达到阈值翻面，保留线索与遭遇附属并弃掉玩家附属',
  'scenario.specialZones': ['独立遭遇牌库只洗自己的弃牌堆，空牌库不调用主遭遇管线', '追击区往返保留敌人实体与附属，离场回到来源牌库的独立弃牌区'],
  'scenario.darkness': '独立遭遇牌库只洗自己的弃牌堆，空牌库不调用主遭遇管线',
  'scenario.defenses': ['工事在移动管线拦截关键词移动，诱饵阻止当轮重整', '同时有诱饵与陷阱时可先结算陷阱，敌人离场后保留未用诱饵'],
  'scenario.rail': ['轨道只连接相对的出口，载具经权威入口移动并在断轨时记录脱轨', '轨道多出口选择跨存档保留，计数按比例兑换并可切回普通连通'],
  'locations.enemyLocation': '双类型地点存档后仍能调查、躲避和攻击，击败时只进一次胜利区并坍塌',
  'campaign.persist': ['跨章节整备保存身份、实物支援、线索和手牌，开局消费整备并跳过换牌', '序曲阻止普通伤恐和直接击败，禁用依赖遭遇牌库的能力'],
  'cards.playChannels': '代执行行动分别免行动费与全部费用，来源必须属于操作者',
  'assets.maskLifecycle': '面具同特质上限，并区分地点入场与第一次放置毁灭',
  'assets.attachmentControl': '宿主上的支援保留身份与原所有者，同地点调查员可取回并使用',
  'cards.bondedFaces': ['绑定池只取选定副本，池内用完后按实体从弃牌取同一张', '双类型地点存档后仍能调查、躲避和攻击，击败时只进一次胜利区并坍塌', '濒败替换形态清除既有伤恐，读档后按声明阻止治疗'],
  'investigators.harmAndForm': ['濒败替换形态清除既有伤恐，读档后按声明阻止治疗', '同地点调查员可承接直接给予盟友的伤恐并在读档后完成选择'],
  'scenario.fate': '混合场外牌库从底部抽取遭遇牌，跳过的牌保留且调查员形态可恢复',
  'campaign.deckProgression': '临时购牌折扣用于不同名新购，确认才消耗并在下次开局失效',
}

const mode = process.argv[2]
assert(['--write', '--check', '--acceptance'].includes(mode), '用法：node tools/plan-fhv-primitives.mjs --write | --check | --acceptance')
const source = read(input)
const mappedIds = [...Object.keys(implemented), ...Object.keys(reused), ...Object.keys(remaining)].sort()
assert.deepEqual(mappedIds, source.primitiveGaps.map(row => row.id).sort(), 'P1 缺口与 P2 处理清单不一致')
const testSource = readFileSync(join(mod, tests), 'utf8')
for (const [id, names] of Object.entries(coveredBy)) {
  for (const title of [names].flat()) assert(mappedIds.includes(id) && testSource.includes(`test('${title}',`), `找不到 ${id} 的原语测试：${title}`)
}
for (const id of [...Object.keys(implemented), ...Object.keys(reused)]) assert(coveredBy[id], `缺少 ${id} 的原语测试`)

const rows = source.primitiveQueue.map(row => {
  const evidence = implemented[row.id] || reused[row.id] || remaining[row.id]?.[0] || row.readPoints
  const remainingWork = remaining[row.id]?.[1]
  const disposition = implemented[row.id] ? 'new' : remainingWork ? row.disposition : 'reuse'
  const status = remainingWork ? (evidence.length ? 'partial' : 'pending') : 'done'
  for (const ref of [...row.readPoints, ...evidence]) assert(existsSync(join(mod, ref.split('#')[0])), `找不到原语读点 ${ref}`)
  return { id: row.id, fromP1: row.disposition, disposition, status, cards: row.cards, sources: row.readPoints, evidence,
    ...(coveredBy[row.id] ? { tests: [coveredBy[row.id]].flat().map(title => `${tests}#${title}`) } : {}), docs,
    ...(remainingWork ? { remaining: remainingWork } : {}) }
})
const plan = {
  schemaVersion: 1, campaignId: source.campaignId, input,
  status: rows.every(row => row.status === 'done') ? 'done' : 'in-progress',
  reuse: rows.filter(row => row.disposition === 'reuse'),
  new: rows.filter(row => row.disposition === 'new' && row.status === 'done'),
  pending: rows.filter(row => row.status !== 'done'),
  escape: [],
  verification: { targeted: tests, targetedReport: 'artifacts/migration/fhv/reports/p2-followup-primitives.log',
    replay: 'artifacts/migration/fhv/reports/p2-followup-replay.log',
    fast: 'artifacts/migration/fhv/reports/p2-followup-fast-compare.json' },
}

const methods = api => Object.fromEntries(Object.entries(api).filter(([, value]) => value && typeof value === 'object')
  .map(([group, value]) => [group, Object.keys(value).sort()]).sort(([a], [b]) => a.localeCompare(b)))
const catalog = {
  schemaVersion: 1, campaignId: source.campaignId, generatedBy: 'tools/plan-fhv-primitives.mjs', readOnly: true,
  engine: { effects: [...EFFECT_PRIMITIVES], abilityKinds: [...ABILITY_KINDS], windows: windows().map(window => window.id).sort(),
    matcher: Object.keys(matcher).sort(), targets: [...TARGET_KINDS], playChannels: [...PLAY_CHANNEL_ORDER], windowPlayChannels: [...WINDOW_PLAY_CHANNEL_ORDER],
    mechanicsApi: methods(createMechanicsApi({})), scenarioRuntimeExtras: methods(scenarioRuntimeExtras({})),
    otherApiFactories: ['src/engine/api-card.js', 'src/engine/api-clue.js', 'src/engine/api-enemy.js', 'src/engine/api-misc.js', 'src/engine/api-test.js'],
  },
  primitives: rows.map(({ id, disposition, status, evidence }) => ({ id, disposition, status, evidence })),
}

for (const [name, data] of [['primitive-plan', plan], ['primitive-catalog', catalog]]) {
  const target = join(mod, `audit/fhv-${name}.json`)
  if (mode === '--write') {
    mkdirSync(run, { recursive: true })
    writeFileSync(target, json(data))
    writeFileSync(join(run, `${name}.json`), json(data))
  } else {
    assert(readFileSync(target, 'utf8').replaceAll('\r\n', '\n') === json(data), `FHV ${name} 漂移`)
  }
}
console.log(`fhv primitives: ${source.primitiveGaps.length} gaps reviewed, ${plan.new.length + Object.keys(reused).length} closed, ${plan.pending.length} open`)
if (mode === '--acceptance') {
  assert.equal(plan.status, 'done', `P2 尚有缺口：${plan.pending.map(row => row.id).join(', ')}`)
  const resolveReport = path => join(mod, '../..', path)
  const targeted = readFileSync(resolveReport(plan.verification.targetedReport), 'utf8')
  assert.match(targeted, /^# fail 0\r?$/m)
  assert.match(targeted, /^# cancelled 0\r?$/m)
  const passed = new Set([...targeted.matchAll(/^ok \d+ - (.+?)\r?$/gm)].map(([, title]) => title))
  for (const title of Object.values(coveredBy).flat()) assert(passed.has(title), `专项测试缺少通过记录：${title}`)
  const replay = readFileSync(resolveReport(plan.verification.replay), 'utf8')
  assert.match(replay, /与基线逐条一致/)
  const fast = JSON.parse(readFileSync(resolveReport(plan.verification.fast), 'utf8'))
  const baseline = read('audit/fhv-baseline.json')
  assert.deepEqual(fast.newFailures, [])
  assert(fast.totals.cancelled <= baseline.fast.totals.cancelled, 'P2 快速回归新增取消')
  console.log('fhv primitives acceptance: passed')
}
