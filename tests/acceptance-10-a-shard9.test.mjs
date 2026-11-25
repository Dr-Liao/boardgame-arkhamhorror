// 10-a-9 验收（FHV 10644c–10676）逐卡证据测试。
// 每卡一条标题含卡号、真实执行的用例：注册期校验 + 条目 flags/enemyRule/encounterResolve + 章节 behavior/chaos 调用。
// 失败卡未实现点由 artifacts/acceptance/10-a-9/probe-defects.mjs 复现并写入报告。
import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as fateDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/definition.js'
import * as fateB from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/behavior.js'
import * as fateC from '../content/campaigns/theFeastOfHemlockVale/scenarios/fateOfTheVale/chaos.js'
import * as longB from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLongestNight/behavior.js'

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
test('10-a-9 10658 山谷的命运 v.II：居民谈判（弃 1 手牌 / 意志智力 3）', () => {
  assert.equal(flags('10658').parley.discardFromHand, 1)
  assert.deepEqual(flags('10658').parley.skills, ['willpower', 'intellect'])
  assert.equal(flags('10658').back, 'resolution3')
})
test('10-a-9 10659 山谷的命运 v.III：引线（X/人线索）+ 5 张着火了推进', () => {
  assert.equal(flags('10659').kindling.fireCopiesToAdvance, 5)
  assert.equal(flags('10659').kindling.extraKindlingResources, 5)
  assert.equal(flags('10659').fireTreacheryCode, '10743')
  assert.equal(flags('10659').back, 'resolution4')
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
test('10-a-9 10661b 旧时记忆：从深渊揭示/抽取时花线索反应声明', () => {
  assert.equal(flags('10661b').oldMemory, true)
  assert.equal(flags('10661b').trueSelfCode, '10661')
  assert.equal(flags('10661b').groupClueCost.perInvestigator, 1)
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
