// P5 丹妮拉·雷耶丝（08001）及专属卡 Node 验收。
//
// 验收口径（docs/edgeOfTheEarth/README.md §3 P5、§5）：
//   · 条目注册：08001 investigator + elderSign、08002 支援两条能力、08003 敌人型弱点；
//   · 旧印：+1；本轮被敌人攻击过改为自动成功（读 `inv.attackedSinceTurnEnd` 这份权威攻击记录，
//     该字段由引擎在敌人攻击结算时写入、调查员回合结束时清空——见 08001 注释与 Lead 的 P5 支持项）；
//   · 被攻击后反应：伤害或自动躲避、被取消的攻击仍触发、趁乱攻击不触发；
//   · 机修工的扳手：fast 强制同地点敌人攻击；动作攻击只限「上一回合结束后攻击过你的敌人」，
//     +2[combat]、+1 伤害；
//   · 黑帮暴徒：猎手 / 猎物仅丹妮拉 / 攻击不可取消 / 伤害恐惧视为直接。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle, answer } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { enemyRuleFlags, enemyWeaknessExtra } from '../src/cards/card-rules.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import {
  performTest, reactionWindow, drawCards, legalMoves, getStat, validateMove, decisionSeat, enemyAttack,
} from '../src/engine/engine.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { canSelectInvestigator, getAvailability, PLAYABLE_INVESTIGATOR_CODES } from '../src/deck/availability.js'
import { implementation } from '../src/cards/card-implementation.js'

import daniela from '../src/cards/entries/08001.js'
import wrench from '../src/cards/entries/08002.js'
import mobGoons from '../src/cards/entries/08003.js'

// entries/index.js 已重建时条目由引擎统一注册；仅在索引尚未包含（独立导入）时兜底自注册。
if (!registeredEntry('08001')) registerCardAbilities([daniela, wrench, mobGoons])
// 测试专用「取消敌人攻击」条目：只用来验证 08003「攻击不能被取消」的引擎读点，不进入生产索引。
if (!registeredEntry('P5CANCEL')) {
  registerCardAbilities([{
    code: 'P5CANCEL',
    abilities: [{
      kind: 'reaction', trigger: 'enemyAttack', label: '测试取消攻击',
      criteria: ({ context }) => context.when === 'enemyAttack',
      resolve: ({ context }) => { context.cancelled = true },
    }],
  }])
}

const clone = value => JSON.parse(JSON.stringify(value))
const firstAbility = c => c.options.find(option => option.id.startsWith('desc:'))?.id
// 丹妮拉的 enemyAttacked 反应回答：先选她的描述子，再在伤害/躲避中选择。
const answerDaniela = (choice, pick = 'damage') => {
  if (choice.options.some(option => option.id === 'damage') && choice.options.some(option => option.id === 'evade')) return pick
  const descriptor = choice.options.find(option => option.id.startsWith('desc:'))
  if (descriptor) return descriptor.id
  return null
}
function transact (state, run, select = () => null, { save = false } = {}) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eoteInvestigatorTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    if (save) Object.assign(state, clone(state))
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId)) ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    const command = { action: 'choose', choiceId: choice.id, optionId: id }
    assert.equal(choiceError(state, choice.seat, command), null)
    resolveTransaction(state, choice.seat, command, execute)
  }
}
// EotE 调查员条目已进入生成的 entries/index.js（Lead 重建），直接用真实调查员夹具。
function danielaFixture () {
  const state = fixture('08001')
  state.abilityLimits = {}
  const inv = state.investigators[0]
  inv.hand = []
  inv.threat = []
  inv.assets = []
  inv.damage = 0
  inv.horror = 0
  inv.attackedSinceTurnEnd = []
  return state
}
const enemyAtInv = (state, extra = {}) => enemy(state, { ...extra, engagedSeat: 0 })
const attacks = (state, e, kind = 'fight') => reactionWindow(state, 'enemyAttacked',
  { when: 'enemyAttacked', seat: 0, location: state.investigators[0].location, enemy: e, attack: { kind } }, [])

test('P5 08001 自动构筑、专属依赖与注册身份', (t) => {
  assert.equal(canSelectInvestigator('08001'), true)
  assert.equal(PLAYABLE_INVESTIGATOR_CODES.includes('08001'), false, '既有 AI 随机池保持稳定')
  assert.equal(registeredEntry('08001').kind, 'investigator')
  assert.equal(registeredEntry('08001').elderSign.label.includes('旧印'), true)
  for (const sig of ['08002', '08003']) {
    assert.equal(getAvailability(sig).dependencyOnly, true)
    assert.equal(getAvailability(sig).deckbuilding, false)
    assert.ok(registeredEntry(sig), `${sig} 必须注册`)
  }
  const s = danielaFixture()
  assert.equal(getStat(s, s.investigators[0], 'combat'), 5)
  // 构筑断言需要条目进入生成的 entries/index.js（Lead 重建后 implementation 才为 true）。
  if (!implementation('08002').implemented) return t.skip('entries/index.js 重建后启用真实构筑断言（Lead）')
  const built = buildDeck(INVESTIGATORS['08001'], { seed: 'eote-08001' })
  assert.equal(built.playerCards.length, 30)
  assert.equal(buildDeckFromList(INVESTIGATORS['08001'], built.playerCards, { seed: 'eote-08001-manual' }).playerCards.length, 30)
  assert.equal(validateDeckRules(INVESTIGATORS['08001'], built.playerCards, ALL_CARDS).errors.length, 0)
  for (const sig of ['08002', '08003']) {
    assert.ok(built.signatureCards.includes(sig) || built.signatureWeaknesses.includes(sig), `${sig} 必须在构筑依赖中`)
  }
})

test('P5 08001 旧印：+1；本轮被敌人攻击过则改为自动成功', () => {
  const plain = danielaFixture()
  plain.chaosBag = ['eldersign']
  transact(plain, draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.equal(plain.lastTestResult.value, 5) // 意志 4 + 旧印 +1
  assert.equal(plain.lastTestResult.success, true)

  const attacked = danielaFixture()
  attacked.chaosBag = ['eldersign']
  attacked.round = 3
  attacked.investigators[0].attackedSinceTurnEnd = [{ enemyId: 'e1', round: 3, kind: 'fight' }]
  transact(attacked, draft => performTest(draft, 0, 'willpower', 20, {}))
  assert.equal(attacked.lastTestResult.success, true, '本轮被攻击过：旧印自动成功')
  assert.equal(attacked.lastTestResult.value < 20, true)

  const lastRound = danielaFixture()
  lastRound.chaosBag = ['eldersign']
  lastRound.round = 3
  lastRound.investigators[0].attackedSinceTurnEnd = [{ enemyId: 'e1', round: 2, kind: 'fight' }]
  transact(lastRound, draft => performTest(draft, 0, 'willpower', 20, {}))
  assert.equal(lastRound.lastTestResult.success, false, '上一轮被攻击不触发旧印自动成功')
})

test('P5 08001 被攻击后反应：造成伤害或自动躲避；被取消的攻击仍触发；趁乱攻击不触发', () => {
  const damage = danielaFixture()
  const target = enemyAtInv(damage, { damage: 1 })
  transact(damage, draft => attacks(draft, draft.enemies.find(item => item.id === target.id)), (choice) => answerDaniela(choice, 'damage'))
  assert.ok(damage.enemies.find(item => item.id === target.id).damageTaken > 0)

  const evade = danielaFixture()
  const evaded = enemyAtInv(evade)
  transact(evade, draft => attacks(draft, draft.enemies.find(item => item.id === evaded.id)), (choice) => answerDaniela(choice, 'evade'))
  const after = evade.enemies.find(item => item.id === evaded.id)
  assert.equal(after.exhausted, true)
  assert.equal(after.engagedSeat, null)

  const cancelled = danielaFixture()
  const stillTriggers = enemyAtInv(cancelled)
  transact(cancelled, draft => reactionWindow(draft, 'enemyAttacked',
    { when: 'enemyAttacked', seat: 0, location: draft.investigators[0].location, enemy: draft.enemies.find(item => item.id === stillTriggers.id), attack: { kind: 'fight' }, attackCancelled: true }, []),
  (choice) => answerDaniela(choice, 'damage'))
  assert.ok(cancelled.enemies.find(item => item.id === stillTriggers.id).damageTaken > 0, '被取消的攻击也开窗口')

  const opportunity = danielaFixture()
  const opportunityEnemy = enemyAtInv(opportunity)
  transact(opportunity, draft => attacks(draft, draft.enemies.find(item => item.id === opportunityEnemy.id), 'opportunity'))
  assert.equal(opportunity.enemies.find(item => item.id === opportunityEnemy.id).damageTaken, 0)
})

test('P5 08002 机修工的扳手：fast 强制同地点敌人攻击；动作攻击限被攻击过的敌人 +2 战斗/+1 伤害', () => {
  const s = danielaFixture()
  const tool = asset(s, '08002')
  const e = enemyAtInv(s, { fight: 1, evade: 1, health: 30, damage: 1 })
  s.investigators[0].damage = 0
  const fastMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === tool.id && command.abilityIndex === 0)
  assert.ok(fastMove, 'fast 能力进入合法动作')
  move(s, fastMove)
  settle(s, choice => choice.kind === 'target' ? e.id : null)
  assert.equal(s.investigators[0].damage, 1, '被强制攻击：敌人 1 点伤害命中丹妮拉')
  const history = s.investigators[0].attackedSinceTurnEnd || []
  assert.ok(history.some(record => record.enemyId === e.id), '引擎攻击历史记账（tracksAttacks）')

  const notAttacked = danielaFixture()
  asset(notAttacked, '08002')
  enemyAtInv(notAttacked)
  const blocked = legalMoves(notAttacked, 0).filter(command => command.action === 'ability' && command.abilityIndex === 1)
  assert.equal(blocked.length, 0, '未被该敌人攻击过：动作攻击不可用')

  const fight = danielaFixture()
  asset(fight, '08002')
  const attacker = enemyAtInv(fight, { fight: 1, evade: 1, health: 30 })
  fight.investigators[0].attackedSinceTurnEnd = [{ enemyId: attacker.id, round: fight.round - 1, kind: 'fight' }]
  fight.chaosBag = ['+5']
  const fightMove = legalMoves(fight, 0).find(command => command.action === 'ability' && command.abilityIndex === 1)
  assert.ok(fightMove, '被攻击过的敌人：动作攻击进入合法动作')
  move(fight, fightMove)
  settle(fight, choice => choice.kind === 'target' ? attacker.id : null)
  assert.equal(fight.lastTestResult.success, true)
  assert.ok(fight.enemies.find(item => item.id === attacker.id).damageTaken >= 2, '基础 1 伤害 + 扳手 +1 伤害')
})

test('P5 08001 攻击历史：引擎结算记账、回合结束清空', () => {
  const s = danielaFixture()
  const inv = s.investigators[0]
  inv.attackedSinceTurnEnd = [{ enemyId: 'e9', round: s.round, kind: 'fight' }]
  const endTurn = legalMoves(s, 0).find(command => command.action === 'endTurn')
  assert.ok(endTurn, '结束回合进入合法动作')
  move(s, endTurn)
  settle(s, choice => (choice.kind === 'reaction' && choice.options.some(option => option.id === 'skip') ? 'skip' : null))
  assert.equal(s.investigators[0].attackedSinceTurnEnd, undefined, '你的回合结束时清空攻击历史')
})

test('P5 08003 攻击不能被取消（引擎读点）：普通敌人可取消，黑帮暴徒不可', () => {
  const pickCancel = choice => {
    if (choice.kind === 'reaction' && choice.options.some(option => String(option.id).startsWith('desc:'))) {
      return choice.options.find(option => String(option.id).startsWith('desc:')).id
    }
    if (choice.kind === 'reaction' && choice.options.some(option => option.id === 'skip')) return 'skip'
    return null
  }
  const attempt = enemyCode => {
    const s = danielaFixture()
    s.investigators[0].assets.push({ id: 'cCancel', code: 'P5CANCEL', exhausted: false })
    enemy(s, { code: enemyCode, name: '测试敌人', damage: 1, horror: 0, engagedSeat: 0 })
    transact(s, draft => {
      enemyAttack(draft, draft.enemies[0], draft.investigators[0], [], '敌人攻击', { kind: 'attack' })
    }, pickCancel)
    return s.investigators[0].damage
  }
  assert.equal(attempt('ghoulMinion'), 0, '普通敌人的攻击被取消')
  assert.equal(attempt('08003'), 1, '黑帮暴徒的攻击不能被取消')
})

test('P5 08003 黑帮暴徒：弱点生成、猎手/仅丹妮拉猎物、攻击不可取消、伤害恐惧视为直接', () => {
  assert.deepEqual({ ...enemyWeaknessExtra('08003') }, { hunter: true, prey: true })
  const flags = enemyRuleFlags('08003')
  assert.equal(flags.attacksCannotBeCancelled, true)
  assert.equal(flags.attackHarmDirect, true)

  const s = danielaFixture()
  s.investigators[0].deck = [...Array(10).fill('01088'), '08003']
  transact(s, draft => {
    // 将黑帮暴徒作为弱点抽出：走真实弱点结算管线（弱点在牌库顶 = 数组末位）。
    drawCards(draft, draft.investigators[0], 1, [])
  })
  const spawned = s.enemies.find(item => item.code === '08003')
  assert.ok(spawned, '弱点敌人已生成')
  assert.equal(spawned.hunter, true)
  assert.equal(spawned.bearerSeat, 0, 'Prey - 仅限抽到它的丹妮拉')
  assert.equal(spawned.engagedSeat, 0)

  // 直接伤害：攻击造成的伤害/恐惧不能分配给支援（08003 的 attackHarmDirect 引擎读点）。
  const soak = danielaFixture()
  const ally = asset(soak, '01028')
  const goons = enemy(soak, { code: '08003', name: '黑帮暴徒', damage: 1, horror: 1, engagedSeat: 0 })
  transact(soak, draft => {
    enemyAttack(draft, draft.enemies.find(item => item.id === goons.id), draft.investigators[0], [], '黑帮暴徒攻击', { kind: 'fight' })
  }, choice => (choice.kind === 'reaction' && choice.options.some(option => option.id === 'skip') ? 'skip' : null))
  assert.equal(soak.investigators[0].damage, 1, '直接伤害落在调查员身上')
  assert.equal(soak.investigators[0].horror, 1, '直接恐惧落在调查员身上')
  assert.equal(ally.damageTaken || 0, 0, '支援不能分担直接伤害')
})
