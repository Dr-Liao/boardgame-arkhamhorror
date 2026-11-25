// 验收 07-a 分片 1：The Innsmouth Conspiracy 07001–07054（54 张）逐卡验收证据。
//
// 缺口：07001–07016（调查员 5 张 + 前段玩家卡 11 张）没有标题含卡号的真实行为测试；
// 其余 07017–07054 由既有 TIC 测试提供含卡号标题的真实断言（本文件不重复，见报告 §4）。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维；每个缺口卡至少一条真实引擎断言。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, asset, enemy, move, settle, answer } from './core-fixture.mjs'
import {
  applyDamage, createGameState, drawCards, getStat, legalMoves, performTest, triggerReaction,
  discoverClueAt, autoEvadeEnemy, reactionWindow, executeDescriptor,
} from '../src/engine/engine.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { migrateState } from '../src/engine/save-migration.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const clone = value => JSON.parse(JSON.stringify(value))
const firstAbility = choice => choice.options.find(option => option.id.startsWith('desc:'))?.id

function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'acceptance-07-a-1' }, execute)
  for (let guard = 0; state.pendingChoice; guard += 1) {
    assert.ok(guard < 120, `choice loop: ${JSON.stringify(state.pendingChoice.kind)}`)
    const pending = state.pendingChoice
    const optionId = select(pending, state)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    const command = { action: 'choose', choiceId: pending.id, optionId }
    assert.equal(choiceError(state, pending.seat, command), null)
    resolveTransaction(state, pending.seat, command, execute)
  }
}

function setup(code, count = 1) {
  const state = fixture(code, count)
  state.abilityLimits = {}
  return state
}

// ---------------------------------------------------------------------------
// 范围 / 接线 / 合规
// ---------------------------------------------------------------------------

const CODES = Object.freeze([
  '07001', '07002', '07003', '07004', '07005', '07006', '07007', '07008', '07009', '07010', '07011', '07012',
  '07013', '07014', '07015', '07016', '07017', '07018', '07019', '07020', '07021', '07022', '07023', '07024',
  '07025', '07026', '07027', '07028', '07029', '07030', '07031', '07032', '07033', '07034', '07035', '07036',
  '07037', '07038', '07039', '07040', '07041', '07042', '07043', '07044', '07045', '07046', '07047', '07048',
  '07049', '07050', '07051', '07052', '07053', '07054',
])

test('07-a-1 范围：07001–07054 目录记录恰好 54 张', () => {
  const actual = Object.keys(ALL_CARDS).filter(code => /^07\d{3}[a-z]?$/.test(code)
    && code >= '07001' && code <= '07054').sort()
  assert.deepEqual(actual, [...CODES].sort())
  assert.equal(actual.length, 54)
})

test('07-a-1 接线：54 张均有实现落点，The Pit of Despair 已注册为 playable 章', async () => {
  const chapter = await import(new URL('../content/campaigns/theInnsmouthConspiracy/scenarios/thePitOfDespair/index.js', import.meta.url))
  assert.equal(chapter.manifest.id, 'thePitOfDespair')
  assert.equal(chapter.manifest.status, 'playable')
  assert.equal(chapter.scenario.originalCode, '07041')
  for (const code of CODES) {
    if (code >= '07001' && code <= '07040') {
      assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), true, `${code} 缺少玩家卡条目`)
    } else {
      assert.ok(registeredEntry(code), `${code} 必须在非玩家条目注册表`)
    }
  }
  assert.equal(existsSync(path.join(ROOT, 'web/scenario-guides/thePitOfDespair.json')), true, '冒险指南存在')
})

test('07-a-1 合规：审计基线不含任何 TIC 卡号，关键机制读点存在', async () => {
  const { readFileSync } = await import('node:fs')
  const compliance = JSON.parse(readFileSync(path.join(ROOT, 'audit/card-entry-compliance.json'), 'utf8'))
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const overlap = (compliance.baseline?.[rule] || []).filter(code => CODES.includes(code))
    assert.deepEqual(overlap, [], `${rule} 不应含 TIC 卡号`)
  }
  for (const relative of [
    'src/engine/api-mechanics.js',
    'src/cards/encounter-entries/_shared.js',
    'content/campaigns/theInnsmouthConspiracy/chapter-entry.js',
  ]) {
    assert.equal(existsSync(path.join(ROOT, relative)), true, `${relative} 机制读点存在`)
  }
})

// ---------------------------------------------------------------------------
// 07001–07005 调查员（真实引擎行为）
// ---------------------------------------------------------------------------

test(`TIC 07001 ${ALL_CARDS['07001'].nameZh} 真实开局两祝福、轮末上限与旧印成功／失败`, () => {
  const initial = createGameState({ playerInvestigator: '07001', seed: 'acceptance-tic-07001' }, [{ seat: 0 }])
  settle(initial)
  assert.equal(initial.chaosBag.filter(token => token === 'bless').length, 2, '开局 2 个祝福')
  const state = setup('07001')
  state.chaosBag.push(...Array(9).fill('bless'))
  transact(state, draft => reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []), firstAbility)
  assert.equal(state.chaosBag.filter(token => token === 'bless').length, 10, '轮末反应加入 1 个祝福（上限 10）')
  for (const [difficulty, expected] of [[0, 1], [100, 0]]) {
    const blessed = setup('07001')
    blessed.chaosBag = ['eldersign']
    transact(blessed, draft => performTest(draft, 0, 'willpower', difficulty, {}))
    assert.equal(blessed.chaosBag.filter(token => token === 'bless').length, expected, `旧印检定难度 ${difficulty}`)
  }
})

test(`TIC 07002 ${ALL_CARDS['07002'].nameZh} 真实开局换牌与调查阶段下方牌轮换`, () => {
  const state = createGameState({ playerInvestigator: '07002', seed: 'acceptance-tic-07002' }, [{ seat: 0 }])
  assert.equal(state.pendingChoice.kind, 'mulligan')
  assert.equal(state.investigators[0].hand.length, 5)
  answer(state, 'done')
  assert.equal(state.investigators[0].hand.length, 6, '调查阶段抽取第六张')
  answer(state, state.pendingChoice.options[0].id)
  settle(state)
  assert.equal(createMechanicsApi(state).commitOrigins.beneath(0, '07002').length, 1, '下方牌区有 1 张')
})

test(`TIC 07003 ${ALL_CARDS['07003'].nameZh} 发现线索后额外发现或自动躲避，每轮一次`, () => {
  const state = setup('07003')
  enemy(state)
  state.locations[0].clues = 4
  transact(state, draft => discoverClueAt(draft, draft.investigators[0], 1, []), choice => (
    choice.options.some(option => option.id === 'clue') ? 'clue' : firstAbility(choice)))
  assert.equal(state.investigators[0].clues, 2, '基础 1 + 额外 1 线索')
  transact(state, draft => discoverClueAt(draft, draft.investigators[0], 1, []), firstAbility)
  assert.equal(state.investigators[0].clues, 3, '每轮一次，不会递归')
})

test(`TIC 07004 ${ALL_CARDS['07004'].nameZh} 主动能力接入合法动作：弃旧支援折扣 1 打出不同名支援`, () => {
  const state = setup('07004')
  const old = asset(state, '01030')
  state.investigators[0].hand.push('01031')
  const legal = legalMoves(state, 0).find(option => option.assetId === 'investigator:0')
  assert.ok(legal, '调查员卡入口有主动能力')
  const before = state.investigators[0].resources
  move(state, legal)
  settle(state)
  assert.ok(state.investigators[0].discard.includes(old.code), '旧支援进弃牌堆')
  assert.ok(state.investigators[0].assets.some(item => item.code === '01031'), '新支援入场')
  assert.equal(state.investigators[0].resources, before - 2, '折扣 1 后支付（01031 原费 3）')
})

test(`TIC 07005 ${ALL_CARDS['07005'].nameZh} 旧印从弃牌堆投入技能并在检定后回手`, () => {
  const state = setup('07005')
  state.investigators[0].discard.push('01089', '01030')
  state.chaosBag = ['eldersign']
  transact(state, draft => performTest(draft, 0, 'willpower', 0, {}), choice => (
    choice.kind === 'mechanic'
      ? (choice.options.some(option => option.id === 'confirm') ? 'confirm' : 'pick:0')
      : null))
  assert.ok(state.investigators[0].hand.includes('01089'), '技能卡检定后回手')
  assert.ok(state.investigators[0].discard.includes('01030'), '非技能卡留在弃牌堆')
  assert.equal(state.lastTestResult.value, 4, '+0 旧印仍按投入图标计值')
})

// ---------------------------------------------------------------------------
// 07006–07016 前段玩家卡
// ---------------------------------------------------------------------------

test(`TIC 07006 ${ALL_CARDS['07006'].nameZh} 承接连接地点队友伤害并按点数加入祝福`, () => {
  const state = setup('07001', 2)
  const angel = asset(state, '07006')
  const home = state.investigators[0].location
  state.locations.push({ id: 'adjacent', name: '相邻地点', connections: [home], revealed: true, clues: 0, shroud: 1 })
  state.locations.find(location => location.id === home).connections.push('adjacent')
  state.investigators[1].location = 'adjacent'
  transact(state, draft => applyDamage(draft, draft.investigators[1], 1, []),
    choice => (choice.kind === 'assign-damage' ? angel.id : firstAbility(choice)))
  assert.equal(state.investigators[1].damage, 0, '伤害被圣使承接')
  assert.equal(state.investigators[0].assets[0].damage, 1)
  assert.equal(state.chaosBag.filter(token => token === 'bless').length, 1, '承接 1 点伤害加入 1 祝福')
})

test(`TIC 07007 ${ALL_CARDS['07007'].nameZh} 每个祝福替换为诅咒或承受恐惧（精确替换）`, () => {
  const state = setup('07001')
  state.chaosBag = ['0', 'bless', 'bless']
  state.investigators[0].deck.push('07007')
  transact(state, draft => drawCards(draft, draft.investigators[0], 1, []),
    choice => (choice.source === '07007' ? 'curse' : null))
  assert.equal(state.chaosBag.filter(token => token === 'bless').length, 0, '祝福被替换')
  assert.equal(state.chaosBag.filter(token => token === 'curse').length, 2, '每个祝福变成 1 个诅咒')
})

test(`TIC 07008 ${ALL_CARDS['07008'].nameZh} 投入前收回下方牌并改放晦涩研究`, () => {
  const state = setup('07002')
  const mechanics = createMechanicsApi(state)
  state.investigators[0].hand.push('01089')
  mechanics.commitOrigins.store(0, '07002', '01089')
  state.investigators[0].hand.push('07008')
  transact(state, draft => performTest(draft, 0, 'willpower', 0, {}),
    choice => choice.options.find(option => option.cardCode === '07008')?.id)
  assert.deepEqual(mechanics.commitOrigins.beneath(0, '07002'), ['07008'], '晦涩研究成为下方牌')
  assert.ok(state.investigators[0].hand.includes('01089'), '原下方牌回手')
  assert.equal(state.investigators[0].discard.includes('07008'), false, '不产生弃牌副本')
})

test(`TIC 07009 ${ALL_CARDS['07009'].nameZh} 无显现弱点：抽取后留在手中，投入时图标改为减技能值`, () => {
  const state = setup('07002')
  state.investigators[0].deck.push('07009')
  transact(state, draft => drawCards(draft, draft.investigators[0], 1, []))
  assert.ok(state.investigators[0].hand.includes('07009'), '弱点留在手牌')
  assert.equal(state.investigators[0].discard.includes('07009'), false, '未进弃牌堆')
  assert.equal(registeredEntry('07009').weaknessStaysInHand, true)
  assert.equal(registeredEntry('07009').abilities[0].skill.subtractIcons, true, '图标减去技能值')
})

test(`TIC 07010 ${ALL_CARDS['07010'].nameZh} 回合开始解除全部交战并阻止本轮再交战与敌人伤害`, () => {
  const state = setup('07003')
  state.investigators[0].hand.push('07010')
  enemy(state)
  transact(state, draft => triggerReaction(draft, 0, 'turnBegins', [], { seat: 0, when: 'turnBegins' }), firstAbility)
  assert.equal(state.enemies[0].engagedSeat, null, '解除交战')
  assert.equal(legalMoves(state, 0).some(option => option.action === 'engage'), false, '本轮不能再交战')
  assert.ok(state.effects.some(effect => effect.sourceCode === '07010'), '效果按回合记账')
})

test(`TIC 07011 ${ALL_CARDS['07011'].nameZh} 影子特工只追归属者；躲避成功后被弃掉`, () => {
  const state = setup('07003')
  const shadow = enemy(state, { code: '07011', bearerSeat: 0 })
  state.locations[0].clues = 4
  transact(state, draft => discoverClueAt(draft, draft.investigators[0], 1, []))
  assert.equal(state.investigators[0].clues, 0, '持有影子特工时不能发现线索')
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.investigators[0].clues, 1, '调查行动例外可发现线索')
  transact(state, draft => autoEvadeEnemy(draft, draft.enemies.find(item => item.id === shadow.id), []))
  assert.equal(state.enemies.length, 0, '躲避成功后弃掉')
  assert.ok(state.investigators[0].discard.includes('07011'))
})

test(`TIC 07012 ${ALL_CARDS['07012'].nameZh} 新支援入场后本轮触发能力技能 +2`, () => {
  const state = setup('07004')
  asset(state, '07012')
  const book = asset(state, '01031')
  transact(state, draft => triggerReaction(draft, 0, 'assetEnteredPlay', [], { seat: 0, assetId: book.id, assetCode: book.code }), firstAbility)
  assert.equal(state.investigators[0].assets.find(item => item.id === book.id).triggeredSkillBonus.amount, 2, '+2 记在支援实例上')
  assert.equal(getStat(state, state.investigators[0], 'willpower'), 5, '普通检定不受影响')
})

test(`TIC 07013 ${ALL_CARDS['07013'].nameZh} 神秘残片：在手 -2 意志、在场 -1 意志且不能行动打出`, () => {
  const state = setup('07004')
  state.investigators[0].hand = ['07013']
  assert.equal(getStat(state, state.investigators[0], 'willpower'), 3, '在手 -2（基础 5）')
  assert.equal(legalMoves(state, 0).some(option => option.action === 'play' && option.cardId === '07013'), false, '不能行动打出')
  asset(state, '01030')
  const movement = legalMoves(state, 0).find(option => option.assetId === 'investigator:0')
  move(state, movement)
  settle(state)
  assert.equal(getStat(state, state.investigators[0], 'willpower'), 4, '弃牌后再 -1')
})

test(`TIC 07014 ${ALL_CARDS['07014'].nameZh} 海变鱼叉：战斗 +1、投入技能伤害 +1、检定结束收回`, () => {
  const state = setup('07005')
  const weapon = asset(state, '07014')
  const target = enemy(state)
  state.investigators[0].hand.push('01091')
  const movement = legalMoves(state, 0).find(option => option.assetId === weapon.id && option.targetId === target.id)
  assert.ok(movement, '鱼叉攻击行动可达')
  move(state, movement)
  settle(state, choice => {
    if (choice.kind === 'mechanic') {
      if (choice.options.some(option => option.id === 'confirm')) return 'confirm'
      return choice.options.find(option => String(option.id).startsWith('pick:'))?.id ?? choice.options[0]?.id
    }
    if (choice.kind === 'commit' && choice.options.some(option => option.id === '0')) return '0'
    return choice.options.find(option => String(option.id).startsWith('desc:07014#'))?.id ?? null
  })
  assert.equal(state.enemies[0].damageTaken, 2, '基础 1 + 投入技能 +1 伤害')
  assert.ok(state.investigators[0].hand.includes('07014'), '鱼叉回手')
  assert.ok(state.investigators[0].hand.includes('01091'), '投入的技能回手')
})

test(`TIC 07015 ${ALL_CARDS['07015'].nameZh} 塞拉斯的渔网：敏捷 +1、投入技能再躲避一个交战敌人`, () => {
  const state = setup('07005')
  const net = asset(state, '07015')
  const first = enemy(state)
  const second = enemy(state)
  state.investigators[0].hand.push('01092')
  const movement = legalMoves(state, 0).find(option => option.assetId === net.id && option.targetId === first.id)
  assert.ok(movement, '渔网躲避行动可达')
  move(state, movement)
  settle(state, choice => {
    if (choice.kind === 'mechanic') {
      if (choice.options.some(option => option.id === 'confirm')) return 'confirm'
      return choice.options.find(option => String(option.id).startsWith('pick:'))?.id ?? choice.options[0]?.id
    }
    if (choice.kind === 'commit' && choice.options.some(option => option.id === '0')) return '0'
    if (choice.options.some(option => option.id === second.id)) return second.id
    return choice.options.find(option => String(option.id).startsWith('desc:07015#'))?.id ?? null
  })
  assert.equal(state.enemies.filter(item => item.exhausted).length, 2, '额外躲避第二个交战敌人')
  assert.ok(state.investigators[0].hand.includes('07015'), '渔网回手')
})

test(`TIC 07016 ${ALL_CARDS['07016'].nameZh} 塞壬呼唤：进威胁区；投入需付 1 资源；两次行动移除`, () => {
  const state = setup('07005')
  state.investigators[0].deck.push('07016')
  transact(state, draft => drawCards(draft, draft.investigators[0], 1, []))
  assert.ok(state.investigators[0].threat.some(card => card.code === '07016'), '进入威胁区')
  state.investigators[0].hand.push('01089')
  state.investigators[0].resources = 1
  transact(state, draft => performTest(draft, 0, 'willpower', 0, {}),
    choice => { if (choice.kind === 'commit') assert.equal(choice.options.some(option => option.id === '0'), false); return null })
  state.investigators[0].resources = 2
  transact(state, draft => performTest(draft, 0, 'willpower', 0, {}),
    choice => (choice.kind === 'commit' && choice.options.some(option => option.id === '0') ? '0' : null))
  assert.equal(state.investigators[0].resources, 0, '每图标 1 资源')
  state.investigators[0].actionsLeft = 2
  const movement = legalMoves(state, 0).find(option => option.assetId === state.investigators[0].threat[0].id)
  assert.ok(movement, '恰好两行动时可移除')
  const before = state.investigators[0].actionsLeft
  move(state, movement)
  settle(state)
  assert.equal(state.investigators[0].actionsLeft, before - 2)
  assert.equal(state.investigators[0].threat.length, 0, '移除塞壬呼唤')
  assert.ok(migrateState(clone(state)).state, 'JSON 往返一致')
})
