// AI 专用战斗/躲避预估（src/engine/combat-odds.js）：只进决策资料，不进牌桌视图。
//
// 覆盖四件事：
//   1. 数值口径——检定值 / 难度 / 需要标记修正 / 成功率与袋里标记逐枚对得上；
//   2. 只给 AI——viewState / legalMoves 里没有 odds；
//   3. 兜底——剧本没有 tokenMeanings 时按 SYMBOL_DEFAULTS，读不到的标记写进 note；
//   4. 纯读——预估不写 state、不消耗随机数，重复调用结果一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, combatOdds, createGameState, legalMoves, spawnEnemy } from '../src/engine/engine.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { viewState } from '../src/integration/observation.js'

function settle(state) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, '开局待决选择过多')
    const choice = state.pendingChoice
    const option = choice.options.find(item => ['done', 'skip', 'self'].includes(item.id)) || choice.options[0]
    applyMove(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
}

function fixture() {
  const state = createGameState({
    legacyAutoStart: true, playerInvestigator: '01001', playerCount: 1, teammates: 0, opponents: [],
    seed: 'ai-combat-odds', difficulty: 'standard',
  }, [{ seat: 0 }])
  settle(state)
  state.currentSeat = 0
  return state
}

// 罗兰（战斗 4 / 敏捷 2）+ .45 自动手枪（战斗 +1，伤害 +1）+ 食尸鬼爪牙（战斗 2 / 躲避 2 / 生命 2）。
function combatScene() {
  const state = fixture()
  const inv = state.investigators[0]
  inv.assets.push({ id: 'gun', code: '01016', uses: 4, usesType: 'ammo', exhausted: false })
  const enemy = spawnEnemy(state, '01160', inv.location, 0)
  assert.ok(enemy, '食尸鬼爪牙应能生成')
  return { state, inv, enemy }
}

const contextOf = (state, seat = 0) => JSON.parse(aiDecisionContext(state, seat).split('\n')[2])
const oddsRows = context => (context.actionCosts || []).filter(row => row.odds)
const oddsOf = (state, action, pick = () => true) => {
  const move = legalMoves(state, 0).find(item => item.action === action && pick(item))
  assert.ok(move, `合法行动里应有 ${action}`)
  return combatOdds(state, 0, move)
}

test('攻击/躲避/武器能力都给出预估，且与混乱袋逐枚对得上', () => {
  const { state } = combatScene()
  const fight = oddsOf(state, 'fight')
  assert.equal(fight.kind, 'fight')
  assert.equal(fight.skill, 'combat')
  assert.equal(fight.value, 4, '罗兰基础战斗 4；普通攻击不吃武器加值')
  assert.equal(fight.target, 2, '食尸鬼爪牙战斗 2')
  assert.equal(fight.need, -2, '需要标记至少 -2')
  assert.equal(fight.tokens, 16)
  // 标准袋里低于 -2 的只有 -3 / -4 / autofail 三枚 => 13/16。
  assert.equal(fight.chance, 0.81)
  assert.equal(fight.damage, 1, '普通攻击基础伤害 1')
  assert.equal(fight.hits, 2, '2 点生命的敌人需要命中两次')

  const evade = oddsOf(state, 'evade')
  assert.equal(evade.kind, 'evade')
  assert.equal(evade.value, 2, '罗兰敏捷 2')
  assert.equal(evade.target, 2)
  assert.equal(evade.chance, 0.25, '+1、两个 0 与旧印(+2) 共四枚')
  assert.equal(evade.damage, undefined, '躲避不造成伤害')

  const shooting = oddsOf(state, 'ability', move => move.targetId != null)
  assert.equal(shooting.value, 5, '手枪战斗 +1')
  assert.equal(shooting.chance, 0.88, '只有 -4 与 autofail 会失败')
  assert.equal(shooting.damage, 2, '手枪伤害 +1')
  assert.equal(shooting.hits, 1, '2 点生命一枪打死')
})

test('预估只出现在 AI 决策资料里，牌桌视图与合法行动都不带', () => {
  const { state } = combatScene()
  const context = contextOf(state)
  assert.ok(oddsRows(context).length >= 3, '决策资料的 actionCosts 应带 odds')
  assert.ok(!JSON.stringify(legalMoves(state, 0)).includes('"odds"'))
  assert.ok(!JSON.stringify(viewState(state, 0, { includeStatic: false })).includes('"odds"'))
})

test('非战斗行动没有 odds；待决选择期间不给预估', () => {
  const { state } = combatScene()
  const context = contextOf(state)
  for (const row of context.actionCosts) {
    if (row.odds) {
      assert.ok(['fight', 'evade'].includes(row.odds.kind), `只有攻击/躲避该有 odds：${row.move.action}`)
      continue
    }
    assert.ok(!['fight', 'evade', 'extraEvade'].includes(row.move.action), `${row.move.action} 应带 odds`)
  }
  const weapon = context.actionCosts.find(row => row.move.action === 'ability')
  assert.equal(weapon.odds.kind, 'fight', '武器能力按攻击预估')
  state.pendingChoice = { id: 'probe', kind: 'reaction', seat: 0, prompt: '测试', options: [{ id: 'skip' }] }
  const move = { action: 'fight', enemyId: state.enemies[0].id }
  assert.equal(combatOdds(state, 0, move), null)
})

test('剧本没有 tokenMeanings 时按 SYMBOL_DEFAULTS 兜底（骷髅 -1、邪教徒 -2、石板 -3）', () => {
  const { state } = combatScene()
  delete state.scenario.tokenMeanings
  const fight = oddsOf(state, 'fight')
  // 需要标记 ≥ -2：失败的变成 -3 / -4 / 石板(-3) / autofail 共四枚 => 12/16。
  assert.equal(fight.chance, 0.75)
  assert.equal(fight.note, undefined, '兜底表覆盖到的标记不算未知')
})

test('袋里有读不到取值的标记时把不确定性写进 note，而不是假装精确', () => {
  const { state } = combatScene()
  delete state.scenario.tokenMeanings
  state.chaosBag.push('blight')
  const fight = oddsOf(state, 'fight')
  assert.match(fight.note || '', /取值未知/)
  assert.match(fight.note || '', /blight/)
})

test('反击/警戒写进 onFail；失败代价用敌人当前伤害与恐惧', () => {
  const { state, enemy } = combatScene()
  enemy.retaliate = true
  enemy.alert = true
  assert.deepEqual(oddsOf(state, 'fight').onFail, { retaliate: { damage: 1, horror: 1 } })
  assert.deepEqual(oddsOf(state, 'evade').onFail, { alert: { damage: 1, horror: 1 } })
})

test('预估是纯读：不写 state、不消耗随机数、重复调用一致', () => {
  const { state } = combatScene()
  const before = JSON.stringify(state)
  const move = legalMoves(state, 0).find(item => item.action === 'fight')
  const first = combatOdds(state, 0, move)
  const second = combatOdds(state, 0, move)
  assert.deepEqual(first, second)
  assert.equal(JSON.stringify(state), before)
})
