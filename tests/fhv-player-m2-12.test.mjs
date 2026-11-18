// 九循环《铁杉谷盛宴》P6 一般玩家卡 · M2-12 分片（10129–10138）逐卡验收。
//
// 分片共 10 张；每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> …` 真实行为测试。
// 近似实现（缺引擎读点）在条目 note 里披露，并在
// `artifacts/migration/fhv/primitive-requests/<code>.json` 登记。
//
// 约定：
//   · 事件走真实打牌管线（legalMoves / play），支援能力走 move 的 ability 动作，
//     弱点走真实的「抽牌 → 显现」管线；
//   · 引擎在每次 applyMove 后替换调查员/支援对象 —— 断言前从 state 重新读取；
//   · 混乱袋用 state.debugNextTokens 强制揭示顺序（与 fhv-primitives / M2-1 同一调试读点）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, asset, enemy } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry, playedActionCost } from '../src/engine/ability.js'
import { legalMoves, canEquip, getMaxHealth, getMaxSanity, getStat, commitIcons } from '../src/engine/engine.js'

import card10129 from '../src/cards/entries/10129.js'
import card10130 from '../src/cards/entries/10130.js'
import card10131 from '../src/cards/entries/10131.js'
import card10132 from '../src/cards/entries/10132.js'
import card10133 from '../src/cards/entries/10133.js'
import card10134 from '../src/cards/entries/10134.js'
import card10135 from '../src/cards/entries/10135.js'
import card10136 from '../src/cards/entries/10136.js'
import card10137 from '../src/cards/entries/10137.js'
import card10138 from '../src/cards/entries/10138.js'

const ENTRIES = [card10129, card10130, card10131, card10132, card10133,
  card10134, card10135, card10136, card10137, card10138]
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const me = (state, seat = 0) => state.investigators[seat]
const fresh = (state, id) => state.investigators.flatMap(inv => inv.assets).find(card => card.id === id)
const threatOf = (state, code, seat = 0) => me(state, seat).threat.find(card => card.code === code)
const pickLabel = (pending, pattern) => (pending.options.find(option => pattern.test(String(option.label))) || {}).id ?? null
const pickId = (pending, id) => (pending.options.some(option => String(option.id) === String(id)) ? String(id) : null)
// 只从「反应窗口」（kind 'reaction'）里挑卡面选项：投入窗口的同名标签（「投入：X」）不能被误选。
const pickReaction = (pending, pattern) => (pending.kind === 'reaction' ? pickLabel(pending, pattern) : null)

// 把一张牌放到牌库顶（drawCards 用 pop，末位是牌库顶）。
const putOnDeckTop = (state, code, seat = 0) => {
  const inv = me(state, seat)
  inv.deck = [...Array(10).fill('01088'), code]
}
const drawTop = (state, choose) => {
  move(state, { action: 'draw' })
  settle(state, choose)
}

// ── 10129 静候时机 ─────────────────────────────────────────────────────────
test('P6 10129 静候时机 Double 额外花 1 行动；下个回合获得额外行动', () => {
  assert.equal(playedActionCost('10129'), 1, '[[双重]]：played 描述子声明额外 1 行动费用')
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10129']
  me(state).resources = 5
  me(state).actionsLeft = 3
  const play = legalMoves(state).find(option => option.action === 'play' && option.cardId === '10129')
  assert.ok(play, '「静候时机」是合法的打牌行动')
  move(state, play)
  settle(state)
  assert.equal(me(state).actionsLeft, 1, '打出 1 行动 + Double 额外 1 行动')
  assert.equal(me(state).resources, 5, '0 资源费用')
  assert.equal(me(state).discard.includes('10129'), true, '事件结算后进弃牌堆')
  assert.equal(me(state).extraActionNextTurn, true, '记录「下个回合的额外行动」')

  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(state.round, 2, '结束回合后进入下一轮')
  assert.equal(me(state).actionsLeft, 4, '下个回合 3 + 1 行动（近似，印刷为 +2）')
  assert.equal(me(state).extraActionNextTurn, undefined, '额外行动已消费')
})

// ── 10130 盛装出席 ─────────────────────────────────────────────────────────
// 端到端：用一张探针支援发起谈判检定，并在 test.beforeCommit 窗口强制投入盛装出席。
let probeActionKind = 'parley'
registerCardAbilities({ code: 'p6-10130-probe', abilities: [
  {
    kind: 'action',
    actionKind: 'parley',
    label: '谈判检定（意志 0）',
    resolve: ({ inv, api }) => {
      api.test(inv.seat, 'willpower', 0, {
        source: { code: 'p6-10130-probe', label: probeActionKind === 'parley' ? '谈判' : '检定',
          actionKind: probeActionKind },
      })
    },
  },
] })
registerCardAbilities({ code: 'p6-10130-commit', abilities: [
  {
    kind: 'free',
    trigger: 'test.beforeCommit',
    label: '投入盛装出席',
    resolve: ({ inv, api }) => { api.commitCards(inv.seat, ['10130']) },
  },
] })

function runWellDressed(kind) {
  probeActionKind = kind
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10130']
  const probe = asset(state, 'p6-10130-probe')
  asset(state, 'p6-10130-commit')
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: probe.id, abilityIndex: 0 })
  let committed = false
  settle(state, pending => {
    if (committed) return null
    const option = pickLabel(pending, /投入盛装出席/)
    if (!option) return null
    committed = true
    return option
  })
  return state
}

test('P6 10130 盛装出席 谈判检定期间投入时获得[wild][wild][wild]（印刷 1 + 3）', () => {
  const parley = runWellDressed('parley')
  const base = getStat(parley, me(parley), 'willpower')
  assert.equal(parley.lastTestResult.value, base + 4, '谈判检定：印刷 1 个[wild] + 条件 3 个[wild]')
  assert.equal(me(parley).discard.includes('10130'), true, '盛装出席真实投入本次检定（检定后进弃牌堆）')

  const plain = runWellDressed('investigate')
  const plainBase = getStat(plain, me(plain), 'willpower')
  assert.equal(plain.lastTestResult.value, plainBase + 1, '非谈判检定只提供印刷的 1 个[wild]')
  // 读点复核（stats.js#conditionalCommitIcons）：非谈判 1 点、谈判 4 点。
  plain.skillTest = { skill: 'willpower', actionKind: 'investigate' }
  assert.equal(commitIcons(plain, me(plain), '10130', 'willpower'), 1)
  plain.skillTest = { skill: 'willpower', actionKind: 'parley' }
  assert.equal(commitIcons(plain, me(plain), '10130', 'willpower'), 4)
})

// ── 10131 黎明之星 ─────────────────────────────────────────────────────────
test('P6 10131 黎明之星 快速打出：忽略[诅咒]标记的修正值，并按个数造成伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10131']
  me(state).resources = 5
  const here = state.locations.find(location => location.id === me(state).location)
  here.revealed = true
  here.clues = 2
  here.shroud = 2
  const foe = enemy(state, { fight: 1, health: 10, engagedSeat: null })
  state.chaosBag = ['curse', '0', '0']
  state.debugNextTokens = ['curse', '0']
  move(state, { action: 'investigate' })
  settle(state, pending => pickReaction(pending, /黎明之星/))
  assert.equal(state.lastTestResult.value, getStat(state, me(state), 'intellect'),
    '诅咒标记 -2 修正被忽略，技能值取基础智力')
  assert.equal(state.lastTestResult.success, true, '难度 2 成功')
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 1, '每忽略 1 个[诅咒]标记造成 1 点伤害')
  assert.equal(me(state).clues, 1, '调查成功发现线索')
  assert.equal(me(state).resources, 4, '事件 1 资源')
  assert.equal(me(state).discard.includes('10131'), true, '快速事件结算后进弃牌堆')
})

// ── 10132 密教珍藏 ─────────────────────────────────────────────────────────
test('P6 10132 密教珍藏 额外槽只给[[祝福]]/[[诅咒萦绕]]支援，占用满时仍可装备', () => {
  const withoutReliquary = fixture('01001')
  me(withoutReliquary).assets = []
  asset(withoutReliquary, '01059') // Holy Rosary：饰品槽 1/1
  assert.equal(canEquip(me(withoutReliquary),
    { code: '10019', type: 'asset', slots: ['Accessory'], traits: ['Blessed'] }), false,
  '饰品槽已满时不能再装备[[祝福]]饰品')

  const state = fixture('01001')
  me(state).assets = []
  asset(state, '10132') // 密教珍藏（永久，三格受限额外槽）
  asset(state, '01059') // 饰品槽 1/1
  assert.equal(canEquip(me(state),
    { code: '10019', type: 'asset', slots: ['Accessory'], traits: ['Blessed', 'Item'] }), true,
  '受限额外饰品槽可以放[[祝福]]支援')
  assert.equal(canEquip(me(state),
    { code: '01075', type: 'asset', slots: ['Accessory'], traits: ['Item', 'Charm'] }), false,
  '不属于[[祝福]]/[[诅咒萦绕]]的饰品不能用这格')

  // 手部：双手装备已满（2/2）时，[[诅咒]]手部支援仍可进入受限槽。
  asset(state, '01016')
  asset(state, '01020')
  assert.equal(canEquip(me(state),
    { code: '10034', type: 'asset', slots: ['Hand'], traits: ['Blessed', 'Weapon'] }), true,
  '受限额外手槽可以放[[祝福]]支援')
  assert.equal(canEquip(me(state),
    { code: '01030', type: 'asset', slots: ['Hand'], traits: ['Item', 'Tool'] }), false,
  '普通手部支援不能用受限额外槽')
})

// ── 10133 破碎冠冕 ─────────────────────────────────────────────────────────
function investigateWithBlessAndCurse(state) {
  const here = state.locations.find(location => location.id === me(state).location)
  here.revealed = true
  here.clues = 3
  here.shroud = 0
  state.chaosBag = ['bless', 'curse', '0', '0']
  state.debugNextTokens = ['bless', 'curse', '0']
  move(state, { action: 'investigate' })
  settle(state, pending => pickReaction(pending, /破碎冠冕/))
}

test('P6 10133 破碎冠冕 同检定揭示祝福与诅咒后放贡品；满 3 个与暮光冠冕交换', () => {
  const state = fixture('01001')
  me(state).assets = []
  const diadem = asset(state, '10133')
  assert.equal(fresh(state, diadem.id).uses, 0, '初始没有贡品')
  assert.equal(registeredEntry('10133').assetRule.controlledTraitLimit.amount, 1, '每位调查员仅限 1 张[[面具]]')
  assert.equal(canEquip(me(state), { code: '10134', type: 'asset', slots: [], traits: ['Mask'] }), false,
    '已控制一张[[面具]]时不能再控制暮光冠冕（同 trait 上限的唯一读点 canEquip）')

  investigateWithBlessAndCurse(state)
  assert.equal(fresh(state, diadem.id).uses, 1, '同时揭示[bless]与[curse] → 放置 1 个贡品')

  // 只揭示一个诅咒：不再放贡品。
  state.chaosBag = ['curse', '0', '0']
  state.debugNextTokens = ['curse', '0']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(fresh(state, diadem.id).uses, 1, '没有同时揭示两种标记时不放贡品')

  investigateWithBlessAndCurse(state)
  assert.equal(fresh(state, diadem.id).uses, 2)
  investigateWithBlessAndCurse(state)
  const twilight = me(state).assets.find(card => card.code === '10134')
  assert.ok(twilight, '3 个贡品：与暮光冠冕交换')
  assert.equal(twilight.uses, 3, '所有贡品移动到暮光冠冕上')
  assert.equal(me(state).assets.some(card => card.code === '10133'), false, '破碎冠冕已离场')
  assert.equal(me(state).hand.includes('10133'), true, '近似：破碎冠冕返回手牌（缺绑定卡就地交换原语）')
})

// ── 10134 暮光冠冕 ─────────────────────────────────────────────────────────
test('P6 10134 暮光冠冕 揭示[诅咒]时花 1 贡品横置改为[elder_sign]；没有贡品则换回破碎冠冕', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10133'] // 反向交换要求破碎冠冕在手牌（由 10133 的交换放入）
  const twilight = asset(state, '10134', { uses: 1 })
  const here = state.locations.find(location => location.id === me(state).location)
  here.revealed = true
  here.clues = 2
  here.shroud = 0
  state.chaosBag = ['curse', '0']
  state.debugNextTokens = ['curse', '0']
  move(state, { action: 'investigate' })
  settle(state, pending => pickReaction(pending, /暮光冠冕/))
  assert.equal(state.lastTestResult.drawn.includes('eldersign'), true, '[诅咒]标记改为视为[elder_sign]，原标记归还混乱袋')
  assert.equal(state.lastTestResult.success, true, '检定成功')
  assert.equal(me(state).assets.some(card => card.code === '10134'), false, '没有贡品后换回破碎冠冕')
  assert.equal(me(state).assets.some(card => card.code === '10133'), true, '破碎冠冕放置入场')
  assert.equal(me(state).hand.includes('10134'), true, '近似：暮光冠冕返回手牌')
  assert.equal(fresh(state, twilight.id), undefined, '原实例已离场')
})

// ── 10135 手部残疾 ─────────────────────────────────────────────────────────
test('P6 10135 手部残疾 显现二选一进威胁区并-1生命；花 2 行动弃掉', () => {
  const state = fixture('01001')
  me(state).assets = []
  const healthBefore = getMaxHealth(me(state))
  putOnDeckTop(state, '10135')
  drawTop(state, pending => pickId(pending, 'threat'))
  const threat = threatOf(state, '10135')
  assert.ok(threat, '放进威胁区域')
  assert.equal(getMaxHealth(me(state)), healthBefore - 1, '你得到 -1 生命值')
  assert.equal(me(state).discard.includes('10135'), false, '威胁区弱点不进入弃牌堆')

  // 行动点不足 2 时能力不可用。
  me(state).actionsLeft = 1
  assert.equal(legalMoves(state).some(option => option.action === 'ability' && option.assetId === threat.id), false,
    '行动点不足时 2 行动能力不出现')
  me(state).actionsLeft = 2
  const discardSelf = legalMoves(state).find(option => option.action === 'ability' && option.assetId === threat.id)
  assert.ok(discardSelf, '[action][action]：弃掉手部残疾')
  move(state, discardSelf)
  settle(state)
  assert.equal(me(state).actionsLeft, 0, '花费 2 行动')
  assert.equal(threatOf(state, '10135'), undefined, '离开威胁区域')
  assert.equal(me(state).discard.includes('10135'), true, '进入弃牌堆')
  assert.equal(getMaxHealth(me(state)), healthBefore, '-1 生命值随离场消失')
})

// ── 10136 背伤 ────────────────────────────────────────────────────────────
test('P6 10136 背伤 显现可选：受到 1 点伤害并洗回牌库', () => {
  const state = fixture('01001')
  me(state).assets = []
  putOnDeckTop(state, '10136')
  drawTop(state, pending => pickId(pending, 'shuffle'))
  assert.equal(me(state).damage, 1, '受到 1 点伤害')
  assert.equal(threatOf(state, '10136'), undefined, '没有进入威胁区域')
  assert.equal(me(state).deck.includes('10136'), true, '卡牌混洗回牌库')
  assert.equal(me(state).discard.includes('10136'), false)

  // 另一条路径：放进威胁区后 -1 生命值。
  const other = fixture('01001')
  me(other).assets = []
  const healthBefore = getMaxHealth(me(other))
  putOnDeckTop(other, '10136')
  drawTop(other, pending => pickId(pending, 'threat'))
  assert.ok(threatOf(other, '10136'))
  assert.equal(getMaxHealth(me(other)), healthBefore - 1)
})

// ── 10137 银蛾 ────────────────────────────────────────────────────────────
test('P6 10137 银蛾 显现进威胁区并-1神智；2 行动弃掉', () => {
  const state = fixture('01001')
  me(state).assets = []
  const sanityBefore = getMaxSanity(me(state))
  const healthBefore = getMaxHealth(me(state))
  putOnDeckTop(state, '10137')
  drawTop(state, pending => pickId(pending, 'threat'))
  const threat = threatOf(state, '10137')
  assert.ok(threat, '放进威胁区域')
  assert.equal(getMaxSanity(me(state)), sanityBefore - 1, '你得到 -1 神智值')
  assert.equal(getMaxHealth(me(state)), healthBefore, '生命值不变')

  const discardSelf = legalMoves(state).find(option => option.action === 'ability' && option.assetId === threat.id)
  assert.ok(discardSelf, '[action][action]：弃掉银蛾')
  move(state, discardSelf)
  settle(state)
  assert.equal(threatOf(state, '10137'), undefined)
  assert.equal(getMaxSanity(me(state)), sanityBefore, '-1 神智值随离场消失')
})

// ── 10138 德兹特里奇之誓 ──────────────────────────────────────────────────
test('P6 10138 德兹特里奇之誓 显现二选一；威胁区-1神智，或 1 恐惧洗回牌库', () => {
  const state = fixture('01001')
  me(state).assets = []
  const sanityBefore = getMaxSanity(me(state))
  putOnDeckTop(state, '10138')
  drawTop(state, pending => pickId(pending, 'threat'))
  assert.ok(threatOf(state, '10138'), '放进威胁区域')
  assert.equal(getMaxSanity(me(state)), sanityBefore - 1, '你得到 -1 神智值')

  const other = fixture('01001')
  me(other).assets = []
  putOnDeckTop(other, '10138')
  drawTop(other, pending => pickId(pending, 'shuffle'))
  assert.equal(me(other).horror, 1, '受到 1 点恐惧')
  assert.equal(me(other).deck.includes('10138'), true, '卡牌混洗回牌库')
  assert.equal(threatOf(other, '10138'), undefined)
})
