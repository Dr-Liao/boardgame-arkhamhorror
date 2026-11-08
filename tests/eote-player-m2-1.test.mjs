// 七循环《地球边缘》P6 一般玩家卡 · M2-1 分片（08019–08048）逐卡验收。
//
// 分片共 30 张；每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> <中文名> …` 真实行为测试。
// 其中 15 张因缺引擎读点采用「现有原语的最接近等价实现」，条目注释以 approximation 标注：
//   08020 攻击自动成功（改为直接结算攻击伤害，跳过检定）
//   08021 持续到阶段结束的攻击改向（退化为单次手牌快速反应，见 03106 同构）
//   08024/08037 动态 commit 图标（iconBonus 无 getStat，按印刷基值）
//   08028 事件附到敌人 + 宿主击败反应（P0-9 已接真实 mythosEncounterStep skip 替代遭遇抽取；
//         事件附敌与奖励归属仍为近似：缺玩家事件附敌通用原语，用持续效果 sourceInstanceId 记账）
//   08029 任意已揭示地点敌人（doFight 不支持远程攻击，改为必先移动到敌人地点）
//   08030 两次都成功横置使第二次 +1 伤害（post-hoc 补 1 伤害）
//   08031 补给阶段抽 2 弃 1（改为重整结束再抽 1 弃 1；牌库 +15 走 deckConstruction）
//   08033/08041/08042/08043/08044 「灵脉」标记（地点用 trait 记账、支援用 uses；敌人/调查员标记不持久化）
//   08034 弃牌堆中的牌可投入每个检定（折算为本回合每次检定获得其图标）
//   08046 构筑「每张非弱点/非署名卡最多 1 张」（仅实现牌库 -5，限制待 P7 构筑层）
//   08045 坐标点（借用地点特性记账）
//   08047 移动期间不触发交战（改为每次移动后立即解除交战）
//
// 约定：
//   · 每张已实现卡至少一条真实行为断言（费用/槽位/使用次数/目标/窗口/持续时间/负面路径）；
//   · 引擎在每次 applyMove 后替换调查员对象 —— 断言前从 state 重新读取；
//   · 需要直接发起检定/窗口时，用 resolveTransaction 包住引擎入口（无 continuation 丢失）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, legalMoves } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import {
  applyDamage, assetEffect, commitIcons, executeDescriptor, getStat, playCost, reactionWindow, runMythos,
} from '../src/engine/engine.js'
import { deckRules } from '../web/deck-rules.js'

import card08019 from '../src/cards/entries/08019.js'
import card08020 from '../src/cards/entries/08020.js'
import card08021 from '../src/cards/entries/08021.js'
import card08022 from '../src/cards/entries/08022.js'
import card08023 from '../src/cards/entries/08023.js'
import card08024 from '../src/cards/entries/08024.js'
import card08025 from '../src/cards/entries/08025.js'
import card08026 from '../src/cards/entries/08026.js'
import card08027 from '../src/cards/entries/08027.js'
import card08028 from '../src/cards/entries/08028.js'
import card08029 from '../src/cards/entries/08029.js'
import card08030 from '../src/cards/entries/08030.js'
import card08031 from '../src/cards/entries/08031.js'
import card08032 from '../src/cards/entries/08032.js'
import card08033 from '../src/cards/entries/08033.js'
import card08034 from '../src/cards/entries/08034.js'
import card08035 from '../src/cards/entries/08035.js'
import card08036 from '../src/cards/entries/08036.js'
import card08037 from '../src/cards/entries/08037.js'
import card08038 from '../src/cards/entries/08038.js'
import card08039 from '../src/cards/entries/08039.js'
import card08040 from '../src/cards/entries/08040.js'
import card08041 from '../src/cards/entries/08041.js'
import card08042 from '../src/cards/entries/08042.js'
import card08043 from '../src/cards/entries/08043.js'
import card08044 from '../src/cards/entries/08044.js'
import card08045 from '../src/cards/entries/08045.js'
import card08046 from '../src/cards/entries/08046.js'
import card08047 from '../src/cards/entries/08047.js'
import card08048 from '../src/cards/entries/08048.js'

const ENTRIES = [card08019, card08020, card08021, card08022, card08023, card08024, card08025, card08026,
  card08027, card08028, card08029, card08030, card08031, card08032, card08033, card08034, card08035,
  card08036, card08037, card08038, card08039, card08040, card08041, card08042, card08043, card08044,
  card08045, card08046, card08047, card08048]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const me = (state, seat = 0) => state.investigators[seat]
const choices = (pending, prefer) => {
  const found = prefer?.(pending)
  if (found != null) {
    const option = pending.options.find(item => String(item.id) === String(found))
    if (option) return option.id
  }
  return ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
    ?? pending.options[0]?.id
}
// 规则事务探针：直接调用引擎入口并收敛全部待决选择。
function probe(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'eotePlayerProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}
// 对局行动探针：用 applyMove 入口（ability/play/fight）并收敛普通选择。
function act(state, choose = () => null) {
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    const chosen = choices(pending, choose)
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}
const triggerEnemyAttackWindow = (state, opts = {}) => {
  const execute = draft => reactionWindow(draft, 'enemyAttack', {
    when: 'enemyAttack', seat: 0, location: draft.investigators[0].location, attackKind: 'enemy',
    enemy: opts.enemy || { id: 'probe', code: 'ghoulMinion', name: '测试敌人', damage: 1, horror: 1 },
    prompt: 'M2-1 敌人攻击窗口探针',
  }, [])
  resolveTransaction(state, 0, { action: 'eotePlayerAttackWindow' }, execute)
  return state.pendingChoice
}
// 事件卡在 catalog-only 阶段不能走真实 play 入口；直接执行已注册的 played 描述符
// （仍是引擎 executeDescriptor + ctx.api，不伪造效果），验证 resolve 行为。
const resolvePlayed = (state, code, extra = {}) => {
  const descriptor = registeredEntry(code).abilities.find(ability => ability.kind === 'played')
  assert.ok(descriptor, `${code} 缺少 played 描述符`)
  probe(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { id: `probe:${code}`, code }, descriptor, events: [],
    context: extra.context || {}, silent: false,
  }), extra.choose)
}
// 反应/免费能力的直接执行探针（同样走 executeDescriptor）。
const resolveAbility = (state, code, extra = {}) => {
  const entry = registeredEntry(code)
  const descriptor = extra.kind
    ? entry.abilities.find(ability => ability.kind === extra.kind)
    : entry.abilities[0]
  assert.ok(descriptor, `${code} 缺少描述符`)
  probe(state, draft => {
    const source = extra.assetCode
      ? draft.investigators[0].assets.find(card => card.code === extra.assetCode)
      : (extra.source || { id: `probe:${code}`, code })
    executeDescriptor(draft, {
      inv: draft.investigators[0], source, descriptor, events: [], context: extra.context || {}, silent: false,
    })
  }, extra.choose)
}
const multiLocation = (state, ids) => {
  const here = state.locations[0]
  for (const id of ids) {
    state.locations.push({ id, name: id, clues: 1, shroud: 1, connections: [here.id], revealed: true })
    here.connections.push(id)
  }
  return state.locations
}
const freshEnemy = (state, id) => state.enemies.find(enemy => enemy.id === id)
const twoLocations = state => {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 2, shroud: 1, connections: ['study'], revealed: true })
  return [state.locations[0], state.locations.find(location => location.id === 'attic')]
}

// ── 08019 全副武装 ──────────────────────────────────────────────────────────
test('P6 08019 全副武装 第一回合开始：从手中打出任意张[[道具]]支援（每张 -1），本回合少 3 个行动', () => {
  const state = fixture('01001')
  state.round = 1
  state.currentSeat = 0
  state.abilityLimits = {}
  asset(state, '08019')
  me(state).hand = ['02016', '02016']
  me(state).resources = 0
  me(state).actionsLeft = 5
  probe(state, draft => reactionWindow(draft, 'turnBegins', { when: 'turnBegins', seat: 0 }, []),
    pending => (pending.options.some(option => option.cardCode === '02016') ? pending.options.find(option => option.cardCode === '02016').id : null))
  // 第二次选择时手牌只剩一张（同一写法重复），最终两张都入场。
  assert.equal(me(state).hand.filter(code => code === '02016').length, 0, '两张道具都从手牌打出')
  assert.equal(me(state).assets.filter(card => card.code === '02016').length, 2, '两张道具支援已入场')
  assert.equal(me(state).resources, 0, '费用 -1 后 1 费道具免费打出')
  assert.equal(me(state).actionsLeft, 2, '本回合少进行三次行动（5 - 3）')
})

// ── 08022 成群结队 ──────────────────────────────────────────────────────────
test('P6 08022 成群结队 每控制一张不同职阶的卡牌：攻击 +1[combat] 且 +1 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  // 五个不同职阶的在场卡牌。
  for (const code of ['10019', '10040', '10062', '10084', '10108']) asset(state, code)
  const target = enemy(state, { fight: 1, evade: 1, health: 20 })
  state.chaosBag = ['0']
  const combatBase = getStat(state, me(state), 'combat')
  resolvePlayed(state, '08022', { choose: pending => (pending.options.some(option => option.id === target.id) ? target.id : null) })
  assert.equal(state.lastTestResult?.value, combatBase + 5, '五个不同职阶 → +5 技能值')
  assert.equal(freshEnemy(state, target.id).damageTaken, 6, '基础 1 伤害 +5')
})

// ── 08023 扫堂腿 ────────────────────────────────────────────────────────────
test('P6 08023 扫堂腿 攻击加入[agility]、+1 伤害，成功自动躲避该敌人', () => {
  const state = fixture('01001')
  me(state).assets = []
  const target = enemy(state, { fight: 1, evade: 1, health: 20 })
  state.chaosBag = ['+1']
  const combatBase = getStat(state, me(state), 'combat')
  const agility = getStat(state, me(state), 'agility')
  resolvePlayed(state, '08023', { choose: pending => (pending.options.some(option => option.id === target.id) ? target.id : null) })
  assert.ok(state.lastTestResult?.success, '攻击成功')
  assert.equal(state.lastTestResult.value, combatBase + agility + 1, '攻击技能值 = 战斗 + 敏捷 + 标记')
  const after = freshEnemy(state, target.id)
  assert.equal(after.damageTaken, 2, '本次攻击 1 + 1 伤害')
  assert.equal(after.exhausted, true, '成功后自动躲避（横置）')
  assert.equal(after.engagedSeat, null, '自动躲避解除交战')
})

// ── 08025 蝴蝶对剑（等级 2）─────────────────────────────────────────────────
test('P6 08025 蝴蝶对剑 攻击 +1[combat]；可横置再次攻击（加入[agility]，+1 伤害）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const blade = asset(state, '08025')
  const target = enemy(state, { fight: 0, evade: 1, health: 30 })
  state.chaosBag = ['0', '0', '0', '0']
  const attack = legalMoves(state).find(option => option.action === 'ability' && option.assetId === blade.id)
  assert.ok(attack, '蝴蝶对剑应有攻击行动')
  move(state, attack)
  act(state, pending => (pending.options.some(option => option.id === 'again') ? 'again' : null))
  assert.equal(me(state).assets.find(card => card.code === '08025').exhausted, true, '再次攻击后横置')
  assert.equal(freshEnemy(state, target.id).damageTaken, 3, '第一次 1 伤害 + 第二次 2 伤害')
})

// ── 08026 闪躲 ──────────────────────────────────────────────────────────────
test('P6 08026 闪躲 取消敌人攻击；敏捷(1)成功后对该敌人造成 1 点伤害', () => {
  const state = fixture('01001')
  const attacker = enemy(state, { fight: 1, evade: 1, health: 10 })
  state.chaosBag = ['+1', '+1']
  // catalog-only 阶段不能靠真实 play 入口打出事件：直接把「正在攻击」的上下文放到反应上下文，
  // 再执行已注册的 played 描述符（resolve 内仍走 api.cancelCurrentAttack / api.startTest）。
  state._reaction = { context: { when: 'enemyAttack', seat: 0, enemy: attacker, attackKind: 'enemy' } }
  resolvePlayed(state, '08026')
  assert.equal(freshEnemy(state, attacker.id).damageTaken, 1, '敏捷(1)成功后造成 1 点伤害')
})

// ── 08027 战斗训练 ──────────────────────────────────────────────────────────
test('P6 08027 战斗训练 沉稳：+1[combat] +1[agility]，伤害优先分配给本卡，每次检定可花 1 资源 +1', () => {
  const state = fixture('01001')
  me(state).assets = []
  const training = asset(state, '08027')
  assert.equal(getStat(state, me(state), 'combat'), ALL_CARDS['01001'].combat + 1)
  assert.equal(getStat(state, me(state), 'agility'), ALL_CARDS['01001'].agility + 1)
  const effect = assetEffect(me(state), me(state).assets.find(card => card.id === training.id))
  assert.equal(effect.composure, true, '沉稳读点：非直接恐惧优先分配')
  const entry = registeredEntry('08027')
  assert.equal(entry.fast, true)
  assert.deepEqual(entry.freeTriggers.map(trigger => trigger.skill), ['combat', 'agility'])
})

// ── 08029 提尔斯哈之牙 ──────────────────────────────────────────────────────
test('P6 08029 提尔斯哈之牙 攻击已揭示地点敌人：移动至其地点，加入[agility]，+3 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  // 两个地点：同地点与另一已揭示地点各一个敌人。
  const here = state.locations[0]
  state.locations.push({ id: 'far', name: '远端', clues: 0, shroud: 1, connections: [here.id], revealed: true })
  here.connections = ['far']
  state.enemies.push({
    id: 'farEnemy', code: 'ghoulMinion', name: '远端敌人', location: 'far',
    fight: 0, evade: 1, health: 20, damageTaken: 0, damage: 1, horror: 1, engagedSeat: null, exhausted: false,
  })
  state.chaosBag = ['0']
  const combatBase = getStat(state, me(state), 'combat')
  const agility = getStat(state, me(state), 'agility')
  resolvePlayed(state, '08029', {
    choose: pending => (pending.options.some(option => option.id === 'farEnemy') ? 'farEnemy' : null),
  })
  assert.equal(me(state).location, 'far', '结算前移动到敌人地点')
  assert.equal(state.lastTestResult?.value, combatBase + agility, '攻击加入敏捷')
  assert.equal(freshEnemy(state, 'farEnemy').damageTaken, 4, '基础 1 + 3 伤害')
})

// ── 08030 蝴蝶对剑（等级 5）─────────────────────────────────────────────────
test('P6 08030 蝴蝶对剑 第一次 +2[combat]；可再次攻击；两次都成功横置使第二次 +1 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  const blade = asset(state, '08030')
  const target = enemy(state, { fight: 0, evade: 1, health: 40 })
  state.chaosBag = ['+1', '+1', '+1', '+1']
  const attack = legalMoves(state).find(option => option.action === 'ability' && option.assetId === blade.id)
  move(state, attack)
  act(state, pending => (pending.options.some(option => option.id === 'again') ? 'again'
    : pending.options.some(option => option.id === 'exhaust') ? 'exhaust' : null))
  assert.equal(me(state).assets.find(card => card.code === '08030').exhausted, true, '横置蝴蝶对剑')
  assert.equal(freshEnemy(state, target.id).damageTaken, 3, '第一次 1 伤害 + 第二次 1 伤害 + 横置追加 1')
})

// ── 08032 耶利米·科尔比 ─────────────────────────────────────────────────────
test('P6 08032 耶利米·科尔比 +1[intellect]；入场后揭示牌库顶 5 张，按费用奇偶抽牌并洗回其余', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '08032')
  me(state).hand = []
  // 牌库：顶 5 张 = 偶 0/2/0 + 奇 1/1（deck 末尾是牌库顶）。
  me(state).deck = ['10006', '10023', '10002', '10028', '10006']
  const baseIntellect = ALL_CARDS['01001'].intellect
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect + 1, '+1 智力')
  resolveAbility(state, '08032', {
    kind: 'reaction', context: { assetCode: '08032' },
    choose: pending => (pending.options.some(option => option.id === 'even') ? 'even' : null),
  })
  const hand = me(state).hand
  assert.deepEqual(hand.sort(), ['10002', '10006', '10006'], '抽取 3 张偶数费用卡牌')
  assert.equal(me(state).deck.length, 2, '剩下 2 张洗回牌库')
  assert.deepEqual(me(state).deck.sort(), ['10023', '10028'], '奇数费用卡牌留在牌库')
})

// ── 08035 登山靴 ────────────────────────────────────────────────────────────
test('P6 08035 登山靴 +1[agility]；最后一个线索被发现后横置移动到有线索/未揭示的连接地点', () => {
  const state = fixture('01001')
  me(state).assets = []
  const boots = asset(state, '08035')
  twoLocations(state)
  state.locations[0].clues = 0
  assert.equal(getStat(state, me(state), 'agility'), ALL_CARDS['01001'].agility + 1, '+1 敏捷')
  // 走真实 clueDiscovered 反应窗口（费用由引擎支付：横置登山靴）。
  probe(state, draft => reactionWindow(draft, 'clueDiscovered', {
    when: 'clueDiscovered', seat: 0, location: 'study', lastClue: true,
  }, []), pending => {
    if (pending.options.some(option => option.id === 'attic')) return 'attic'
    const descriptor = pending.options.find(option => String(option.id).startsWith('desc:08035'))
    if (descriptor) return descriptor.id
    return null
  })
  assert.equal(me(state).location, 'attic', '移动到符合条件的连接地点')
  assert.equal(me(state).assets.find(card => card.id === boots.id).exhausted, true, '横置登山靴')
})

// ── 08036 加入马队 ──────────────────────────────────────────────────────────
test('P6 08036 加入马队 每控制一张不同职阶的卡牌费用 -1；快速移动到任意已揭示地点', () => {
  const state = fixture('01001')
  me(state).assets = []
  for (const code of ['10019', '10040', '10062']) asset(state, code)
  const def = ALL_CARDS['08036']
  assert.equal(registeredEntry('08036').playCostModifier({ state, inv: me(state), card: def }), -3, '三种不同职阶 → 费用 -3')
  assert.equal(playCost(state, me(state), def), Math.max(0, (def.cost || 0) - 3), '实际打出费用随职阶数递减')
  assert.equal(registeredEntry('08036').playCondition.length, 1, '只可在自己回合打出（playCondition）')
  twoLocations(state)
  resolvePlayed(state, '08036', {
    choose: pending => (pending.options.some(option => option.id === 'attic') ? 'attic' : null),
  })
  assert.equal(me(state).location, 'attic', '移动到任意已揭示地点')
})

// ── 08038 医学教科书 ────────────────────────────────────────────────────────
test('P6 08038 医学教科书 行动：智力(2)成功治愈 1（超 2 点则 2）；失败必须横置或造成 1 伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  const textbook = asset(state, '08038')
  me(state).damage = 2
  state.chaosBag = ['+1', '+1']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === textbook.id)
  assert.ok(action, '医学教科书应有行动')
  move(state, action)
  act(state)
  assert.ok(state.lastTestResult?.success, '智力(2)检定成功')
  assert.equal(me(state).damage, 0, '成功且超过难度 2 点：治愈 2 点伤害')
  // 负面路径：检定失败时必须横置或对目标造成 1 点伤害。
  me(state).damage = 3
  state.chaosBag = ['autofail', 'autofail']
  const action2 = legalMoves(state).find(option => option.action === 'ability' && option.assetId === textbook.id)
  move(state, action2)
  act(state, pending => (pending.options.some(option => option.id === 'damage') ? 'damage' : null))
  assert.equal(me(state).damage, 4, '失败并选择造成 1 点伤害')
})

// ── 08039 发掘古物 ──────────────────────────────────────────────────────────
test('P6 08039 发掘古物 选择至多 2 张[seeker]支援；难度=费用和；成功依次入场，遗物支援各抽 1 张', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10043', '10056']
  me(state).deck = ['10006', '10006', '10006']
  state.chaosBag = ['+1', '+1']
  resolvePlayed(state, '08039', {
    choose: pending => {
      if (pending.options.some(option => option.cardCode === '10043')) return pending.options.find(option => option.cardCode === '10043').id
      if (pending.options.some(option => option.cardCode === '10056')) return pending.options.find(option => option.cardCode === '10056').id
      return null
    },
  })
  assert.equal(state.lastTestResult?.difficulty, 3, '难度 = 费用 1 + 2')
  assert.ok(me(state).assets.some(card => card.code === '10043'), '第一张支援已放置入场')
  assert.ok(me(state).assets.some(card => card.code === '10056'), '第二张支援已放置入场')
  assert.equal(me(state).hand.length, 1, '两张支援离手后，遗物支援抽 1 张')
})

// ── 08040 科学理论 ──────────────────────────────────────────────────────────
test('P6 08040 科学理论 沉稳：+1[intellect] +1[combat]，伤害优先分配给本卡，每次检定可花 1 资源 +1', () => {
  const state = fixture('01001')
  me(state).assets = []
  const theory = asset(state, '08040')
  assert.equal(getStat(state, me(state), 'intellect'), ALL_CARDS['01001'].intellect + 1)
  assert.equal(getStat(state, me(state), 'combat'), ALL_CARDS['01001'].combat + 1)
  assert.equal(assetEffect(me(state), me(state).assets.find(card => card.id === theory.id)).composure, true)
  const entry = registeredEntry('08040')
  assert.equal(entry.fast, true)
  assert.deepEqual(entry.freeTriggers.map(trigger => trigger.skill), ['intellect', 'combat'])
})

// ── 08045 亵渎预言 ──────────────────────────────────────────────────────────
test('P6 08045 亵渎预言 入场指定坐标点；不在坐标点时 +1[智力] +1[敏捷] 且忽略趁乱攻击；可移动任意调查员至坐标点', () => {
  const state = fixture('01001')
  me(state).assets = []
  const prophecy = asset(state, '08045')
  twoLocations(state)
  const baseIntellect = ALL_CARDS['01001'].intellect
  const baseAgility = ALL_CARDS['01001'].agility
  // 入场：选择阁楼为坐标点。
  resolveAbility(state, '08045', {
    kind: 'entersPlay',
    choose: pending => (pending.options.some(option => option.id === 'attic') ? 'attic' : null),
  })
  const coordinate = state.locations.find(location => (location.traitGrants?.Coordinate || []).includes('08045'))
  assert.equal(coordinate?.id, 'attic', '坐标点 = 阁楼（地点特性原语记账）')
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect + 1, '不在坐标点：+1 智力')
  assert.equal(getStat(state, me(state), 'agility'), baseAgility + 1, '不在坐标点：+1 敏捷')
  assert.ok(registeredEntry('08045').modifiers.some(modifier => modifier.target === 'ignore:opportunityAttack'),
    '忽略趁乱攻击的修正读点')
  // 行动：移动自己到坐标点。
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === prophecy.id)
  assert.ok(action, '亵渎预言应有移动行动')
  move(state, action)
  act(state)
  assert.equal(me(state).location, 'attic', '移动到坐标点')
  assert.equal(getStat(state, me(state), 'intellect'), baseIntellect, '在坐标点时不再 +1 智力')
  // 离场：撤销坐标点特性。
  resolveAbility(state, '08045', { kind: 'leavesPlay' })
  assert.equal(state.locations.find(location => (location.traitGrants?.Coordinate || []).includes('08045')), undefined,
    '离场后坐标点标记被撤销')
})

// ── 08048 21点 ──────────────────────────────────────────────────────────────
test('P6 08048 21点 依次揭示直到停下，按总和（忽视 +/-）获得资源', () => {
  const state = fixture('01001')
  me(state).resources = 0
  // 总和 19：10 + 5 + 2 + 2（符号取绝对值）。逐枚揭示用 debugNextTokens 固定顺序。
  state.chaosBag = ['autofail', 'skull', '+2', '-2']
  state.debugNextTokens = ['autofail', 'skull', '+2', '-2']
  let count = 0
  resolvePlayed(state, '08048', {
    choose: pending => {
      if (pending.options.some(option => option.id === 'continue') && count < 4) { count += 1; return 'continue' }
      return pending.options.some(option => option.id === 'stop') ? 'stop' : null
    },
  })
  assert.equal(count, 4, '依次揭示 4 枚后停下')
  assert.equal(me(state).resources, 5, '总和 19 → 获得 5 资源')
  // [elder_sign] 视作 11：11 + 10 = 21 → 获得 9 资源。
  me(state).resources = 0
  state.chaosBag = ['eldersign', 'autofail']
  state.debugNextTokens = ['eldersign', 'autofail']
  let count2 = 0
  resolvePlayed(state, '08048', {
    choose: pending => {
      if (pending.options.some(option => option.id === '11')) return '11'
      if (pending.options.some(option => option.id === 'continue') && count2 < 2) { count2 += 1; return 'continue' }
      return pending.options.some(option => option.id === 'stop') ? 'stop' : null
    },
  })
  assert.equal(count2, 2, '揭示 2 枚后停下')
  assert.equal(me(state).resources, 9, '总和 21 → 获得 9 资源')
})

// ═══════════════════════════════════════════════════════════════════════════
// 第二轮：原缺读点的卡用现有原语的最接近等价实现（条目注释标 approximation）
// ═══════════════════════════════════════════════════════════════════════════

// ── 08020 正面迎击（approximation）──────────────────────────────────────────
test('P6 08020 正面迎击 敌人先攻击你；本次攻击自动成功并造成 2 点伤害（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const target = enemy(state, { fight: 3, evade: 3, health: 20, damage: 1, horror: 0 })
  me(state).damage = 0
  resolvePlayed(state, '08020', { choose: pending => (pending.options.some(option => option.id === target.id) ? target.id : null) })
  assert.equal(freshEnemy(state, target.id).damageTaken, 2, '自动成功的攻击造成 2 点伤害（不抽混乱标记）')
  assert.equal(me(state).damage, 1, '额外费用：所选敌人先攻击你')
})

// ── 08021 “到我身后！”（approximation）─────────────────────────────────────
test('P6 08021 “到我身后！” 另一位调查员被攻击时改为攻击你并交战，取消 1 点恐惧（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const attacker = enemy(state, { fight: 2, evade: 2, health: 20, damage: 1, horror: 1 })
  me(state).damage = 0
  me(state).horror = 0
  state._reaction = { context: { when: 'enemyAttack', seat: 1, location: me(state).location, enemy: attacker } }
  resolvePlayed(state, '08021')
  const after = freshEnemy(state, attacker.id)
  assert.equal(after.engagedSeat, 0, '改为与你交战')
  assert.equal(me(state).damage, 1, '你结算了这次攻击的伤害')
  assert.equal(me(state).horror, 0, '取消该次攻击 1 点恐惧（近似为治愈 1 点恐惧）')
})

// ── 08024 防御姿态（approximation）──────────────────────────────────────────
test('P6 08024 防御姿态 手中/投入时获得等于敏捷的战斗图标、等于战斗的敏捷图标（approximation）', () => {
  const state = fixture('01001')
  const base = ALL_CARDS['01001']
  assert.equal(commitIcons(state, me(state), '08024', 'combat'), base.agility, '战斗检定：等于敏捷的战斗图标')
  assert.equal(commitIcons(state, me(state), '08024', 'agility'), base.combat, '敏捷检定：等于战斗的敏捷图标')
  assert.equal(commitIcons(state, me(state), '08024', 'willpower'), 0, '其他技能不提供图标')
})

// ── 08028 追猎行动（P0-9 修复：真实神话阶段 skip 遭遇抽取）──────────────────
test('P6 08028 追猎行动 真实神话阶段：替代本次遭遇抽取；生成遭遇敌人并交战；击败后获得 3 资源', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).resources = 0
  me(state).hand = ['08028']
  state.encounterDeck = ['ghoulMinion', 'dissonantVoices']
  state.encounterDiscard = []
  state.campaign.leadSeat = state.campaign.leadSeat ?? 0
  const labels = pending => (pending?.options || []).map(option => String(option.label || option.id))
  let played = false
  // 真实神话阶段入口 runMythos：mythosEncounterStep 窗口返回的 context.skip 让引擎不再抽遭遇。
  probe(state, draft => runMythos(draft), pending => {
    if (pending.kind === 'reaction' && labels(pending).some(label => /追猎行动/.test(label))) {
      played = true
      return pending.options.find(option => /追猎行动/.test(String(option.label || '')))?.id
    }
    if (pending.options.some(option => option.cardCode === 'ghoulMinion')) {
      return pending.options.find(option => option.cardCode === 'ghoulMinion').id
    }
    return null
  })
  assert.equal(played, true, '真实神话阶段窗口打出追猎行动')
  assert.deepEqual(state.encounterDeck, ['dissonantVoices'], '本次遭遇抽取被替代（修复前 deck 被抽空）')
  const spawned = state.enemies.find(item => item.code === 'ghoulMinion')
  assert.ok(spawned, '从遭遇牌库生成敌人')
  assert.equal(spawned.engagedSeat, 0, '与生成者交战')
  assert.ok(state.effects.some(effect => effect.sourceCode === '08028'), '击败奖励效果已记录')
  // 击败被追猎敌人：触发效果记录上的 defeatEnemy 反应，获得 3 资源。
  probe(state, draft => reactionWindow(draft, 'defeatEnemy', {
    when: 'defeatEnemy', seat: 0, enemy: draft.enemies.find(item => item.code === 'ghoulMinion'),
    location: draft.investigators[0].location,
  }, []), pending => {
    const option = pending.options.find(item => String(item.id).startsWith('desc:effect'))
    return option ? option.id : null
  })
  assert.equal(me(state).resources, 3, '击败被追猎敌人获得 3 资源')
})

// ── 08031 强制学习（approximation）──────────────────────────────────────────
test('P6 08031 强制学习 牌库 +15；补给阶段抽 2 弃 1（approximation：重整末尾再抽 1 弃 1）', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '08031')
  const baseRules = deckRules(me(state))
  const builtRules = deckRules(me(state), ['08031'], {})
  assert.equal(builtRules.size, baseRules.size + 15, '构筑层牌库 +15')
  me(state).hand = []
  me(state).deck = ['10006', '10023', '10002', '10028']
  probe(state, draft => reactionWindow(draft, 'upkeepEnd', { when: 'upkeepEnd', seat: 0 }, []))
  assert.equal(me(state).hand.length, 0, '额外抽 1 后弃 1：手牌净 0')
  assert.equal(me(state).discard.length, 1, '弃掉 1 张手牌')
  assert.equal(me(state).deck.length, 3, '多抽了 1 张')
})

// ── 08033 通路档案（等级 0，approximation）──────────────────────────────────
test('P6 08033 通路档案 额外费用在 4 地点放灵脉；调查带灵脉地点后移到本卡，满 4 弃卡得资源（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).resources = 10
  multiLocation(state, ['ley1', 'ley2', 'ley3'])
  const prophecy = asset(state, '08033')
  resolveAbility(state, '08033', { kind: 'entersPlay', source: { id: prophecy.id, code: '08033' } })
  const marked = state.locations.filter(location => (location.traitGrants?.LeyLine || []).includes('08033'))
  assert.equal(marked.length, 4, '4 个不同地点各放置 1 个灵脉')
  assert.equal(me(state).resources, 6, '额外费用：支付 4 资源')
  // 调查成功反应：把灵脉移到本卡。
  let archive = me(state).assets.find(card => card.code === '08033')
  archive.uses = 3
  probe(state, draft => reactionWindow(draft, 'investigateSuccess', {
    when: 'investigateSuccess', seat: 0, location: draft.investigators[0].location,
  }, []), pending => {
    const option = pending.options.find(item => String(item.id).startsWith('desc:08033'))
    return option ? option.id : null
  })
  assert.equal(me(state).assets.some(card => card.code === '08033'), false, '集齐 4 灵脉后弃掉本卡')
  assert.equal(me(state).resources, 10, '拿取 4 灵脉作为资源（6 + 4）')
  assert.equal(state.scenarioFlags?.eoteConfirmedPath, true, '记录“你已经确认了前行道路”')
})

// ── 08034 繁星密语（approximation）──────────────────────────────────────────
test('P6 08034 繁星密语 弃牌库顶：弱点洗回，非弱点本回合每次检定获得其图标（approximation）', () => {
  const state = fixture('01001')
  me(state).hand = []
  const normal = Object.entries(ALL_CARDS)
    .find(([, def]) => def.type === 'asset' && Object.keys(def.icons || {}).length
      && Object.values(def.icons).some(value => value > 0))[0]
  const icons = Object.values(ALL_CARDS[normal].icons).reduce((sum, value) => sum + (Number(value) || 0), 0)
  me(state).deck = ['10006', normal]
  resolvePlayed(state, '08034')
  const effect = state.effects.find(item => item.sourceCode === '08034')
  assert.ok(effect, '非弱点：得到本回合加值效果')
  assert.equal(effect.modifiers[0].amount, icons, '等于该牌图标总数')
  // 弱点分支：洗回牌库、不产生加值效果。
  const weakness = Object.entries(ALL_CARDS)
    .find(([, def]) => ['weakness', 'basicweakness'].includes(def.subtype))[0]
  const fresh = fixture('01001')
  me(fresh).hand = []
  me(fresh).deck = ['10006', weakness]
  resolvePlayed(fresh, '08034')
  assert.equal(me(fresh).deck.length, 2, '弱点洗回牌库（张数不变）')
  assert.equal(fresh.effects.some(item => item.sourceCode === '08034'), false, '弱点分支不产生加值效果')
})

// ── 08037 地区勘测（approximation）──────────────────────────────────────────
test('P6 08037 地区勘测 手中/投入时获得等于敏捷的智力图标、等于智力的敏捷图标（approximation）', () => {
  const state = fixture('01001')
  const base = ALL_CARDS['01001']
  assert.equal(commitIcons(state, me(state), '08037', 'intellect'), base.agility, '智力检定：等于敏捷的智力图标')
  assert.equal(commitIcons(state, me(state), '08037', 'agility'), base.intellect, '敏捷检定：等于智力的敏捷图标')
})

// ── 08041 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08041 通路档案 入场 4 灵脉；免费把 1 灵脉移到非精英敌人（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08041')
  resolveAbility(state, '08041', { kind: 'entersPlay', assetCode: '08041' })
  let current = me(state).assets.find(card => card.code === '08041')
  assert.equal(current.uses, 4, '入场使用 4 灵脉')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10 })
  resolveAbility(state, '08041', { kind: 'free', assetCode: '08041', choose: pending => (pending.options.some(option => option.id === foe.id) ? foe.id : null) })
  current = me(state).assets.find(card => card.code === '08041')
  assert.equal(current.uses, 3, '移动 1 灵脉到非精英敌人（近似：扣减使用次数）')
  assert.equal(freshEnemy(state, foe.id)?.id, foe.id, '目标敌人仍在场')
})

// ── 08042 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08042 通路档案 入场 4 灵脉；免费把 1 灵脉移到已揭示地点（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08042')
  resolveAbility(state, '08042', { kind: 'entersPlay', assetCode: '08042' })
  let current = me(state).assets.find(card => card.code === '08042')
  const here = state.locations[0]
  here.revealed = true
  resolveAbility(state, '08042', {
    kind: 'free', assetCode: '08042',
    choose: pending => (pending.options.some(option => option.id === here.id) ? here.id : null),
  })
  current = me(state).assets.find(card => card.code === '08042')
  assert.equal(current.uses, 3, '扣减 1 灵脉')
  assert.ok((state.locations.find(location => location.id === here.id).traitGrants?.LeyLine || []).includes('08042'),
    '地点获得灵脉标记')
})

// ── 08043 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08043 通路档案 入场 4 灵脉；免费移灵脉到非精英敌人，行动不触发趁乱攻击（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08043')
  resolveAbility(state, '08043', { kind: 'entersPlay', assetCode: '08043' })
  let current = me(state).assets.find(card => card.code === '08043')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10 })
  resolveAbility(state, '08043', { kind: 'free', assetCode: '08043', choose: pending => (pending.options.some(option => option.id === foe.id) ? foe.id : null) })
  current = me(state).assets.find(card => card.code === '08043')
  assert.equal(current.uses, 3, '扣减 1 灵脉')
  assert.equal(registeredEntry('08043').abilities.find(ability => ability.kind === 'action').noOpportunityAttack, true,
    '本行动不会触发趁乱攻击')
})

// ── 08044 通路档案（等级 4，approximation）──────────────────────────────────
test('P6 08044 通路档案 入场 4 灵脉；行动令调查员抽 1 并治愈 1 点伤害（approximation）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const archive = asset(state, '08044')
  resolveAbility(state, '08044', { kind: 'entersPlay', assetCode: '08044' })
  let current = me(state).assets.find(card => card.code === '08044')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10 })
  resolveAbility(state, '08044', { kind: 'free', assetCode: '08044', choose: pending => (pending.options.some(option => String(option.id) === '0') ? '0' : null) })
  current = me(state).assets.find(card => card.code === '08044')
  assert.equal(current.uses, 3, '扣减 1 灵脉到调查员（近似：仅扣减灵脉数）')
  me(state).damage = 2
  me(state).hand = []
  me(state).deck = ['10006', '10023']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === current.id
    && String(option.label || '').includes('抽 1'))
  assert.ok(action, '通路档案应有抽牌/治愈行动')
  move(state, action)
  act(state, pending => (pending.options.some(option => option.id === 'damage') ? 'damage' : null))
  assert.equal(me(state).hand.length, 1, '抽 1 张')
  assert.equal(me(state).damage, 1, '治愈 1 点伤害')
})

// ── 08046 地下支持（approximation：构筑限制待 P7）───────────────────────────
test('P6 08046 地下支持 建造时牌库 -5（近似：同名限制待构筑层接线）', () => {
  const state = fixture('01001')
  const baseRules = deckRules(me(state))
  const builtRules = deckRules(me(state), ['08046'], {})
  assert.equal(builtRules.size, baseRules.size - 5, '构筑层牌库 -5')
  assert.equal(registeredEntry('08046').deckConstruction.sizeBonus, -5)
})

// ── 08047 提前侦察（approximation）──────────────────────────────────────────
test('P6 08047 提前侦察 最多移动 3 次，移动期间不与敌交战（approximation：移动后立即解除交战）', () => {
  const state = fixture('01001')
  me(state).assets = []
  twoLocations(state)
  state.enemies.push({
    id: 'watcher', code: 'ghoulMinion', name: '旁观敌人', location: 'attic',
    fight: 2, evade: 2, health: 10, damageTaken: 0, damage: 1, horror: 1, engagedSeat: null, exhausted: false,
  })
  let moves = 0
  const plan = ['attic', 'study', 'attic']
  resolvePlayed(state, '08047', {
    choose: pending => {
      const wanted = plan[moves]
      const option = pending.options.find(item => item.id === wanted)
      if (!option) return pending.options.some(item => item.id === 'stop') ? 'stop' : null
      moves += 1
      return option.id
    },
  })
  assert.equal(moves, 3, '最多移动 3 次')
  assert.equal(me(state).location, 'attic', '按选择移动 3 次')
  assert.equal(freshEnemy(state, 'watcher').engagedSeat, null, '移动期间/结束后均未与敌人交战')
})
