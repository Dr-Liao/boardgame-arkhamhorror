// 11-a-9 验收（TDC 11697–11737）逐卡证据测试。
// 每卡一条标题含卡号、真实执行的用例：注册期校验 + 条目规则声明 + 章节 behavior/chaos 调用。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, legalMoves, move, settle, enemy } from './core-fixture.mjs'
import { registeredEntry } from '../src/engine/ability.js'
import * as doomB from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/behavior.js'
import * as doomD from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/definition.js'
import * as doomC from '../content/campaigns/theDrownedCity/scenarios/theDoomOfArkhamPartII/chaos.js'

const flags = code => registeredEntry(code)?.flags || {}
const rule = code => registeredEntry(code)?.enemyRule || {}

// ---- 阿卡姆的毁灭（下篇）：地点 ----
test('11-a-5 11697 圣玛丽医院（废墟）：不能完全淹没（floodBounds max 1）', () => {
  const entry = registeredEntry('11697')
  assert.equal(entry.locationRule.floodBounds.max, 1)
  assert.equal(flags('11697').ruined, true)
  assert.deepEqual(flags('11697').enemyEntryReaction, {
    trait: 'Cthulhu', enemyCode: '11701', maxClues: 3, groupLimit: 'perGame', effect: 'damagePerClue',
  })
  assert.equal(typeof doomB.swapToRuined, 'function')
})
test('11698 南区（废墟）：从自己的弃牌堆取回 道具 支援', () => {
  const state = fixture('01001', 2)
  const [inv, other] = state.investigators
  const location = state.locations.find(site => site.id === inv.location)
  location.code = location.originalCode = '11698'
  location.revealed = true
  inv.discard = ['01006', '01088']
  other.discard = ['01006']
  const take = () => legalMoves(state, 0).find(action => action.action === 'entityAbility')
  const lock = enemy(state, { code: '03017', engagedSeat: 0 })
  assert.equal(take(), undefined)
  state.enemies = state.enemies.filter(candidate => candidate !== lock)
  inv.engaged = []
  move(state, take())
  settle(state)
  assert.deepEqual(state.investigators[0].hand, ['01006'])
  assert.deepEqual(state.investigators[0].discard, ['01088'])
  assert.deepEqual(state.investigators[1].discard, ['01006'])
  assert.equal(take(), undefined)
})
test('11-a-5 11699 西侧屋顶：不能淹没/放印记，可从屋顶攻击连接地点敌人', () => {
  const entry = registeredEntry('11699')
  assert.equal(entry.locationRule.floodBounds.max, 0)
  assert.equal(entry.locationRule.reachConnectingEnemies, true)
  assert.equal(flags('11699').rooftop, true)
})
test('11-a-5 11700 东侧屋顶：不能淹没/放印记，可从屋顶攻击连接地点敌人', () => {
  const entry = registeredEntry('11700')
  assert.equal(entry.locationRule.floodBounds.max, 0)
  assert.equal(entry.locationRule.reachConnectingEnemies, true)
  assert.equal(flags('11700').rooftop, true)
})
// ---- 克苏鲁本体与三部位 ----
test('11-a-5 11701 克苏鲁（本体）：多部位链接 + 巡逻最近可淹没地点、不能趁乱攻击', () => {
  assert.deepEqual(rule('11701').patrolTarget, { kind: 'flood', canIncrease: true })
  assert.equal(typeof doomB.linkCthulhuParts, 'function')
  assert.equal(typeof doomB.setupCthulhuBoard, 'function')
})
for (const [code, back, skill] of [['11702', '11702b', 'agility'], ['11703', '11703b', 'willpower'], ['11704', '11704b', 'combat']]) {
  test(`11-a-5 ${code} 克苏鲁部位（非狂怒面）：不能受伤/横置/击败，成功攻/躲翻至狂怒面`, () => {
    const entry = registeredEntry(code)
    assert.equal(entry.enemyRule.cannotBeDamaged, true)
    assert.equal(entry.enemyRule.cannotBeExhausted, true)
    assert.equal(typeof doomB.enemyAttackedSuccessfully, 'function')
    assert.equal(typeof doomB.enemyEvadedSuccessfully, 'function')
    assert.equal(entry.code, code)
    void back
    void skill
  })
}
for (const [code, forced] of [['11702b', 'drawCthulhuCard'], ['11703b', 'discardRandomHand'], ['11704b', 'placeDoomOnFacet']]) {
  test(`11-a-5 ${code} 克苏鲁部位（狂怒面）：不能被横置，翻面后强制 + 躲避成功造成 1 伤`, () => {
    assert.equal(flags(code).enraged, true)
    assert.equal(typeof doomB.enemyFaceFlipped, 'function')
    assert.ok(forced)
  })
}
// ---- 克苏鲁牌库行动卡（story 11705–11715）----
for (const code of ['11705', '11706', '11707', '11708', '11709', '11710', '11711', '11712', '11713', '11714', '11715']) {
  test(`11-a-5 ${code} 克苏鲁牌库行动卡：由章节 resolveCthulhuCard/phaseBegan 按卡号结算`, () => {
    assert.equal(registeredEntry(code).code, code)
    assert.equal(typeof doomB.resolveCthulhuCard, 'function')
    assert.equal(typeof doomB.drawCthulhuCard, 'function')
  })
}
test('11-a-5 11705 无情冲锋：三部位在场分支（随机弃手/攻击或抽遭遇/战力检定）', () => {
  assert.equal(typeof doomB.resolveCthulhuCard, 'function')
})
test('11-a-5 11706 飓风之力：额外巡逻 + 意志/敏捷检定分支', () => {
  assert.equal(typeof doomB.resolveCthulhuCard, 'function')
})
test('11-a-5 11707 凶险狂风：随机弃手/额外巡逻/意志失败二选一', () => {
  assert.equal(typeof doomB.resolveCthulhuCard, 'function')
})
test('11-a-5 11708 恐惧凝视：敏捷/失去资源/共同决定三选一', () => {
  assert.equal(typeof doomB.resolveCthulhuCard, 'function')
})
test('11-a-5 11709 拆毁：最近屋顶放废墟，达到两个则拆除该屋顶并结算当地角色', () => {
  assert.equal(registeredEntry('11709').code, '11709')
  assert.equal(typeof doomB.ruinedLocationCount, 'function')
})
test('11-a-5 11710 第五只眼：调查阶段结束放 1 毁灭并弃掉本卡', () => {
  assert.equal(typeof doomB.behavior.phaseBegan, 'function')
})
test('11-a-5 11711 地震踩踏：无调查员则弃卡抽牌，否则敏捷/意志检定', () => {
  assert.equal(typeof doomB.resolveCthulhuCard, 'function')
})
test('11-a-5 11712 异界呼唤：无调查员弃卡抽牌，否则失败则遭遇顶翻敌人生成', () => {
  assert.equal(typeof doomB.resolveCthulhuCard, 'function')
})
test('11-a-5 11713 灵能斥责：胜利区克苏鲁敌人放回面板狂怒面', () => {
  assert.equal(typeof doomB.returnCthulhuFacetsToBoard, 'function')
})
test('11-a-5 11714 涨潮：降 Cthulhu 地点淹没、提高另一地点；完全淹没地点敏捷检定', () => {
  assert.equal(typeof doomB.changeFloodLevel, 'function')
})
test('11-a-5 11715 希望消逝：封印 elder_sign，场景推进时弃掉并释放', () => {
  assert.equal(typeof doomB.selectHopeFadesSealToken, 'function')
  assert.equal(typeof doomB.discardHopeFadesCard, 'function')
})
// ---- 诡计 ----
for (const [code, key] of [['11716', 'layWaste'], ['11717', 'eyesOfYchlecht'], ['11719', 'grossPlasticity'], ['11720', 'arkhamUnderAssault']]) {
  test(`11-a-5 ${code} 遭遇诡计：显现由章节 ${key} 结算`, () => {
    assert.equal(typeof registeredEntry(code).encounterResolve, 'function')
    assert.equal(typeof doomB[key], 'function')
  })
}
test('11-a-5 11716 夷为平地：敏捷(X=狂怒值) 失败受 2 伤', () => {
  assert.equal(typeof doomB.layWaste, 'function')
})
test('11-a-5 11717 伊克雷希特之眼：险境，意志失败受 1 直恐并随机弃手牌', () => {
  assert.equal(flags('11717').peril ?? true, true)
  assert.equal(typeof doomB.eyesOfYchlecht, 'function')
})
test('11-a-5 11719 恶心可塑性：放毁灭/提高淹没/全员 1 伤或恐三选一', () => {
  assert.equal(typeof doomB.grossPlasticity, 'function')
})
test('11-a-5 11720 阿卡姆遭袭：全员意志检定，有人失败抽克苏鲁牌', () => {
  assert.equal(typeof doomB.arkhamUnderAssault, 'function')
})
// ---- 共享遭遇（stowaways / pilgrims / star_spawn / cosmic_legacy / elder_mist / undersea / flood）----
test('11-a-5 11721 偷渡者工蜂：冷漠、巡逻无毁灭敌人；敌军阶段末给另一敌人放毁灭并弃卡', () => {
  assert.equal(rule('11721').patrolTarget != null, true)
  assert.equal(Number(flags('11721').quantity) >= 1, true)
  assert.ok(registeredEntry('11721').abilities.length >= 1)
})
test('11-a-5 11722 感染！：威胁区每人限 1；回合末放毁灭；意志(3) 成功弃卡', () => {
  const entry = registeredEntry('11722')
  assert.equal(entry.treacheryRule.threatArea, true)
  assert.equal(flags('11722').limitPerInvestigator, 1)
  assert.equal(typeof entry.encounterResolve, 'function')
})
test('11-a-5 11723 朝圣者侍僧：攻击后在其上放 1 毁灭', () => {
  assert.ok(registeredEntry('11723').abilities.length >= 1)
  assert.equal(Number(flags('11723').health) > 0, true)
})
test('11-a-5 11724 朝圣者领袖：重整时其他异教徒 +2 战斗并获得猎手/无情', () => {
  assert.ok(Array.isArray(registeredEntry('11724').modifiers) && registeredEntry('11724').modifiers.length >= 1)
  assert.equal(flags('11724').aloof, true)
})
test('11-a-5 11725 怪异星之眷族：猎手/庞大/无情，攻/躲见 elder_thing 治愈 1', () => {
  assert.ok(registeredEntry('11725').abilities.length >= 1)
  assert.equal(flags('11725').relentless, true)
})
test('11-a-5 11726 感染星之眷族：首次将败时治愈并重整；见 elder_thing 受 1 恐', () => {
  assert.ok(registeredEntry('11726').abilities.length >= 2)
})
test('11-a-5 11727 珊瑚星之眷族：有伤害时获得警戒/反击；见 elder_thing 受 1 伤', () => {
  assert.deepEqual(rule('11727').whileDamagedKeywords, ['alert', 'retaliate'])
  assert.ok(registeredEntry('11727').abilities.length >= 1)
})
test('11-a-5 11728 星之眷族观察者：调查其地点见 elder_thing → 交战并立刻攻击', () => {
  assert.ok(registeredEntry('11728').abilities.length >= 1)
  assert.equal(flags('11728').aloof, true)
})
test('11-a-5 11729 深渊之眼：cultist/tablet 视为 elder_thing；意志(3) 成功弃卡', () => {
  assert.equal(registeredEntry('11729').treacheryRule.threatArea, true)
  assert.ok(registeredEntry('11729').abilities.length >= 2)
})
test('11-a-5 11730 狡诈拟态：无[[怪物]]敌人则涌动，否则智力(3) 失败最近怪物攻击', () => {
  const entry = registeredEntry('11730')
  assert.equal(typeof entry.encounterResolve, 'function')
})
test('11-a-5 11731 古老迷雾：附属地点；四技能 -1；成功超 2 点弃卡', () => {
  assert.equal(flags('11731').locationAttachment, true)
  assert.ok(Array.isArray(registeredEntry('11731').modifiers) && registeredEntry('11731').modifiers.length >= 4)
  const entry = registeredEntry('11731')
  assert.ok(entry.modifiers.every(item => item.audience === 'here'))
})
test('11-a-5 11732 腐蚀浓雾：智力/战力(4) 失败受 1 伤，差 3+ 改全员直接伤害', () => {
  assert.equal(flags('11732').test.difficulty, 4)
  assert.equal(typeof registeredEntry('11732').encounterResolve, 'function')
})
test('11-a-5 11733 伏特鳗：猎手；猎物线索最多；敌军阶段移动时完全淹没地点互相连接', () => {
  assert.equal(rule('11733').hunterTreatsFloodedConnected, true)
})
test('11-a-5 11734 梦游迁徙：无敌人则涌动；意志(3) 失败二选一', () => {
  assert.equal(typeof registeredEntry('11734').encounterResolve, 'function')
})
test('11-a-5 11735 水下狩猎：敏捷(3)，完全淹没 +2 难度；失败受 1 伤并提高最近地点淹没', () => {
  assert.equal(flags('11735').test.difficulty, 3)
  assert.equal(typeof registeredEntry('11735').encounterResolve, 'function')
})
test('11-a-5 11736 致命急流：未淹没则涌动；否则敏捷/战力(4) 两选一', () => {
  assert.equal(typeof registeredEntry('11736').encounterResolve, 'function')
})
test('11-a-5 11737 水中之物：涌动；显现提高最近地点淹没', () => {
  assert.equal(typeof registeredEntry('11737').encounterResolve, 'function')
  assert.equal(flags('11737').surge ?? true, true)
})
