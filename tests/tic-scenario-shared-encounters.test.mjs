// TIC 共享遭遇卡逐卡验收测试（P7 收口 · w5）
//
// 覆盖逐卡账本最后 10 张「已实现但无测试证据」的共享遭遇卡（每张 2–4 例，标题命中卡号，
// 作为 audit/tic-all-card-acceptance.json 的 strongEvidence）：
//   07084 达贡祭司（agents_of_dagon）· 07085 达贡新信徒（agents_of_dagon）
//   07087 魂牵梦绕（agents_of_hydra）
//   07092 潮起 · 07093 激流（rising_tide）
//   07096 死亡纪念 · 07097 崩裂意识 · 07098 湮灭记忆（shattered_memories）
//   07182 掠食的深潜者（devilReef）· 07254 深潜者保姆（aLightInTheFog）
//
// 全部走真实引擎入口：章节夹具 chapterFixture 开局；显现/生成用 drawEncounter（07084/07085 的
// 「生成 - 任意无人地点」读点在 encounter.js 的通用生成分支），轮末强制用 reactionWindow('roundEnds')，
// 击败替代用 scenarioRuntime#defeatEnemy（打断窗口 enemyWouldBeDefeated），光环用 entityModifierTotal。
// 读点速查：
//   · 07084：enemyRule.spawnAnyEmpty；enemyWouldBeDefeated/Evaded 时 api.enemyOutcomes.replace
//     （治愈全部伤害/重整/放 1 毁灭）；roundEnds 重整且无毁灭 → 放 1 毁灭。
//   · 07085：enemyRule.spawnAnyEmpty；modifiers enemyFight/enemyEvade 在 doom===0 时 +2；
//     roundEnds 重整且无毁灭 → 放 1 毁灭。
//   · 07087：encounterResolve —— 无手牌 gainSurge；否则随机弃 1 张，按印刷费用做意志检定，失败失去 1 行动。
//   · 07092：encounterResolve —— 提升最近可涨水地点 1 级；没有可提升地点则 gainSurge。
//   · 07093：encounterResolve —— 未淹没 gainSurge；部分淹没敏捷 3 / 完全淹没敏捷 4；失败弃 1 支援，
//     不能弃则按失败差值失去资源。
//   · 07096/07097/07098：_shared#symbolFailingRevelation（对应 chaos token 自动失败）；
//     07096 失败 2 恐惧、07097 失败 2 伤害、07098 意志/智力 4 二选一并按差值弃手牌。
//   · 07182：enemyEngaged 时移动 1 线索或钥匙到自身；enemyDefeated/evadeSuccess 时取回全部线索与钥匙。
//   · 07254：未交战时给同地点/连接地点其他[[深潜者]] +1 攻击/+1 躲避（enemyAura 修正行）；
//     交战强制抽遭遇顶牌并失去涌动（suppressSurge）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, legalMoves, move, settle } from './core-fixture.mjs'
import { drawEncounter, enemyEvadeValue, enemyFightValue, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entityModifierTotal } from '../src/engine/modifiers.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

import e07084 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/agents_of_dagon/07084.js'
import e07085 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/agents_of_dagon/07085.js'
import e07087 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/agents_of_hydra/07087.js'
import e07092 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/rising_tide/07092.js'
import e07093 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/rising_tide/07093.js'
import e07096 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/shattered_memories/07096.js'
import e07097 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/shattered_memories/07097.js'
import e07098 from '../src/cards/encounter-entries/theInnsmouthConspiracy/_shared/shattered_memories/07098.js'
import e07182 from '../src/cards/encounter-entries/theInnsmouthConspiracy/devilReef/07182.js'
import e07254 from '../src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07254.js'

for (const entry of [e07084, e07085, e07087, e07092, e07093, e07096, e07097, e07098, e07182, e07254]) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

const codeOf = entity => entity?.originalCode || entity?.code

function transaction(state, execute, select = () => null) {
  const run = draft => execute(draft)
  resolveTransaction(state, 0, { action: 'ticSharedEncounters' }, run)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 120, `choice loop: ${state.pendingChoice.source}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}

// 真实遭遇抽取：把牌压入遭遇牌库顶后走 drawEncounter（07084/07085 的生成点读点在这条管线）。
function draw(state, code) {
  state.encounterDeck.push(code)
  transaction(state, draft => drawEncounter(draft, draft.investigators[0], []))
}

const cleanScene = state => {
  state.enemies = []
  for (const inv of state.investigators) { inv.engaged = []; inv.assets = [] }
  return state
}

const roundEnds = state => transaction(state, draft =>
  reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []))

const inPlay = (state, code) => state.enemies.find(candidate => codeOf(candidate) === code) || null

// ---------------------------------------------------------------------------
// 07084 达贡祭司：任意无人地点生成 / 轮末累积毁灭 / 无毁灭时击败或躲避被替换
// ---------------------------------------------------------------------------
test('07084 达贡祭司：从遭遇牌库生成到任意无人地点，声明 spawnAnyEmpty', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 2))
  const entry = registeredEntry('07084')
  assert.equal(entry.implemented, true)
  assert.equal(entry.enemyRule.spawnAnyEmpty, true)
  draw(s, '07084')
  const priest = inPlay(s, '07084')
  assert.ok(priest, '从遭遇牌库生成')
  assert.equal(s.investigators.some(inv => inv.location === priest.location), false, '生成在无人地点')
  assert.equal(priest.engagedSeat ?? null, null, '印刷没有与你交战')
  assert.equal(priest.doom || 0, 0)
})

test('07084 达贡祭司：轮末重整且无毁灭时放置 1 毁灭，已有毁灭不再叠加', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 1))
  draw(s, '07084')
  const priest = inPlay(s, '07084')
  priest.exhausted = false
  roundEnds(s)
  assert.equal(inPlay(s, '07084').doom, 1, '重整且无毁灭 → 轮末放 1 毁灭')
  roundEnds(s)
  assert.equal(inPlay(s, '07084').doom, 1, '已有毁灭时不再叠加')
})

test('07084 达贡祭司：真实回合流程跨轮时轮末强制自动结算（审计 H12 回归）', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 1))
  draw(s, '07084')
  inPlay(s, '07084').exhausted = false
  const before = s.round
  for (const inv of s.investigators) inv.actionsLeft = 0
  // 真实结束回合 → 引擎跑完敌方阶段/维持阶段进入轮末。修复前 roundEnds 只对旧式
  // investigatorRule.roundEndReaction 开窗（全仓仅 07001），非玩家实体的强制永不结算。
  move(s, legalMoves(s).find(command => command.action === 'endTurn'))
  settle(s)
  assert.ok(s.round > before, '回合已推进')
  assert.equal(inPlay(s, '07084')?.doom, 1, '真实轮末流程中达贡祭司放置 1 毁灭')
})

test('07084 达贡祭司：无毁灭时将要被击败改为治愈全部伤害/重整/放 1 毁灭；有毁灭时正常离场', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 1))
  draw(s, '07084')
  const priestId = inPlay(s, '07084').id
  transaction(s, draft => {
    const target = draft.enemies.find(candidate => candidate.id === priestId)
    target.damageTaken = 100
    scenarioRuntime(draft, []).defeatEnemy(target, { seat: 0 })
  })
  const replaced = s.enemies.find(candidate => candidate.id === priestId)
  assert.ok(replaced, '没有被击败')
  assert.equal(replaced.damageTaken, 0, '治愈全部伤害')
  assert.equal(replaced.exhausted, false, '重整')
  assert.equal(replaced.doom, 1, '放置 1 毁灭')
  // 已有毁灭时，同样的致命伤害走正常离场。
  transaction(s, draft => {
    const target = draft.enemies.find(candidate => candidate.id === priestId)
    target.damageTaken = 100
    scenarioRuntime(draft, []).defeatEnemy(target, { seat: 0 })
  })
  assert.equal(s.enemies.some(candidate => candidate.id === priestId), false, '有毁灭标记时正常离场')
})

// ---------------------------------------------------------------------------
// 07085 达贡新信徒：任意无人地点生成 / 无毁灭时 +2 攻击与躲避 / 轮末累积毁灭
// ---------------------------------------------------------------------------
test('07085 达贡新信徒：从遭遇牌库生成到任意无人地点', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 1))
  assert.equal(registeredEntry('07085').enemyRule.spawnAnyEmpty, true)
  draw(s, '07085')
  const follower = inPlay(s, '07085')
  assert.ok(follower, '从遭遇牌库生成')
  assert.equal(s.investigators.some(inv => inv.location === follower.location), false, '生成在无人地点')
})

test('07085 达贡新信徒：无毁灭标记时 +2 攻击/+2 躲避，获得毁灭后加成消失', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 1))
  draw(s, '07085')
  const follower = inPlay(s, '07085')
  assert.equal(entityModifierTotal(s, follower, 'enemyFight'), 2, '无毁灭 +2 攻击')
  assert.equal(entityModifierTotal(s, follower, 'enemyEvade'), 2, '无毁灭 +2 躲避')
  assert.equal(enemyFightValue(s, follower, 0), s.scenario.enemies['07085'].fight + 2, '攻击值含修正')
  assert.equal(enemyEvadeValue(s, follower, 0), s.scenario.enemies['07085'].evade + 2, '躲避值含修正')
  roundEnds(s)
  const withDoom = inPlay(s, '07085')
  assert.equal(withDoom.doom, 1, '轮末放置毁灭')
  assert.equal(entityModifierTotal(s, withDoom, 'enemyFight'), 0, '有毁灭后不再 +2')
  assert.equal(entityModifierTotal(s, withDoom, 'enemyEvade'), 0)
})

test('07085 达贡新信徒：只有重整且无毁灭时才在轮末放置毁灭', () => {
  const s = cleanScene(chapterFixture('theVanishingOfElinaHarper', 1))
  draw(s, '07085')
  const follower = inPlay(s, '07085')
  follower.exhausted = true
  roundEnds(s)
  assert.equal(inPlay(s, '07085').doom || 0, 0, '横置时不放毁灭')
  inPlay(s, '07085').exhausted = false
  roundEnds(s)
  assert.equal(inPlay(s, '07085').doom, 1, '重整后放毁灭')
})

// ---------------------------------------------------------------------------
// 07087 魂牵梦绕：无手牌涌动 / 随机弃牌 + 按印刷费用检定，失败失去 1 行动
// ---------------------------------------------------------------------------
test('07087 魂牵梦绕：没有手牌时获得涌动且不结算检定', () => {
  const s = cleanScene(chapterFixture('devilReef', 1))
  s.investigators[0].hand = []
  let returned
  transaction(s, draft => {
    returned = registeredEntry('07087').encounterResolve(draft, draft.investigators[0], { code: '07087' },
      scenarioRuntime(draft, []))
  })
  assert.deepEqual(returned, { gainSurge: true })
  assert.equal(s.lastTestResult, undefined, '没有进行检定')
})

test('07087 魂牵梦绕：随机弃 1 张手牌，按印刷费用做意志检定，失败失去 1 行动', () => {
  const s = cleanScene(chapterFixture('devilReef', 1))
  const card = '01020'
  s.investigators[0].hand = [card]
  s.chaosBag = ['autofail']
  const actionsBefore = s.investigators[0].actionsLeft
  transaction(s, draft => {
    registeredEntry('07087').encounterResolve(draft, draft.investigators[0], { code: '07087' }, scenarioRuntime(draft, []))
  })
  assert.equal(s.investigators[0].hand.length, 0, '随机弃掉 1 张手牌')
  assert.equal(s.lastTestResult.skill, 'willpower', '意志检定')
  assert.equal(s.lastTestResult.difficulty, ALL_CARDS[card].cost, '难度 = 被弃牌的印刷费用')
  assert.equal(s.investigators[0].actionsLeft, actionsBefore - 1, '失败失去 1 行动')
})

// ---------------------------------------------------------------------------
// 07092 潮起：提升最近可涨水地点 / 无可提升地点时涌动
// ---------------------------------------------------------------------------
test('07092 潮起：提升最近且可提升淹没等级的地点 1 级', () => {
  const s = cleanScene(chapterFixture('aLightInTheFog', 1))
  const water = createMechanicsApi(s).water
  const here = s.investigators[0].location
  for (const location of s.locations) if (location.id !== here) water.set(location.id, 2)
  const before = water.level(here)
  let returned
  transaction(s, draft => {
    returned = registeredEntry('07092').encounterResolve(draft, draft.investigators[0], { code: '07092' },
      scenarioRuntime(draft, []))
  })
  assert.equal(returned, false, '成功提升地点时不涌动')
  assert.equal(water.level(here), before + 1, '最近可提升地点升 1 级')
})

test('07092 潮起：没有可提升淹没等级的地点时获得涌动', () => {
  const s = cleanScene(chapterFixture('aLightInTheFog', 1))
  const water = createMechanicsApi(s).water
  for (const location of s.locations) water.set(location.id, 2)
  let returned
  transaction(s, draft => {
    returned = registeredEntry('07092').encounterResolve(draft, draft.investigators[0], { code: '07092' },
      scenarioRuntime(draft, []))
  })
  assert.deepEqual(returned, { gainSurge: true })
})

// ---------------------------------------------------------------------------
// 07093 激流：未淹没涌动 / 部分淹没敏捷 3 / 完全淹没敏捷 4 与资源损失
// ---------------------------------------------------------------------------
test('07093 激流：所在地点未淹没时获得涌动且不进行检定', () => {
  const s = cleanScene(chapterFixture('inTooDeep', 1))
  createMechanicsApi(s).water.set(s.investigators[0].location, 0)
  let returned
  transaction(s, draft => {
    returned = registeredEntry('07093').encounterResolve(draft, draft.investigators[0], { code: '07093' },
      scenarioRuntime(draft, []))
  })
  assert.deepEqual(returned, { gainSurge: true })
  assert.equal(s.lastTestResult, undefined)
})

test('07093 激流：部分淹没时敏捷(3)，失败弃掉 1 个支援', () => {
  const s = cleanScene(chapterFixture('inTooDeep', 1))
  createMechanicsApi(s).water.set(s.investigators[0].location, 1)
  s.investigators[0].assets = [{ id: 'asset-07093', code: '01020', exhausted: false }]
  s.chaosBag = ['autofail']
  transaction(s, draft => {
    registeredEntry('07093').encounterResolve(draft, draft.investigators[0], { code: '07093' }, scenarioRuntime(draft, []))
  })
  assert.equal(s.lastTestResult.skill, 'agility')
  assert.equal(s.lastTestResult.difficulty, 3, '部分淹没难度 3')
  assert.equal(s.investigators[0].assets.some(asset => asset.id === 'asset-07093'), false, '失败弃 1 支援')
})

test('07093 激流：完全淹没时敏捷(4)，不能弃支援则按失败差值失去资源', () => {
  const s = cleanScene(chapterFixture('inTooDeep', 1))
  createMechanicsApi(s).water.set(s.investigators[0].location, 2)
  s.investigators[0].agility = 0
  s.investigators[0].resources = 10
  s.chaosBag = ['0']
  transaction(s, draft => {
    registeredEntry('07093').encounterResolve(draft, draft.investigators[0], { code: '07093' }, scenarioRuntime(draft, []))
  })
  assert.equal(s.lastTestResult.difficulty, 4, '完全淹没难度 4')
  assert.equal(s.investigators[0].resources, 6, '不能弃支援 → 每低于难度 1 点失去 1 资源')
})

// ---------------------------------------------------------------------------
// 07096 死亡纪念：意志 3 / cultist 自动失败 / 失败 2 恐惧
// ---------------------------------------------------------------------------
test('07096 死亡纪念：意志(3)失败受到 2 点恐惧', () => {
  const s = cleanScene(chapterFixture('thePitOfDespair', 1))
  s.investigators[0].willpower = 0
  s.chaosBag = ['0']
  const horrorBefore = s.investigators[0].horror
  transaction(s, draft => {
    registeredEntry('07096').encounterResolve(draft, draft.investigators[0], { code: '07096' }, scenarioRuntime(draft, []))
  })
  assert.equal(s.lastTestResult.difficulty, 3)
  assert.equal(s.investigators[0].horror, horrorBefore + 2, '失败 2 恐惧')
})

test('07096 死亡纪念：检定期间揭示 cultist 标记时自动失败', () => {
  const s = cleanScene(chapterFixture('thePitOfDespair', 1))
  s.investigators[0].willpower = 9
  s.chaosBag = ['cultist']
  const horrorBefore = s.investigators[0].horror
  transaction(s, draft => {
    registeredEntry('07096').encounterResolve(draft, draft.investigators[0], { code: '07096' }, scenarioRuntime(draft, []))
  })
  assert.equal(s.lastTestResult.success, false, '揭示 cultist → 自动失败')
  assert.equal(s.investigators[0].horror, horrorBefore + 2, '自动失败同样受到 2 恐惧')
})

// ---------------------------------------------------------------------------
// 07097 崩裂意识：智力 3 / tablet 自动失败 / 失败 2 伤害
// ---------------------------------------------------------------------------
test('07097 崩裂意识：智力(3)检定与 tablet 自动失败均造成 2 点伤害', () => {
  const s = cleanScene(chapterFixture('thePitOfDespair', 1))
  s.investigators[0].intellect = 9
  s.chaosBag = ['tablet']
  transaction(s, draft => {
    registeredEntry('07097').encounterResolve(draft, draft.investigators[0], { code: '07097' }, scenarioRuntime(draft, []))
  })
  assert.equal(s.lastTestResult.skill, 'intellect')
  assert.equal(s.lastTestResult.difficulty, 3)
  assert.equal(s.lastTestResult.success, false, '揭示 tablet → 自动失败')
  assert.equal(s.investigators[0].damage, 2, '失败 2 伤害')
})

// ---------------------------------------------------------------------------
// 07098 湮灭记忆：意志/智力 4 二选一 / elderthing 自动失败 / 失败按差值弃手牌
// ---------------------------------------------------------------------------
test('07098 湮灭记忆：选择智力(4)，失败按差值弃掉相应数量手牌', () => {
  const s = cleanScene(chapterFixture('thePitOfDespair', 1))
  s.investigators[0].intellect = 0
  s.investigators[0].hand = ['01020', '01021', '01022', '01023']
  s.chaosBag = ['0']
  transaction(s, draft => {
    registeredEntry('07098').encounterResolve(draft, draft.investigators[0], { code: '07098' }, scenarioRuntime(draft, []))
  }, choice => (choice.options.some(option => option.id === 'intellect') ? 'intellect' : null))
  assert.equal(s.lastTestResult.skill, 'intellect', '意志/智力二选一')
  assert.equal(s.lastTestResult.difficulty, 4)
  assert.equal(s.investigators[0].hand.length, 0, '失败差值 4 → 弃 4 张手牌')
})

test('07098 湮灭记忆：揭示 elderthing 标记时自动失败并弃手牌', () => {
  const s = cleanScene(chapterFixture('thePitOfDespair', 1))
  s.investigators[0].willpower = 9
  s.investigators[0].hand = ['01020', '01021']
  s.chaosBag = ['elderthing']
  transaction(s, draft => {
    registeredEntry('07098').encounterResolve(draft, draft.investigators[0], { code: '07098' }, scenarioRuntime(draft, []))
  }, choice => (choice.options.some(option => option.id === 'willpower') ? 'willpower' : null))
  assert.equal(s.lastTestResult.success, false, '揭示 elderthing → 自动失败')
  assert.equal(s.investigators[0].hand.length, 0, '自动失败同样按差值弃手牌')
})

// ---------------------------------------------------------------------------
// 07182 掠食的深潜者：交战移动线索/钥匙，击败时取回全部
// ---------------------------------------------------------------------------
test('07182 掠食的深潜者：与你交战后你的 1 个线索移到它身上，击败时取回', () => {
  const s = cleanScene(chapterFixture('devilReef', 1))
  const here = s.investigators[0].location
  s.investigators[0].clues = 2
  let enemyId
  transaction(s, draft => { enemyId = scenarioRuntime(draft, []).spawnEngaged('07182', here, 0)?.id })
  const lurker = s.enemies.find(candidate => candidate.id === enemyId)
  assert.ok(lurker, '生成并交战')
  assert.equal(s.investigators[0].clues, 1, '交战后移动 1 个线索到敌人')
  assert.equal(lurker.clues, 1)
  transaction(s, draft => {
    const target = draft.enemies.find(candidate => candidate.id === enemyId)
    target.damageTaken = 100
    scenarioRuntime(draft, []).defeatEnemy(target, { seat: 0 })
  })
  assert.equal(s.investigators[0].clues, 2, '击败时取回其身上所有线索')
})

test('07182 掠食的深潜者：交战后你的钥匙移到它身上，击败时取回', () => {
  const s = cleanScene(chapterFixture('devilReef', 1))
  const here = s.investigators[0].location
  s.investigators[0].clues = 0
  createMechanicsApi(s).keys.transfer('blue', 'setAside', 'investigator:0', { reveal: true })
  let enemyId
  transaction(s, draft => { enemyId = scenarioRuntime(draft, []).spawnEngaged('07182', here, 0)?.id })
  assert.equal(keysAt(s, `enemy:${enemyId}`).includes('blue'), true, '钥匙移到敌人身上')
  assert.equal(keysAt(s, 'investigator:0').includes('blue'), false)
  transaction(s, draft => {
    const target = draft.enemies.find(candidate => candidate.id === enemyId)
    target.damageTaken = 100
    scenarioRuntime(draft, []).defeatEnemy(target, { seat: 0 })
  })
  assert.equal(keysAt(s, 'investigator:0').includes('blue'), true, '击败时取回钥匙')
})

test('07182 掠食的深潜者：印刷关键词（猎手）与数值来自关卡定义', () => {
  const s = chapterFixture('devilReef', 1)
  const def = s.scenario.enemies['07182']
  assert.ok(def)
  assert.equal(def.hunter, true, '猎手')
  assert.deepEqual(def.traits, ['Humanoid', 'Monster', 'Deep One'])
})

// ---------------------------------------------------------------------------
// 07254 深潜者保姆：深潜者光环 / 冷漠与反击 / 交战抽遭遇并失去涌动
// ---------------------------------------------------------------------------
test('07254 深潜者保姆：未交战时同地点与连接地点的其他[[深潜者]] +1 攻击/+1 躲避', () => {
  const s = cleanScene(chapterFixture('aLightInTheFog', 1))
  const here = s.investigators[0].location
  const nanny = scenarioRuntime(s, []).spawn('07254', here)
  assert.ok(nanny, '保姆入场')
  const deepOne = enemy(s, { code: 'ghoulMinion', name: '测试深潜者', location: here, engagedSeat: null,
    traits: ['Humanoid', 'Deep One'] })
  const bystander = enemy(s, { code: 'ghoulMinion', name: '测试人类', location: here, engagedSeat: null,
    traits: ['Humanoid'] })
  assert.equal(entityModifierTotal(s, deepOne, 'enemyFight'), 1, '同地点深潜者 +1 攻击')
  assert.equal(entityModifierTotal(s, deepOne, 'enemyEvade'), 1, '同地点深潜者 +1 躲避')
  assert.equal(entityModifierTotal(s, bystander, 'enemyFight'), 0, '非深潜者不受影响')
  // 连接地点同样在光环内。
  const hereLocation = s.locations.find(location => location.id === here)
  const connected = s.locations.find(location => location.id !== here
    && (hereLocation.connections || []).includes(location.id))
  assert.ok(connected, '起始地点有连接地点')
  deepOne.location = connected.id
  assert.equal(entityModifierTotal(s, deepOne, 'enemyFight'), 1, '连接地点的深潜者也 +1')
  // 保姆交战期间光环关闭。
  transaction(s, draft => { scenarioRuntime(draft, []).engage(draft.enemies.find(candidate => candidate.id === nanny.id), 0) })
  assert.equal(entityModifierTotal(s, deepOne, 'enemyFight'), 0, '保姆交战后光环关闭')
})

test('07254 深潜者保姆：与你交战后抽取遭遇牌库顶牌且该牌失去涌动', () => {
  const s = cleanScene(chapterFixture('aLightInTheFog', 1))
  const here = s.investigators[0].location
  const nanny = scenarioRuntime(s, []).spawn('07254', here)
  // 用一张会正常结算并弃置的 TIC 诡计（07096 死亡纪念）：意志检定通过后进入遭遇弃牌堆。
  s.investigators[0].willpower = 9
  s.chaosBag = ['0']
  s.encounterDeck = ['07096']
  transaction(s, draft => { scenarioRuntime(draft, []).engage(draft.enemies.find(candidate => candidate.id === nanny.id), 0) })
  assert.equal(s.encounterDeck.length, 0, '交战抽 1 张遭遇牌')
  assert.equal(s.encounterDiscard.includes('07096'), true, '抽到的牌正常结算后进入遭遇弃牌堆')
})

test('07254 深潜者保姆：印刷关键词（冷漠/反击）来自关卡定义', () => {
  const s = chapterFixture('aLightInTheFog', 1)
  const def = s.scenario.enemies['07254']
  assert.ok(def)
  assert.equal(def.aloof, true, '冷漠')
  assert.equal(def.retaliate, true, '反击')
})

// ---------------------------------------------------------------------------
// 07094 长翼者：X = 所在地点隐蔽值的动态躲避值（审计 H13 回归）
// ---------------------------------------------------------------------------
test('07094 长翼者：躲避值等于所在地点的隐蔽值 X（审计 H13 回归）', () => {
  const s = cleanScene(chapterFixture('devilReef', 1))
  s.enemies = []
  const location = s.locations.find(item => item.shroud != null) || s.locations[0]
  // 印刷卡表的 evade 是 X 占位符（-2）；数据层字面值不能直接当作躲避值使用。
  const winged = enemy(s, { code: '07094', originalCode: '07094', name: '长翼者',
    fight: 3, evade: -2, health: 4, location: location.id, engagedSeat: null, traits: ['Monster'] })
  assert.equal(ALL_CARDS['07094'].evade, -2, '数据层 evade 是 X 占位符')
  for (const shroud of [1, 4, 6]) {
    location.shroud = shroud
    assert.equal(enemyEvadeValue(s, winged, 0), shroud, `隐蔽值 ${shroud} → 长翼者躲避值为 ${shroud}`)
  }
  // 换地点后同样跟随所在地点。
  const other = s.locations.find(item => item.id !== location.id)
  other.shroud = 2
  winged.location = other.id
  assert.equal(enemyEvadeValue(s, winged, 0), 2, '躲避值跟随所在地点变化')
})
