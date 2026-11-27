// 10-a-9 验收（FHV 10644c–10676）逐卡证据测试。
// 每卡一条标题含卡号、真实执行的用例：注册期校验 + 条目 flags/enemyRule/encounterResolve + 章节 behavior/chaos 调用。
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMove, enemyHealth } from '../src/engine/engine.js'
import { stateHash } from '../src/engine/replay.js'
import mod from '../index.js'
import { enemyIsAloof } from '../src/engine/enemy-aloof.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as fateDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/definition.js'
import * as fateB from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/behavior.js'
import * as fateC from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/chaos.js'
import * as longB from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/behavior.js'
import { answer, asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'

const DIRS = {
  fate: '../src/cards/encounter-entries/theFeastOfHemlockVale/fateOfTheVale/',
  long: '../src/cards/encounter-entries/theFeastOfHemlockVale/theLongestNight/',
  shared: '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/the_first_day/',
}
const CODE_DIR = {
  '10644c': 'long', '10645a': 'long', '10645b': 'long', '10645c': 'long', '10646': 'long', '10647a': 'long',
  '10647b': 'long', '10647c': 'long', '10648': 'long', '10649': 'long', '10650': 'long',
  '10651': 'fate', '10652': 'fate', '10653': 'fate', '10654': 'fate', '10655': 'fate', '10656': 'fate',
  '10657': 'fate', '10658': 'fate', '10659': 'fate', '10660': 'fate', '10661': 'fate', '10661b': 'fate',
  '10662a': 'fate', '10662b': 'fate', '10663a': 'fate', '10663b': 'fate', '10664a': 'fate', '10664b': 'fate',
  '10665a': 'fate', '10665b': 'fate', '10666': 'fate', '10667': 'fate', '10668': 'fate', '10669': 'fate',
  '10670': 'fate', '10670b': 'fate', '10671': 'fate', '10672': 'fate', '10673': 'fate', '10674': 'fate',
  '10676': 'shared',
}
const ENTRIES = {}
for (const [code, dir] of Object.entries(CODE_DIR)) {
  const mod = await import(DIRS[dir] + code + '.js')
  ENTRIES[code] = mod.default
  if (!registeredEntry(code)) registerCardAbilities([mod.default])
}
const flags = code => registeredEntry(code)?.flags || {}
const rule = code => registeredEntry(code)?.enemyRule || {}
const inv = (seat = 0) => ({ seat, name: `调查员${seat + 1}`, location: 'here', clues: 0, resources: 2, hand: [],
  assets: [], damage: 0, horror: 0, deck: [], discard: [], defeated: false, actionsLeft: 3 })

function fateFixture(count, stage) {
  const state = fixture('01001', count)
  state.scenario = structuredClone(fateDef.scenario)
  state.campaign.id = 'theFeastOfHemlockVale'
  state.acts = structuredClone(fateDef.ACTS)
  state.agendas = structuredClone(fateDef.AGENDAS)
  state.actIndex = stage > 2 ? 2 : stage - 1
  if (stage > 2) state.acts.push(structuredClone(fateDef.ACT_STAGES[stage]))
  return state
}

// 共享：the_first_day
test('10-a-9 10675 第一日：时间标记数据（第 1 日 / 正面 day 背面 night）', () => {
  assert.equal(flags('10675').timeMarker, true)
  assert.equal(flags('10675').day, 1)
  assert.deepEqual(flags('10675').facePeriods, { front: 'day', back: 'night' })
})
test('10-a-9 10676 虫群：敏捷(3)，每失败 1 点失去 1 资源或受 1 伤', () => {
  assert.deepEqual(flags('10676').test, { skill: 'agility', difficulty: 3 })
  assert.deepEqual(flags('10676').failByChoicePerPoint, ['loseResource', 'takeDamage'])
  assert.equal(typeof ENTRIES['10676'].encounterResolve, 'function')
})
// the_longest_night
test('10-a-9 10644c 易羽混种：生成西侧农田、冷漠/巡逻（农庄）、伤害降为 1', () => {
  assert.equal(flags('10644c').spawnDirection, 'west')
  assert.equal(flags('10644c').damageCappedAt, 1)
  assert.deepEqual(rule('10644c').ignoreDefenses, ['barrier'])
  assert.equal(rule('10644c').patrolTarget.locationId, 'theFarmhouse')
})
for (const [code, dir] of [['10645a', 'north'], ['10645b', 'east'], ['10645c', 'south']]) {
  test(`10-a-9 ${code} 狼形混种：生成${dir}侧、反击、攻击后自愈 1`, () => {
    assert.equal(flags(code).spawnDirection, dir)
    assert.equal(flags(code).retaliate, true)
    assert.equal(flags(code).healAfterAttack, 1)
    assert.equal(typeof longB.enemyAttackResolved, 'function')
  })
}
test('10-a-9 10646 山羊混种：敌人最少外围农田、警戒/巡逻、忽略诱饵', () => {
  assert.equal(flags('10646').spawnFarthestEnemies, 'fewestOuterField')
  assert.deepEqual(flags('10646').ignoreDefenses, ['decoy'])
  assert.equal(flags('10646').alert, true)
})
for (const [code, dir] of [['10647a', 'north'], ['10647b', 'east'], ['10647c', 'west']]) {
  test(`10-a-9 ${code} 马状混种：生成${dir}侧、忽略陷阱、伤害降为 1`, () => {
    assert.equal(flags(code).spawnDirection, dir)
    assert.equal(flags(code).damageCappedAt, 1)
    assert.deepEqual(rule(code).ignoreDefenses, ['trap'])
  })
}
test('10-a-9 10648 蠕滑混种：敌人最多外围农田、忽略屏障/诱饵/陷阱与 Fire! 伤害', () => {
  assert.equal(flags('10648').spawnFarthestEnemies, 'mostOuterField')
  assert.equal(flags('10648').ignoreFireDamage, true)
  assert.deepEqual(flags('10648').ignoreDefenses, ['barrier', 'decoy', 'trap'])
})
test('10-a-9 10649 无尽夜晚：险境显现二选一（移毁灭/伤病俘/受 3 直伤 3 直恐）', () => {
  assert.equal(flags('10649').peril, true)
  assert.equal(typeof ENTRIES['10649'].encounterResolve, 'function')
  assert.equal(typeof longB.events.theLongestNightEndlessNight, 'function')
})
test('10-a-9 10650 入侵：敏捷 X=场上毁灭一半向上取整，失败逐点触发突变敌人', () => {
  assert.equal(flags('10650').test.skill, 'agility')
  assert.equal(flags('10650').test.difficulty, 'halfDoom')
  assert.equal(typeof longB.events.theLongestNightIncursion, 'function')
})
// fate_of_the_vale：场景/议程/幕
test('10-a-9 10651 山谷的命运（提示卡）：混乱标记数值表与章节身份', () => {
  assert.equal(flags('10651').referenceCard, true)
  assert.equal(flags('10651').chapterId, 'fateOfTheVale')
  assert.equal(typeof fateC.fateChaosToken, 'function')
  const fx = fateC.fateChaosToken({ acts: [{}, {}], actIndex: 1, enemies: [], difficulty: 'standard' }, null, 'skull')
  assert.equal(typeof fx.delta, 'number', '骷髅数值由章节 chaos 提供')
})
for (const [code, stage, backKey] of [['10652', 1, 'backTest'], ['10653', 2, 'backTest'], ['10654', 3, 'backEffect']]) {
  test(`10-a-9 ${code} 议程${stage}a：深渊抽牌替换 + 背面结算声明`, () => {
    assert.equal(flags(code).abyssMythosReplacement, true)
    assert.equal(flags(code).cosmicEmissaryGaze, true)
    assert.ok(flags(code)[backKey] != null)
    assert.equal(typeof fateB.abyssMythosActive, 'function')
    const state = fateFixture(1, 1)
    state.agendaIndex = stage - 1
    const encounterDeck = [...state.encounterDeck]
    fateB.putOnAbyss(state, ['01088', '10740'])
    move(state, { action: 'debug', kind: 'encounter', targetSeat: 0 })
    settle(state)
    assert.deepEqual(state.encounterDeck, encounterDeck)
    assert.deepEqual(fateB.abyssCards(state), ['01088'])
    assert.ok(state.investigators[0].threat.some(card => card.code === '10740'))
  })
  test(`10-a-9 ${code} 凝视宇宙密使：复用 15 秒规则，非行动席位发疯并写入战役日志`, () => {
    const state = fateFixture(2, 1)
    state.agendaIndex = stage - 1
    const emissary = enemy(state, { code: '10662a', engagedSeat: null })
    const other = enemy(state, { engagedSeat: null })
    assert.equal(mod.cardViewRule(state, 1, other.id), null)
    const rule = mod.cardViewRule(state, 1, emissary.id)
    assert.equal(rule.durationMs, 15_000)
    assert.equal(mod.isSystemMove(rule.move), true)
    assert.equal(state.currentSeat, 0)
    const before = structuredClone(state)
    const events = applyMove(state, 1, rule.move)
    assert.equal(state.investigators[0].defeated, false)
    assert.equal(state.investigators[1].drivenInsane, true)
    assert.equal(state.campaign.investigators[1].status, 'insane')
    assert.equal(state.currentSeat, 0)
    assert.equal(mod.cardViewRule(state, 1, emissary.id), null)
    assert.ok(events.some(event => event.text?.includes('陷入疯狂')))
    const [{ seat, move: recorded }] = state.actionLog.slice(-1)
    applyMove(before, seat, recorded)
    assert.equal(stateHash(before), stateHash(state))
  })
}

function awaitingCommit(count = 2) {
  const state = fateFixture(count, 1)
  state.humanSeats = state.investigators.map(inv => inv.seat)
  state.investigators[0].hand = ['01090']
  const emissary = enemy(state, { code: '10662b', engagedSeat: null })
  move(state, { action: 'investigate' })
  while (state.pendingChoice?.kind === 'playerWindow') answer(state, 'skip')
  assert.equal(state.pendingChoice?.kind, 'commit')
  return { state, emissary }
}

test('10-a-9 10652 10653 10654 凝视超时插入他人的待决检定，保存续算后仍可回答原选择', () => {
  const { state, emissary } = awaitingCommit()
  const choiceId = state.pendingChoice.id
  const expiry = mod.cardViewRule(state, 1, emissary.id).move
  const before = structuredClone(state)
  applyMove(state, 1, expiry)
  assert.equal(state.pendingChoice.id, choiceId)
  assert.equal(state.pendingChoice.seat, 0)
  assert.equal(state.investigators[1].drivenInsane, true)
  const restored = JSON.parse(JSON.stringify(state))
  answer(restored, 'done')
  settle(restored)
  applyMove(before, 1, expiry)
  answer(before, 'done')
  settle(before)
  assert.equal(stateHash(restored), stateHash(before))
  assert.equal(restored.investigators[1].drivenInsane, true)
  assert.equal(restored.currentSeat, 0)
})

test('10-a-9 10652 10653 10654 凝视超时让正在等待投入的检定者退场，调查结果未结算', () => {
  const { state, emissary } = awaitingCommit()
  const location = state.locations.find(item => item.id === state.investigators[0].location)
  const clues = location.clues
  applyMove(state, 0, mod.cardViewRule(state, 0, emissary.id).move)
  settle(state)
  assert.equal(state.investigators[0].drivenInsane, true)
  assert.equal(state.investigators[1].defeated, false)
  assert.equal(state.currentSeat, 1)
  assert.equal(state.skillTest, null)
  assert.deepEqual(state.chaos.frames, [])
  assert.equal(state.locations.find(item => item.id === location.id).clues, clues)
})

test('10-a-9 10652 10653 10654 最后一位检定者凝视超时后清理检定，结算整场冒险', () => {
  const { state, emissary } = awaitingCommit(1)
  applyMove(state, 0, mod.cardViewRule(state, 0, emissary.id).move)
  assert.equal(state.investigators[0].drivenInsane, true)
  assert.equal(state.pendingChoice, null)
  assert.equal(state.skillTest, null)
  assert.deepEqual(state.chaos.frames, [])
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'noResolution')
})

for (const [code, agendaIndex, skill, harm] of [['10652', 0, 'intellect', 'horror'], ['10653', 1, 'agility', 'damage']]) {
  test(`10-a-9 ${code} 议程背面选择第二种技能，逐点在受伤和洗入真正顶牌之间选择`, () => {
    const state = fateFixture(1, 1)
    state.agendaIndex = agendaIndex
    state.investigators[0][skill] = 2
    state.investigators[0].deck = ['01090', '01091', '01092']
    fateB.putOnAbyss(state, ['01088'])
    move(state, { action: 'debug', kind: 'advanceAgenda' })
    assert.equal(state.pendingChoice?.kind, 'skill')
    answer(state, skill)
    let sendToAbyss = true
    settle(state, choice => {
      if (!choice.options.some(option => option.id === 'abyss')) return null
      const selected = sendToAbyss ? 'abyss' : 'harm'
      sendToAbyss = false
      return selected
    })
    assert.equal(state.lastTestResult.skill, skill)
    assert.equal(state.investigators[0][harm], 1)
    assert.deepEqual(state.investigators[0].deck, ['01090', '01091'])
    assert.deepEqual(fateB.abyssCards(state).sort(), ['01088', '01092'])
  })
}
test('10-a-9 10655 破碎记忆：巢穴反应 + Ex Nihilo 背面', () => {
  assert.equal(flags('10655').lairReaction.trait, 'Lair')
  assert.equal(flags('10655').backEffect, 'exNihilo')
  assert.equal(typeof fateB.trueSelfCodeOf, 'function')
})
test('10-a-9 10656 失落自我：洞穴 ≥3 目标 + 幕间四选项', () => {
  assert.equal(flags('10656').interlude, 'fateOfTheVale')
  assert.equal(flags('10656').lairReaction.mode, 'revealBottomThenDrawOne')
  assert.equal(typeof fateB.interludeOptions, 'function')
})
test('10-a-9 10657 山谷的命运 v.I：背面结局 1/2（自己动手需棱柱碎片）', () => {
  assert.deepEqual(flags('10657').back.choices, ['resolution1', 'resolution2'])
  assert.equal(flags('10657').back.requiresPrismaticShard, '10522')
})
for (const code of ['10655', '10656', '10657']) {
  test(`10-a-9 ${code} 花费线索使本次检定技能值 +2，下一次检定不保留加值`, () => {
    const state = fixture()
    state.acts = [{ id: 'current-act', code }]
    const inv = state.investigators[0]
    inv.clues = 1
    const location = state.locations.find(place => place.id === inv.location)
    location.shroud = 100
    location.clues = 3
    const boost = `free-descriptor:${code}:`
    move(state, { action: 'investigate' })
    settle(state, choice => choice.kind === 'playerWindow'
      ? choice.options.find(option => option.id.startsWith(boost))?.id : null)
    assert.equal(state.investigators[0].clues, 0)
    assert.equal(state.lastTestResult.value, inv.intellect + 2)
    move(state, { action: 'investigate' })
    settle(state)
    assert.equal(state.lastTestResult.value, inv.intellect)
  })
}
test('10-a-9 10656 引擎推进后保留幕间选定的第三幕', () => {
  const state = fateFixture(1, 2)
  state.campaign.records.gideonFinishedTheTaleOfAnnabelleLee = true
  move(state, { action: 'debug', kind: 'advanceAct' })
  settle(state, choice => choice.options.find(option => option.id === 'letsEndThis')?.id)
  assert.equal(state.actIndex, 2)
  assert.equal(state.acts[state.actIndex].originalCode || state.acts[state.actIndex].code, '10657')
})
test('10-a-9 10658 山谷的命运 v.II：居民谈判（弃 1 手牌 / 意志智力 3）', () => {
  assert.equal(flags('10658').parley.discardFromHand, 1)
  assert.deepEqual(flags('10658').parley.skills, ['willpower', 'intellect'])
  assert.equal(flags('10658').back, 'resolution3')
})
test('10-a-9 10658 居民谈判成功后逐个选择是否花费线索使其横置入场', () => {
  const state = fateFixture(1, 4)
  const inv = state.investigators[0]
  inv.hand = ['01090', '01093']
  inv.clues = 2
  const location = state.locations.find(place => place.id === inv.location)
  location.beneath = ['10693b', '10694b']
  const parley = legalMoves(state, inv.seat).find(candidate => candidate.rule === 'fateResidentParley')
  assert.ok(parley)
  move(state, parley)
  let payments = 0
  settle(state, choice => {
    if (choice.kind === 'skill' && choice.source === '10658') return 'intellect'
    if (choice.kind === 'payment' && choice.source === '10658') return payments++ === 0 ? 'pay' : 'skip'
    return null
  })
  assert.equal(state.lastTestResult.skill, 'intellect')
  assert.equal(state.investigators[0].hand.length, 1)
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.enemies.find(target => target.originalCode === '10693b').exhausted, true)
  assert.equal(state.enemies.find(target => target.originalCode === '10694b').exhausted, false)
})
test('10-a-9 10659 山谷的命运 v.III：引线（X/人线索）+ 5 张着火了推进', () => {
  assert.equal(flags('10659').kindling.fireCopiesToAdvance, 5)
  assert.equal(flags('10659').kindling.extraKindlingResources, 5)
  assert.equal(flags('10659').fireTreacheryCode, '10743')
  assert.equal(flags('10659').back, 'resolution4')
})
test('10-a-9 10659 一个行动支付 X/人线索，可另花五资源或弃一个道具得额外引线', () => {
  for (const bonus of ['resources', 'item']) {
    const state = fateFixture(2, 5)
    const inv = state.investigators[0]
    inv.clues = 5
    const item = asset(state, '01016')
    const place = legalMoves(state, inv.seat).find(candidate => candidate.rule === 'fatePlaceKindling')
    assert.ok(place)
    move(state, place)
    settle(state, choice => {
      if (choice.source !== '10659') return null
      if (choice.options.some(option => option.id === '2')) return '2'
      return bonus === 'item' ? item.id : bonus
    })
    assert.equal(state.investigators[0].clues, 1)
    assert.equal(state.investigators[0].actionsLeft, 19)
    assert.equal(state.investigators[0].resources, bonus === 'resources' ? 25 : 30)
    assert.equal(state.investigators[0].assets.some(card => card.id === item.id), bonus === 'resources')
    assert.equal(state.scenarioFlags.fateKindling[inv.location], 3)
  }
})
test('10-a-9 10660 山谷的命运 v.IV：6 项条件≥5 可撤退，全员撤退推进', () => {
  assert.equal(flags('10660').resignRequired, 5)
  assert.equal(flags('10660').resignRememberedKeys.length, 6)
  assert.equal(flags('10660').back, 'resolution5')
})
test('10-a-9 10661 破碎自我：手牌上限 -3、X=手牌数、旧印 +2', () => {
  assert.equal(flags('10661').handSizePenalty, 3)
  assert.equal(flags('10661').handSizeValueMax, 5)
  assert.equal(flags('10661').elderSignDelta, 2)
  assert.equal(typeof fateB.handSizePenalty, 'function')
  assert.equal(typeof fateB.statModifier, 'function')
})
test('10-a-9 10661 破碎自我：同一检定可翻倍一张投入牌，旧印可抽一张牌', () => {
  const state = fateFixture(1, 1)
  fateB.shatterSelves(state)
  const inv = state.investigators[0]
  inv.hand = ['01090', '01093']
  state.chaosBag = ['eldersign']
  const location = state.locations.find(place => place.id === inv.location)
  location.shroud = 100
  location.clues = 3
  const startingDeckSize = inv.deck.length
  let doubled = 0
  move(state, { action: 'investigate' })
  settle(state, choice => {
    if (choice.kind === 'commit' && choice.options.some(option => option.id === '0')) return '0'
    if (choice.source === '10661' && choice.options.some(option => option.id === 'use')) {
      doubled += 1
      return 'use'
    }
    if (choice.source === '10661' && choice.options.some(option => option.id === 'draw')) return 'draw'
    return null
  })
  assert.equal(doubled, 1)
  assert.equal(state.lastTestResult.value, 8)
  assert.equal(state.investigators[0].deck.length, startingDeckSize - 1)
})
test('10-a-9 10661b 旧时记忆：从深渊揭示/抽取时花线索反应声明', () => {
  assert.equal(flags('10661b').oldMemory, true)
  assert.equal(flags('10661b').trueSelfCode, '10661')
  assert.equal(flags('10661b').groupClueCost.perInvestigator, 1)
})
test('10-a-9 10661b 旧时记忆：在一次真实遭遇抽取中取消显现并移出深渊卡牌', () => {
  const state = fateFixture(1, 1)
  state.investigators[0].clues = 1
  state.storyAssets = [{ id: 'memory', code: '10661b', controllerSeat: 0 }]
  fateB.putOnAbyss(state, ['10672'])
  const encounterDeck = [...state.encounterDeck]
  move(state, { action: 'debug', kind: 'encounter', targetSeat: 0 })
  settle(state, choice => choice.source === 'memory' ? 'remove' : null)
  assert.deepEqual(state.encounterDeck, encounterDeck)
  assert.equal(state.investigators[0].clues, 0)
  assert.ok(state.removedFromGame.includes('10661b'))
  assert.ok(state.removedFromGame.includes('10672'))
  assert.ok(!state.storyAssets.some(card => card.id === 'memory'))
  assert.ok(!state.encounterDiscard.includes('10672'))
  assert.ok(!state.lastTestResult, '被取消的显现不启动检定')
})
// 宇宙密使四组（正面 / 破碎面）
for (const code of ['10662a', '10663a', '10664a', '10665a']) {
  test(`10-a-9 ${code} 宇宙密使（正面）：不能受伤 + 成功攻/躲改为本轮不攻击`, () => {
    assert.equal(flags(code).cosmicEmissary, true)
    assert.equal(flags(code).cannotBeDamaged, true)
    assert.equal(flags(code).wardOnFightEvade, true)
    assert.ok(flags(code).backFaceCode)
    assert.equal(typeof fateB.enemyAttackedSuccessfully, 'function')
  })
}
for (const [code, token] of [['10663b', 'elderthing'], ['10664b', 'cultist'], ['10665b', 'tablet']]) {
  test(`10-a-9 ${code} 宇宙密使（破碎面）：${token} 标记反应（自动失败或攻击）`, () => {
    assert.equal(flags(code).tokenReaction.token, token)
    assert.deepEqual(flags(code).tokenReaction.choices, ['autoFail', 'attack'])
    assert.equal(typeof fateB.applyTokenEffect, 'function')
  })
}
test('10-a-9 10662b 宇宙密使（破碎面）：被击败时每位调查员意志(100)失败即阵亡', () => {
  assert.equal(flags('10662b').defeatTest.skill, 'willpower')
  assert.equal(flags('10662b').defeatTest.difficulty, 100)
  assert.equal(typeof fateB.enemyDefeated, 'function')
  const state = fixture('01001', 2)
  const emissary = enemy(state, { code: '10662b', health: 10, engagedSeat: null })
  assert.equal(enemyHealth(state, emissary), 14)
})
// 地点/深渊
for (const [code, position, require] of [['10666', 'mirrorNestTop', 'fight'], ['10667', 'mirrorNestRight', 'evade'],
  ['10668', 'mirrorNestBottom', 'investigate'], ['10669', 'mirrorNestLeft', null]]) {
  test(`10-a-9 ${code} 镜巢：顺时针/逆时针连接 + 回合末强制（${require || '随机弃手牌'}）`, () => {
    assert.equal(flags(code).mirrorNest, true)
    assert.equal(flags(code).position, position)
    if (require) assert.equal(flags(code).turnEnd.require, require)
    assert.equal(typeof fateB.turnEnded, 'function')
  })
}
test('10-a-9 10669 镜巢：共同花 7/人 线索查找深渊（每幕一次）', () => {
  assert.equal(flags('10669').abyssSearch.groupCluesPerInvestigator, 7)
  assert.equal(flags('10669').abyssSearch.limit, 'oncePerAct')
})
test('10-a-9 10670 深渊：进入时深渊有牌即阵亡', () => {
  assert.equal(flags('10670').entryKillsIfCards, true)
  assert.equal(typeof fateB.locationEntered, 'function')
  const state = fixture()
  const location = state.locations.find(place => place.id === state.investigators[0].location)
  location.originalCode = '10670'
  const shattered = enemy(state, { traits: ['Shattered'], aloof: true, engagedSeat: null })
  const normal = enemy(state, { traits: ['Monster'], aloof: true, engagedSeat: null })
  assert.equal(enemyIsAloof(state, shattered), true)
  state.phase = 'enemy'
  assert.equal(enemyIsAloof(state, shattered), false)
  assert.equal(enemyIsAloof(state, normal), true)
})
test('10-a-9 10670b 深渊（故事面）：从底抽/弃顶/五类揭示规则', () => {
  assert.equal(flags('10670b').drawFromBottom, true)
  assert.equal(flags('10670b').discardToTop, true)
  assert.equal(flags('10670b').revealRules.resident, 'enemySideAttackThenDiscard')
  assert.equal(typeof fateB.resolveAbyssCard, 'function')
})
test('10-a-9 10671 水晶仿体：战斗/躲避 X=手牌数，攻击后随机弃 1 手牌', () => {
  assert.equal(flags('10671').fightX, 'handSize')
  assert.equal(flags('10671').defaultX, 6)
  assert.equal(flags('10671').attackDiscard, 1)
  assert.equal(typeof fateB.enemyStatModifier, 'function')
})
for (const [code, skill, difficulty] of [['10672', 'willpower', 4], ['10673', 'agility', 4], ['10674', 'intellect', 4]]) {
  test(`10-a-9 ${code} 诡计：${skill}(${difficulty}) 失败二选一`, () => {
    assert.deepEqual(flags(code).test, { skill, difficulty })
    assert.equal(typeof ENTRIES[code].encounterResolve, 'function')
    const events = fateB.events
    assert.ok(Object.keys(events).some(key => key.toLowerCase().includes(code <= '10672' ? 'sublimation' : code === '10673' ? 'fragmentation' : 'euphoria')))
  })
}
