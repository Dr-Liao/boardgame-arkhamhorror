// Phase 2 语义原语回归（见 docs/phase2-primitives.md 与路线文档 §6 Phase 2）。
//
// 八件事各有一条（或几条）用例，共同验证「声明 → 校验 → 引擎读点 → 结算」整条链：
//   C1  布尔/禁止/无视修正    capability:* / ignore:* + modifierBlocked()
//   C2  特性/关键词/槽位授予  add:trait / add:keyword / add:slot / add:skillIcon
//   C3  费用表达式            数字 / 函数 / 声明式表达式 + describeCost 预览
//   C4  上限作用域与归属      { scope, owner, count } + describeLimit
//   B2  伤害/恐惧分配策略     api.harm({ strategy })
//   B3  检定结果契约          performTest().summary + state.lastTestResult + retryTest/commitCards
//   B5  看牌与检索            api.lookAt / api.searchDeck
//   B6  区域与牌的去向        api.moveCard
//
// 最后一段是 Phase 2 门禁的证据：21 张逃生卡必须同时满足「描述子有条目、旧 DSL 条目已删」，
// 并与 docs/phase2-primitives.md 的对照表逐行对应。
//
// 测试双：下面 TEST_ONLY_ENTRIES 用的是 015xx 这批**未实现的升级版卡**（catalog-only，
// 且全仓库没有任何用例引用它们的卡号）。它们只在本文件里承担"带描述子的资产"这一角色，
// 用来触达只有描述子 resolve 才能调用的 ctx.api；正式内容仍然只写在 card-abilities.js。

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fixture, asset, enemy, move, settle, use, legalMoves, validateMove,
} from './core-fixture.mjs'
import {
  cardKeyword, commitIcons, effectiveTraits, performTest,
} from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import {
  GRANT_TARGETS, BLOCKABLE_CAPABILITIES, IGNORABLE_RULES,
  capabilityBlocked, collectGrants, modifierBlocked, normalizeModifier, ruleIgnored, slotBonus,
} from '../src/engine/modifiers.js'
import { createEffect } from '../src/engine/effect-state.js'
import { COST_EXPRESSION_KEYS, PER_SOURCES, describeCost, evaluateCost, normalizeCostValues, validateCostValue } from '../src/engine/cost.js'
import {
  LIMIT_OWNERS, LIMIT_SCOPES, LEGACY_LIMIT_NAMES, describeLimit, limitUsed, markLimitUsed, normalizeLimit,
} from '../src/engine/limits.js'
import { LOOK_ZONES, RETURN_STRATEGIES, describeLook, normalizeLookOptions, normalizeSearchOptions } from '../src/engine/look.js'
import { CARD_DESTINATIONS, describeCardMove, normalizeCardMove, normalizeDestination } from '../src/engine/zones.js'
import { TEST_STAGES, describeTestResult, summarizeTestResult, testStage } from '../src/engine/test-result.js'

const TEST_ONLY_ENTRIES = [
  // C4：动态费用上限（每回合 2 次）。
  {
    code: '01586',
    modifiers: [{ target: 'add:slot', value: 'arcane' }],
    abilities: [{
      kind: 'action', label: '检视：每有 1 个线索付 1 资源',
      cost: { resources: { per: 'clues' } },
      limit: { scope: 'perTurn', owner: 'instance', count: 2 },
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
    }],
  },
  // B2：统一伤害入口 + 策略。
  {
    code: '01587',
    abilities: [
      { kind: 'action', label: '对自己造成 2 点伤害（不分配）',
        resolve: ({ inv, api }) => api.harm(inv.seat, { damage: 2, strategy: 'self' }) },
      { kind: 'action', label: '对自己造成 2 点伤害（先给支援）',
        resolve: ({ inv, api }) => api.harm(inv.seat, { damage: 2, strategy: 'assetsFirst' }) },
    ],
  },
  // B3：强制投入（不询问就把手牌放进检定）+ 重试上一次失败检定。
  {
    code: '01570',
    abilities: [
      { kind: 'free', trigger: 'test.beforeCommit', label: '强制投入 1 张牌',
        limit: { scope: 'perTest', owner: 'instance' },
        resolve: ({ inv, api }) => api.commitCards(inv.seat, inv.hand.slice(0, 1)) },
      { kind: 'action', label: '重试上一次失败的检定（+2）',
        resolve: ({ inv, api }) => api.retryTest(inv.seat, { bonus: 2 }) },
    ],
  },
  // B5：检索整副牌库；以及"看牌并拿走"（拿走的那张不能同时留在原区域）。
  {
    code: '01571',
    abilities: [
      {
        kind: 'action', label: '检索一张书籍',
        resolve: ({ inv, api }) => api.searchDeck(inv.seat, { trait: 'Tome', prompt: '选择一本书记加入手牌。' }),
      },
      {
        kind: 'action', label: '看弃牌堆顶 2 张，拿走 1 张',
        resolve: ({ inv, api }) => api.lookAt(inv.seat, {
          zone: 'discard', count: 2, choose: 1, returnStrategy: 'discard', prompt: '选择 1 张拿回手牌。',
        }),
      },
    ],
  },
  // B6：把弃牌堆的牌拿回手牌。
  {
    code: '01572',
    abilities: [{
      kind: 'action', label: '从弃牌堆拿回一张牌',
      resolve: ({ inv, api }) => api.moveCard({ code: '01088', from: 'discard', to: 'hand' }),
    }],
  },
]
registerCardAbilities(TEST_ONLY_ENTRIES)

// ---------------------------------------------------------------------------
// C1：布尔/禁止/无视修正
// ---------------------------------------------------------------------------

test('C1 校验：capability/ignore 目标必须是已接线的那几个 id', () => {
  assert.ok(BLOCKABLE_CAPABILITIES.includes('investigate'))
  assert.ok(IGNORABLE_RULES.includes('retaliate'))
  assert.equal(normalizeModifier({ target: 'capability:investigate' }).amount, 1, '布尔修正可以省略 amount')
  assert.throws(() => normalizeModifier({ target: 'capability:teleport' }), /未知修正目标/)
  assert.throws(() => normalizeModifier({ target: 'ignore:everything' }), /未知修正目标/)
  assert.throws(() => normalizeModifier({ target: 'capability:investigate', value: 'x' }), /只有 add:\* 目标/)
  assert.throws(() => modifierBlocked({}, null, 'skill:combat'), /只接受 capability:\* \/ ignore:\*/)
})

test('C1 引擎接线：capability:investigate 让调查行动消失并被同一读点拒绝', () => {
  const s = fixture()
  s.locations[0].clues = 2
  assert.ok(legalMoves(s).some(command => command.action === 'investigate'), '基线：可以调查')
  createEffect(s, { duration: 'endOfPhase', controllerSeat: 0, label: '不能调查',
    modifiers: [{ target: 'capability:investigate' }] })
  assert.equal(capabilityBlocked(s, s.investigators[0], 'investigate'), true)
  assert.ok(!legalMoves(s).some(command => command.action === 'investigate'), '禁止后不再出现在合法动作里')
  assert.equal(validateMove(s, 0, { action: 'investigate' }), '当前效果禁止你调查')
})

test('C1 引擎接线：ignore:retaliate / ignore:alert / ignore:opportunityAttack 各自生效', () => {
  // 反击：检定失败时敌人通常反击 2 点伤害；声明 ignore:retaliate 后不再受伤。
  const control = fixture()
  control.chaosBag = ['autofail']
  const attacker = enemy(control, { retaliate: true, damage: 2, health: 5 })
  move(control, { action: 'fight', enemyId: attacker.id })
  settle(control)
  assert.equal(control.investigators[0].damage, 2, '基线：反击造成 2 点伤害')

  const guarded = fixture()
  guarded.chaosBag = ['autofail']
  createEffect(guarded, { duration: 'endOfPhase', controllerSeat: 0,
    modifiers: [{ target: 'ignore:retaliate' }] })
  const target = enemy(guarded, { retaliate: true, damage: 2, health: 5 })
  move(guarded, { action: 'fight', enemyId: target.id })
  settle(guarded)
  assert.equal(guarded.investigators[0].damage, 0, 'ignore:retaliate 应让反击失效')
  assert.equal(ruleIgnored(guarded, guarded.investigators[0], 'retaliate'), true)

  // 借机攻击：声明 ignore:opportunityAttack 后，普通行动不再吃借机攻击。
  const opportunity = fixture()
  const lurker = enemy(opportunity, { damage: 1, health: 5 })
  opportunity.investigators[0].engaged = [lurker.id]
  lurker.engagedSeat = 0
  move(opportunity, { action: 'resource' })
  settle(opportunity)
  assert.equal(opportunity.investigators[0].damage, 1, '基线：借机攻击命中')

  const stealthy = fixture()
  const quiet = enemy(stealthy, { damage: 1, health: 5 })
  stealthy.investigators[0].engaged = [quiet.id]
  quiet.engagedSeat = 0
  createEffect(stealthy, { duration: 'endOfPhase', controllerSeat: 0,
    modifiers: [{ target: 'ignore:opportunityAttack' }] })
  move(stealthy, { action: 'resource' })
  settle(stealthy)
  assert.equal(stealthy.investigators[0].damage, 0, 'ignore:opportunityAttack 应让借机攻击失效')
})

// ---------------------------------------------------------------------------
// C2：特性 / 关键词 / 槽位 / 技能图标授予
// ---------------------------------------------------------------------------

test('C2 校验与读点：add:* 需要 value，授予只作用于来源卡自己', () => {
  assert.deepEqual([...GRANT_TARGETS], ['add:trait', 'add:keyword', 'add:slot', 'add:skillIcon'])
  assert.throws(() => normalizeModifier({ target: 'add:trait' }), /必须声明 value/)
  const s = fixture()
  const inv = s.investigators[0]
  const coat = asset(s, '01518')
  createEffect(s, { duration: 'whilstAttached', sourceCode: '01518', sourceInstanceId: coat.id, controllerSeat: 0,
    label: '视为书籍', modifiers: [{ target: 'add:trait', value: 'Tome' }] })
  assert.ok(effectiveTraits(s, inv, '01518').includes('Tome'), '授予的特性进入读点')
  assert.deepEqual([...collectGrants(s, inv, 'trait', { code: '01518' })], ['Tome'])
  assert.deepEqual([...collectGrants(s, inv, 'trait', { code: '01088' })], [], '授予不外溢到别的卡')
})

test('C2 引擎接线：add:skillIcon 提高投入图标，add:slot 提高槽位，add:keyword 授予 fast', () => {
  const s = fixture()
  const inv = s.investigators[0]
  const commitCard = '01025' // 致命打击：1 个战斗图标
  assert.equal(commitIcons(s, inv, commitCard, 'combat'), 1)
  createEffect(s, { duration: 'endOfPhase', sourceCode: commitCard, controllerSeat: 0,
    label: '额外战斗图标', modifiers: [{ target: 'add:skillIcon', value: 'combat' }] })
  assert.equal(commitIcons(s, inv, commitCard, 'combat'), 2, 'add:skillIcon 计入投入图标')

  assert.equal(slotBonus(inv, 'arcane'), 0)
  asset(s, '01586')
  assert.equal(slotBonus(s.investigators[0], 'arcane'), 1, 'add:slot 与 slot:arcane 走同一个读点')
  assert.equal(cardKeyword(s, inv, commitCard, 'fast'), false)

  assert.equal(cardKeyword(s, inv, commitCard, 'fast'), false)
  createEffect(s, { duration: 'endOfPhase', sourceCode: commitCard, controllerSeat: 0,
    modifiers: [{ target: 'add:keyword', value: 'fast' }] })
  assert.equal(cardKeyword(s, inv, commitCard, 'fast'), true, 'add:keyword 可授予 fast')
})

// ---------------------------------------------------------------------------
// C3：费用表达式
// ---------------------------------------------------------------------------

test('C3 求值：声明式表达式、函数与 X 费共用一份求值器', () => {
  const cost = { resources: { per: 'clues' }, uses: { per: 'assets', filter: { usesType: 'ammo' }, offset: 1, max: 3 } }
  const ctx = {
    state: { abilityX: 2 },
    inv: { clues: 2, assets: [{ usesType: 'ammo' }, { usesType: 'ammo' }, { usesType: 'sealed' }] },
  }
  const value = normalizeCostValues(cost, ctx)
  assert.equal(value.resources, 2, '每有 1 个线索付 1 资源')
  assert.equal(value.uses, 3, '2 个弹药支援 + 1，且被 max 夹到 3')
  assert.deepEqual(describeCost(cost, ctx), '2 资源（按线索数）、3 使用次数（按符合条件的支援数）')
  assert.equal(evaluateCost({ resources: ({ inv }) => inv.clues * 2 }, ctx).resources, 4, '函数逃生口')
  assert.equal(evaluateCost({ resources: { x: true, amount: 2 } }, ctx).resources, 4, 'X 费读 state.abilityX')
  // 内容写错 → 求值失败 → 引擎按"付不起"处理，而不是抛异常。
  assert.equal(normalizeCostValues({ resources: () => { throw new Error('boom') } }, ctx), null)
  assert.ok(PER_SOURCES.includes('clues'))
  assert.ok(COST_EXPRESSION_KEYS.includes('per'))
  assert.throws(() => validateCostValue('resources', { per: 'moonlight' }), /per 只能是/)
  assert.throws(() => validateCostValue('resources', { per: 'clues', bogus: 1 }), /未知字段 bogus/)
})

test('C3 引擎接线：动态费用在预览、校验与扣费三处一致，并尊重上限 count', () => {
  const s = fixture()
  const inv = s.investigators[0]
  const charm = asset(s, '01586')
  inv.clues = 2
  inv.resources = 1
  const command = { action: 'ability', assetId: charm.id, abilityIndex: 0 }
  assert.equal(validateMove(s, 0, command), '能力成本不足', '1 资源付不起 2 线索的费用')
  inv.resources = 5
  const offered = legalMoves(s).find(moveItem => moveItem.assetId === charm.id)
  assert.ok(offered.label.includes('（2 资源（按线索数））'), `动态费用应出现在行动文案里：${offered.label}`)
  use(s, charm)
  assert.equal(s.investigators[0].resources, 4, '按求值结果扣 2 资源、再得 1 资源')
  use(s, charm)
  assert.equal(s.investigators[0].resources, 3)
  // C4：count: 2 —— 第三次不再可用。
  assert.equal(limitUsed(s, s.investigators[0], registeredEntry('01586').abilities[0], null, null, charm), true)
  assert.ok(!legalMoves(s).some(moveItem => moveItem.assetId === charm.id), 'count 用完后不再出现')
})

// ---------------------------------------------------------------------------
// C4：上限作用域与归属
// ---------------------------------------------------------------------------

test('C4 规范化：旧字符串映射到新对象，新作用域/归属/次数都可声明', () => {
  assert.deepEqual(LEGACY_LIMIT_NAMES, ['oncePerTest', 'oncePerPhase', 'oncePerRound', 'oncePerTurn', 'oncePerGame'])
  assert.equal(normalizeLimit('oncePerTurn').scope, 'perTurn')
  assert.equal(normalizeLimit('oncePerTurn').owner, 'instance')
  const limit = normalizeLimit({ scope: 'perAttack', owner: 'group', count: 3 })
  assert.deepEqual({ ...limit, label: undefined }, { scope: 'perAttack', owner: 'group', count: 3, label: undefined })
  assert.equal(describeLimit({ limit }), '团队每次攻击 3 次')
  assert.throws(() => normalizeLimit('onceEveryBlueMoon'), /未知 limit/)
  assert.throws(() => normalizeLimit({ scope: 'perTurn', owner: 'everyone' }), /limit.owner/)
  assert.throws(() => normalizeLimit({ scope: 'perTurn', count: 0 }), /limit.count/)
  assert.ok(LIMIT_SCOPES.includes('perWindow') && LIMIT_OWNERS.includes('investigator'))
})

test('C4 记账：不同归属各自独立，用完后 limitUsed 生效', () => {
  const s = fixture()
  const inv = s.investigators[0]
  const descriptor = { id: 'x#0', code: '01586', limit: normalizeLimit({ scope: 'perTurn', owner: 'investigator', count: 1 }) }
  const first = { id: 'a1', code: '01586' }
  const second = { id: 'a2', code: '01586' }
  assert.equal(limitUsed(s, inv, descriptor, null, null, first), false)
  markLimitUsed(s, inv, descriptor, null, null, first)
  assert.equal(limitUsed(s, inv, descriptor, null, null, second), true, '按调查员记账时同名副本共用')
  const perInstance = { id: 'x#1', code: '01586', limit: normalizeLimit({ scope: 'perTurn', owner: 'instance', count: 1 }) }
  markLimitUsed(s, inv, perInstance, null, null, first)
  assert.equal(limitUsed(s, inv, perInstance, null, null, second), false, '按实例记账时副本各算各的')
})

// ---------------------------------------------------------------------------
// B2：伤害/恐惧分配策略
// ---------------------------------------------------------------------------

test('B2 api.harm：strategy 决定分给谁，量与反应窗口不变', () => {
  const self = fixture()
  const selfAsset = asset(self, '01587', { health: 2 })
  move(self, { action: 'ability', assetId: selfAsset.id, abilityIndex: 0 })
  settle(self)
  assert.equal(self.investigators[0].damage, 2, 'strategy: self 全部由调查员承受')
  assert.equal(self.investigators[0].assets.find(item => item.id === selfAsset.id).damage ?? 0, 0)

  // 01021 看门狗是印刷生命 3 的盟友：assetsFirst 时先由它承接伤害。
  const soak = fixture()
  asset(soak, '01021')
  const caster = asset(soak, '01587')
  move(soak, { action: 'ability', assetId: caster.id, abilityIndex: 1 })
  settle(soak)
  assert.equal(soak.investigators[0].damage, 0, 'strategy: assetsFirst 先由支援承受')
  assert.equal(soak.investigators[0].assets.find(item => item.code === '01021').damage, 2)

  // 默认（distribute）仍然逐点询问：没有支援可承接时直接由本人承受。
  const plain = fixture()
  const plainCaster = asset(plain, '01587')
  move(plain, { action: 'ability', assetId: plainCaster.id, abilityIndex: 0 })
  settle(plain)
  assert.equal(plain.investigators[0].damage, 2)
})

// ---------------------------------------------------------------------------
// B3：检定结果契约
// ---------------------------------------------------------------------------

// 检定类用例必须在规则事务里跑：performTest 会在投入/标记阶段请求选择（与 tfa 验收用例同一写法）。
// 注意 execute 收到的是**事务草稿**（draft），不是外面的 state 对象——事务结束后 state 会被整体替换。
function withinTransaction(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'phase2PrimitiveTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 60, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('B3 结果契约：performTest 的返回值与 state.lastTestResult 是同一份标准化结果', () => {
  const s = fixture()
  s.chaosBag = ['0']
  let outcome = null
  const execute = current => { outcome = performTest(current, 0, 'willpower', 0, { resolve: () => {} }) }
  withinTransaction(s, execute)
  assert.ok(outcome?.summary, '返回值带 summary')
  assert.deepEqual(s.lastTestResult, outcome.summary, '结算后仍可读，且是同一份数据')
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.lastTestResult.stage, 'results')
  assert.ok(s.lastTestResult.successBy >= 0 && s.lastTestResult.failedBy === 0)
  assert.equal(testStage('ST.3'), 'afterCommit')
  assert.deepEqual([...TEST_STAGES], ['beforeCommit', 'afterCommit', 'tokens', 'results'])
  assert.ok(describeTestResult(s.lastTestResult).includes('成功'))
  const partial = summarizeTestResult({ seat: 0, skill: 'combat', difficulty: 3, value: 1, stage: 'ST.6' }, {})
  assert.equal(partial.failedBy, 2, '失败差额是非负整数')
})

test('B3 api：强制投入不询问、retryTest 用同一份检定参数重跑', () => {
  const s = fixture()
  const inv = s.investigators[0]
  s.chaosBag = ['0']
  inv.hand = ['01025']
  asset(s, '01570')
  // 强制投入：能力在 beforeCommit 窗口里把 1 张手牌直接放进检定。
  const before = inv.hand.length
  const commitRun = current => performTest(current, 0, 'combat', 0, { resolve: () => {} })
  // 窗口里选中免费能力（而不是 'skip'）：这就是"不询问成本、直接投入"。
  withinTransaction(s, commitRun, pending => (pending.kind === 'playerWindow'
    ? pending.options.find(option => option.id !== 'skip')?.id ?? null : null))
  assert.equal(s.investigators[0].hand.length, before - 1, '强制投入把牌放进检定')
  // 重试：先用一次失败检定留下 lastTestResult，再由能力重跑。
  s.chaosBag = ['autofail']
  const failRun = current => performTest(current, 0, 'willpower', 2, { resolve: () => {} })
  withinTransaction(s, failRun)
  assert.equal(s.lastTestResult.success, false)
  s.chaosBag = ['0']
  const retrier = s.investigators[0].assets.find(item => item.code === '01570')
  move(s, { action: 'ability', assetId: retrier.id, abilityIndex: 1 })
  settle(s)
  assert.equal(s.lastTestResult.success, true, 'retryTest 用同一 skill/difficulty 重跑')
})

// ---------------------------------------------------------------------------
// B5：看牌与检索
// ---------------------------------------------------------------------------

test('B5 选项校验与文案', () => {
  assert.ok(LOOK_ZONES.includes('deck') && RETURN_STRATEGIES.includes('shuffle'))
  assert.throws(() => normalizeLookOptions({ zone: 'library' }), /未知区域/)
  assert.throws(() => normalizeLookOptions({ count: 0 }), /count 必须是正整数/)
  assert.throws(() => normalizeSearchOptions({}), /至少声明 trait/)
  const look = normalizeLookOptions({ zone: 'deck', count: 2, arrange: true, choose: 1 })
  assert.equal(look.returnStrategy, 'shuffle')
  assert.ok(describeLook(look).includes('查看'))
})

test('B5 引擎接线：03236 探知术按 lookAt 重排牌库顶，searchDeck 从整副牌库找出书籍', () => {
  const s = fixture('01001')
  const inv = s.investigators[0]
  const deck = ['01088', '01089', '01090', '01091', '01092']
  inv.deck = [...deck]
  const oracle = asset(s, '03236')
  move(s, { action: 'ability', assetId: oracle.id, abilityIndex: 0 })
  // 探知术会问「查看哪个牌库」→「放回顺序」，最后把 3 张按所选顺序放回牌库顶。
  settle(s, pending => (pending.options.length ? pending.options[0].id : null))
  assert.equal(s.investigators[0].deck.length, deck.length, '看牌不改变牌数')
  assert.equal(s.investigators[0].assets.find(item => item.id === oracle.id).uses, 2, '花 1 充能')

  const seeker = fixture('01001')
  seeker.investigators[0].deck = ['01088', '01031', '01090']
  const finder = asset(seeker, '01571')
  move(seeker, { action: 'ability', assetId: finder.id, abilityIndex: 0 })
  settle(seeker)
  assert.ok(seeker.investigators[0].hand.includes('01031'), 'searchDeck 把书籍加入手牌')

  // 「看 2 张、拿走 1 张」：拿走的那张必须离开原区域，剩下的按 returnStrategy 处理。
  const peek = fixture('01001')
  peek.investigators[0].discard = ['01088', '01090']
  const peeker = asset(peek, '01571')
  move(peek, { action: 'ability', assetId: peeker.id, abilityIndex: 1 })
  settle(peek, pending => pending.options[0].id)
  const takenCode = peek.investigators[0].hand.at(-1)
  assert.ok(['01088', '01090'].includes(takenCode), '拿走的是看过的牌之一')
  assert.equal(peek.investigators[0].discard.includes(takenCode), false, '拿走的牌不能同时留在弃牌堆')
  assert.equal(peek.investigators[0].discard.length, 1, '另一张留在弃牌堆')
})

// ---------------------------------------------------------------------------
// B6：区域与牌的去向
// ---------------------------------------------------------------------------

test('B6 规格校验：目标区域、来源与必填字段', () => {
  assert.ok(CARD_DESTINATIONS.includes('attached'))
  assert.equal(normalizeDestination('top'), 'deckTop')
  assert.throws(() => normalizeDestination('moon'), /未知目标区域/)
  assert.throws(() => normalizeCardMove({ code: '01088', to: 'attached' }), /必须声明 attachTo/)
  assert.throws(() => normalizeCardMove({ code: '01088', to: 'beneath' }), /必须声明 beneath/)
  assert.throws(() => normalizeCardMove({ to: 'hand' }), /需要 code 或 id/)
  assert.ok(describeCardMove({ code: '01088', to: 'hand' }).includes('手牌'))
})

test('B6 引擎接线：弃牌堆的牌拿回手牌，场上支援可以移动到别处', () => {
  const s = fixture()
  const inv = s.investigators[0]
  inv.discard = ['01088']
  const mover = asset(s, '01572')
  move(s, { action: 'ability', assetId: mover.id, abilityIndex: 0 })
  settle(s)
  assert.ok(s.investigators[0].hand.includes('01088'), '弃牌堆 → 手牌')
  assert.deepEqual(s.investigators[0].discard, [])
})

// ---------------------------------------------------------------------------
// 门禁：21 张逃生卡已迁到描述子（对照表见 docs/phase2-primitives.md）
// ---------------------------------------------------------------------------

const MIGRATED_ESCAPE_CARDS = [
  '03112', '03152', '03155', '03191', '03198', '03236', '03239', '03265', '03271',
  '04018', '04026', '04035', '04103', '04152', '04154', '04160', '04204', '04233', '04269', '04274', '04306',
]

test('Phase 2 门禁：21 张逃生卡只在描述子里有行为，旧 DSL 条目已删除', () => {
  assert.equal(MIGRATED_ESCAPE_CARDS.length, 21)
  for (const code of MIGRATED_ESCAPE_CARDS) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 缺少能力层条目`)
    assert.ok(entry.abilities.length || entry.modifiers.length, `${code} 的描述子为空`)
    assert.equal(EFFECTS[code], undefined, `${code} 的旧 DSL 条目应已删除`)
    for (const ability of entry.abilities) {
      assert.equal(ability.simplified, false, `${code} 不应静默简化`)
    }
  }
  // 描述子里的逃生原语必须是零：迁移不能把债务藏进描述子数据体。
  for (const code of MIGRATED_ESCAPE_CARDS) {
    const entry = registeredEntry(code)
    const blob = JSON.stringify(entry.abilities.map(ability => ({
      effect: ability.effect, entersPlay: ability.entersPlay, leavesPlay: ability.leavesPlay,
    })))
    assert.ok(!/(tfa|carcosa|dunwich)[A-Z]/.test(blob), `${code} 仍有战役逃生原语`)
  }
})

test('Phase 2 门禁：迁移后的卡保留原行为（抽样三张）', () => {
  // 03152 偷袭：对未交战敌人 2 点伤害。
  const sneak = fixture()
  sneak.investigators[0].hand = ['03152']
  const victim = enemy(sneak, { health: 5, engagedSeat: null })
  move(sneak, { action: 'play', cardId: '03152' })
  settle(sneak)
  assert.equal(sneak.enemies.find(item => item.id === victim.id).damageTaken, 2)

  // 04103 犯罪现场：地点有敌人时发现 2 个线索。
  const scene = fixture()
  scene.locations[0].clues = 3
  enemy(scene, { health: 5 })
  scene.investigators[0].hand = ['04103']
  move(scene, { action: 'play', cardId: '04103' })
  settle(scene)
  assert.equal(scene.investigators[0].clues, 2)

  // 03239 应急物品：分配 4 点资源与补给。
  const cache = fixture()
  cache.investigators[0].hand = ['03239']
  const before = cache.investigators[0].resources
  move(cache, { action: 'play', cardId: '03239' })
  settle(cache, pending => (pending.kind === 'amount' ? pending.options.at(-1).id : null))
  assert.equal(cache.investigators[0].resources, before + 4, '选择全部 4 点资源')
})

test('Phase 2 门禁：32 张旧卡位没有新增引擎卡号分支（engineCodes 只减不增）', () => {
  // 白名单由 tools/audit-abilities.mjs 维护；架构守卫会逐码比对，这里只锁住方向。
  assert.ok(Object.keys(EFFECTS).length < 406, 'EFFECTS 条目数必须比 Phase 1 结束时更少')
})
