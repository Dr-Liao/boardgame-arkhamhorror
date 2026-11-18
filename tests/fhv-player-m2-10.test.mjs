// 九循环《铁杉谷盛宴》P6 一般玩家卡 · M2-10 分片（10109–10118）逐卡 Node 验收。
//
// 分片共 10 张；每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> …` 真实行为测试。
// 近似/缺读点在条目 note 里披露，并在 `artifacts/migration/fhv/primitive-requests/<code>.json` 登记。
//
// 约定：
//   · 事件走真实打牌管线（legalMoves / play + settle），支援能力走 move 的 ability 动作；
//   · 引擎在每次 applyMove 后可能替换调查员对象——断言前从 state 重新读取（本分片不需要事务重放）；
//   · 混乱袋用 state.debugNextTokens 强制揭示顺序（与 fhv-primitives 同一调试读点，仅测试用）；
//   · 先 import core-fixture（它会评估 engine.js 并把 entries/index.js 的存量条目注册完），
//     再 import 本分片条目并自注册缺少的条目；否则提前注册会让 engine.js 跳过整批注册。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, asset, enemy, validateMove } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry, playedActionCost } from '../src/engine/ability.js'
import { legalMoves, canEquip, getStat, applyDamage } from '../src/engine/engine.js'
import { commitProfile } from '../src/engine/lifecycle.js'
import { modifierTotal } from '../src/engine/modifiers.js'

import card10109 from '../src/cards/entries/10109.js'
import card10110 from '../src/cards/entries/10110.js'
import card10111 from '../src/cards/entries/10111.js'
import card10112 from '../src/cards/entries/10112.js'
import card10113 from '../src/cards/entries/10113.js'
import card10114 from '../src/cards/entries/10114.js'
import card10115 from '../src/cards/entries/10115.js'
import card10116 from '../src/cards/entries/10116.js'
import card10117 from '../src/cards/entries/10117.js'
import card10118 from '../src/cards/entries/10118.js'

const ENTRIES = [card10109, card10110, card10111, card10112, card10113,
  card10114, card10115, card10116, card10117, card10118]
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const me = (state, seat = 0) => state.investigators[seat]
const fresh = (state, id) => state.investigators.flatMap(inv => inv.assets).find(card => card.id === id)
const optionId = (pending, pattern) => (pending.options.find(option => pattern.test(String(option.label))) || {}).id
    ?? (pending.options.some(option => pattern.test(String(option.id))) ? String(pending.options.find(option => pattern.test(String(option.id))).id) : null)
const pickDone = pending => ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id)) ?? pending.options[0]?.id

function locationWithConnections(state, inv) {
  const here = inv.location
  const annex = { id: 'p6-10112-annex', name: '偏厅', code: 'p6-10112-annex', connections: [here], clues: 0, revealed: true, shroud: 1 }
  state.locations.push(annex)
  state.locations.find(location => location.id === here).connections = [annex.id]
  return annex.id
}

// ── 10109 毛皮货 ────────────────────────────────────────────────────────────
test('P6 10109 毛皮货 在手牌中时手牌上限修正 -3，离开手牌即失效（缺 stats.handSize 读点已在 note/请求登记）', () => {
  const entry = registeredEntry('10109')
  assert.deepEqual(entry.modifiers, [{ target: 'handSize', amount: -3, condition: { sourceInHand: true } }],
    '印刷「在手牌中时手牌上限减少 3 张」= handSize 修正 + sourceInHand 条件')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /primitive-requests\/10109\.json/, '缺读点登记在请求文件')

  const state = fixture('01001')
  const inv = me(state)
  inv.hand = []
  assert.equal(modifierTotal(state, inv, 'handSize'), 0)
  inv.hand.push('10109')
  assert.equal(modifierTotal(state, inv, 'handSize'), -3, '修正来源枚举读到了手牌中的毛皮货（-3）')
  inv.hand = []
  assert.equal(modifierTotal(state, inv, 'handSize'), 0, '不在手牌时修正失效')
})

// ── 10110 草叉 ──────────────────────────────────────────────────────────────
test('P6 10110 草叉 攻击 +1[战斗]/+2 伤害；成功后附属到所在地点，任意调查员可花 1 行动控制', () => {
  const state = fixture('01001')
  me(state).assets = []
  const fork = asset(state, '10110')
  const foe = enemy(state, { fight: 1, evade: 1, health: 40 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  const actionsBefore = me(state).actionsLeft
  const baseCombat = getStat(state, me(state), 'combat')

  move(state, { action: 'ability', assetId: fork.id, abilityIndex: 0, targetId: foe.id })
  settle(state)

  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 3, '基础 1 + 2 伤害')
  assert.equal(state.lastTestResult.value, baseCombat + 1, '战斗 +1 生效')
  assert.equal(me(state).assets.some(item => item.id === fork.id), false, '成功后失去对草叉的控制')
  const here = state.locations.find(location => location.id === me(state).location)
  const attachment = here.attachments.find(card => card.code === '10110')
  assert.ok(attachment, '草叉附属到所在地点')
  assert.equal(attachment.ownerSeat, null, '附属没有控制者：任意调查员都能触发取回能力')

  const detach = legalMoves(state, 0).find(option => option.action === 'detachLocationAttachment')
  assert.ok(detach, '附属地点提供「控制草叉」的 1 行动入口')
  move(state, { action: 'detachLocationAttachment', locationId: here.id, attachmentIndex: detach.attachmentIndex })
  assert.equal(me(state).assets.filter(item => item.code === '10110').length, 1, '行动者获得草叉')
  assert.equal(state.locations.find(location => location.id === here.id).attachments.length, 0, '地点附属被取下')
  assert.equal(me(state).actionsLeft, actionsBefore - 2, '攻击 1 行动 + 取回 1 行动')

  // 负面路径：攻击失败时留在控制区、不附属。
  const missed = fixture('01001')
  me(missed).assets = []
  const missedFork = asset(missed, '10110')
  const dodger = enemy(missed, { fight: 3, evade: 1, health: 40 })
  missed.chaosBag = ['-4']
  missed.debugNextTokens = ['-4']
  move(missed, { action: 'ability', assetId: missedFork.id, abilityIndex: 0, targetId: dodger.id })
  settle(missed)
  assert.equal(missed.lastTestResult.success, false)
  assert.ok(me(missed).assets.some(item => item.id === missedFork.id), '失败时草叉仍在控制下')
  assert.equal((missed.locations.find(location => location.id === me(missed).location).attachments || []).length, 0)
})

// ── 10111 雀面具 ────────────────────────────────────────────────────────────
test('P6 10111 雀面具 每人限 1 张[[面具]]；受伤后补 1 贡品', () => {
  const state = fixture('01001')
  me(state).assets = []
  const mask = asset(state, '10111')
  assert.deepEqual([mask.uses, mask.usesType], [2, 'offerings'], '使用(2 贡品)')
  assert.equal(canEquip(me(state), { code: '10111', type: 'asset', slots: [] }), false,
    '每位调查员仅限 1 张[[面具]]（已有 1 张时不能再打出雀面具）')

  // 受伤后补 1 贡品（直接伤害让「实际受到伤害」一定落在调查员本人身上）。
  const wounded = fixture('01001')
  me(wounded).assets = []
  const hurtMask = asset(wounded, '10111', { uses: 1 })
  applyDamage(wounded, me(wounded), 1, [], true)
  assert.equal(fresh(wounded, hurtMask.id).uses, 2, '受到 1 点伤害后补满 1 个贡品')
  assert.equal(me(wounded).damage, 1)
})

test('P6 10111 雀面具 [fast] 花 1 贡品：本次[敏捷]检定 +2，每次检定仅限一次', () => {
  const state = fixture('01001')
  me(state).assets = []
  const mask = asset(state, '10111')
  const foe = enemy(state, { fight: 1, evade: 1, health: 30 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  const base = getStat(state, me(state), 'agility')
  let offers = 0
  let picked = 0
  move(state, { action: 'evade', enemyId: foe.id })
  settle(state, pending => {
    if (pending.kind === 'playerWindow') {
      const id = optionId(pending, /雀面具/)
      if (id != null) {
        offers += 1
        if (!picked) { picked += 1; return id }
      }
    }
    return null
  })
  assert.equal(picked, 1, '检定窗口列出了雀面具')
  assert.equal(offers, 1, '每次技能检定仅限一次（第二个窗口不再列出）')
  assert.equal(state.lastTestResult.value, base + 2, '本次检定 +2 技能值')
  assert.equal(fresh(state, mask.id).uses, 1, '花费 1 个贡品')
  assert.equal(state.enemies.find(item => item.id === foe.id).exhausted, true, '躲避成功横置敌人')
})

// ── 10112 围魏救赵 ──────────────────────────────────────────────────────────
test('P6 10112 围魏救赵 Double 额外花费 1 行动；所在地点非精英自动躲避、连接地点精英改为 1 伤害', () => {
  assert.equal(playedActionCost('10112'), 1, 'Double 的额外费用声明为 played.cost.action: 1')
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  const annexId = locationWithConnections(state, inv)
  const near = enemy(state, { fight: 1, evade: 1, health: 30, engagedSeat: 0 })
  const far = enemy(state, { fight: 1, evade: 1, health: 30, engagedSeat: null, elite: true, location: annexId })
  inv.hand = ['10112']
  inv.resources = 10
  inv.actionsLeft = 3

  inv.actionsLeft = 0
  assert.ok(validateMove(state, 0, { action: 'play', cardId: '10112' }), '没有行动时不能支付 Double 的额外费用')
  inv.actionsLeft = 3

  move(state, { action: 'play', cardId: '10112' })
  const prompts = []
  settle(state, pending => {
    prompts.push(pending.options.map(option => option.id))
    if (pending.options.some(option => option.id === 'evade')) return 'evade'
    if (pending.options.some(option => option.id === 'damage')) return 'damage'
    return pickDone(pending)
  })
  assert.deepEqual(prompts, [['evade', 'damage', 'skip'], ['damage', 'skip']],
    '非精英可选自动躲避/伤害；精英没有躲避选项')
  assert.equal(state.enemies.find(item => item.id === near.id).exhausted, true, '所在地点非精英被自动躲避')
  assert.equal(state.enemies.find(item => item.id === near.id).engagedSeat, null, '自动躲避会脱离交战')
  assert.equal(state.enemies.find(item => item.id === far.id).damageTaken, 1, '连接地点精英受到 1 点伤害')
  assert.equal(me(state).actionsLeft, 1, '打出 1 行动 + Double 额外 1 行动')
  assert.equal(me(state).resources, 7, '支付 3 资源')

  // 没有敌人的时候不能打出。
  const quiet = fixture('01001')
  quiet.investigators[0].hand = ['10112']
  assert.equal(card10112.playCondition[0].when({ state: quiet, inv: quiet.investigators[0] }), false)
})

// ── 10113 破釜沉舟 ──────────────────────────────────────────────────────────
test('P6 10113 破釜沉舟 忽略所有费用（含[action]与弹药）结算弃牌堆武器的[action]能力，然后洗回牌库', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  inv.discard = ['01016']
  const foe = enemy(state, { fight: 1, evade: 1, health: 30 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  inv.hand = ['10113']
  inv.resources = 10
  inv.actionsLeft = 5

  assert.equal(validateMove(state, 0, { action: 'play', cardId: '10113' }), null, '弃牌堆有[[武器]]/[[工具]]支援时可以打出')
  move(state, { action: 'play', cardId: '10113' })
  settle(state)

  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2, '结算了 .45自动手枪的[action]攻击（基础 1 + 1 伤害）')
  assert.equal(me(state).actionsLeft, 4, '只支付事件本身的 1 行动：被结算能力的 [action] 费用被忽略')
  assert.equal(me(state).resources, 8, '支付 2 资源')
  assert.equal(me(state).discard.includes('01016'), false, '所选支援离开弃牌堆')
  assert.equal(me(state).deck.filter(code => code === '01016').length, 1, '所选支援洗回牌库')

  const empty = fixture('01001')
  empty.investigators[0].discard = []
  empty.investigators[0].hand = ['10113']
  assert.ok(validateMove(empty, 0, { action: 'play', cardId: '10113' }), '没有可结算支援时不能打出')})

// ── 10114 缓兵之计 ──────────────────────────────────────────────────────────
test('P6 10114 缓兵之计 谈判检定[意志]（较低的战斗/躲避）；成功横置且非精英下次补给不重整，失败返回手牌', () => {
  const descriptor = registeredEntry('10114').abilities[0]
  assert.equal(descriptor.countsAs, 'parley', '按谈判行动结算（不引发趁乱攻击）')
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  const foe = enemy(state, { fight: 2, evade: 4, health: 30 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  inv.hand = ['10114']
  inv.resources = 10
  inv.actionsLeft = 5

  move(state, { action: 'play', cardId: '10114' })
  settle(state)
  const after = state.enemies.find(item => item.id === foe.id)
  assert.equal(state.lastTestResult.skill, 'willpower')
  assert.equal(state.lastTestResult.difficulty, 2, 'X = min(战斗 2, 躲避 4)')
  assert.equal(state.lastTestResult.success, true)
  assert.equal(after.exhausted, true, '检定成功横置敌人')
  assert.equal(after.engagedSeat, 0, '不解除交战')
  assert.deepEqual(after.preventReady, { from: state.round, rounds: 1 }, '非精英下一个补给阶段不重整')
  assert.ok(me(state).discard.includes('10114'), '成功后进入弃牌堆')

  // 负面路径：失败返回手牌。
  const failed = fixture('01001')
  const failedInv = me(failed)
  failedInv.assets = []
  failedInv.hand = []
  const stubborn = enemy(failed, { fight: 2, evade: 4, health: 30 })
  failed.chaosBag = ['-4']
  failed.debugNextTokens = ['-4']
  failedInv.hand = ['10114']
  failedInv.resources = 10
  failedInv.actionsLeft = 5
  move(failed, { action: 'play', cardId: '10114' })
  settle(failed)
  assert.equal(failed.lastTestResult.success, false)
  assert.ok(me(failed).hand.includes('10114'), '检定失败返回手牌')
  assert.equal(me(failed).discard.includes('10114'), false)
  assert.notEqual(failed.enemies.find(item => item.id === stubborn.id).exhausted, true, '失败不横置')
})

// ── 10115 阴差阳错 ──────────────────────────────────────────────────────────
test('P6 10115 阴差阳错 Double 额外 1 行动；移动最多 5 点伤害/恐惧，每击败一个支援抽 1 张，然后移出游戏', () => {
  assert.equal(playedActionCost('10115'), 1)
  assert.equal(registeredEntry('10115').removeAfterPlay, true, '结算后从游戏中移除')
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  inv.deck = Array(10).fill('01088')
  inv.damage = 5
  inv.horror = 1
  const beatCop = asset(state, '01018') // 生命 2 / 理智 2
  const guardDog = asset(state, '01021') // 生命 3 / 理智 1
  inv.hand = ['10115']
  inv.resources = 10
  inv.actionsLeft = 3

  inv.actionsLeft = 0
  assert.ok(validateMove(state, 0, { action: 'play', cardId: '10115' }), '没有行动时不能支付 Double 的额外费用')
  inv.actionsLeft = 3

  move(state, { action: 'play', cardId: '10115' })
  let moves = 0
  settle(state, pending => {
    const damageOption = pending.options.find(option => /^damage:/.test(String(option.id)))
    if (damageOption) {
      moves += 1
      return damageOption.id
    }
    return pending.options.some(option => option.id === 'stop') ? 'stop' : pickDone(pending)
  })
  assert.equal(moves, 5, '移满 5 点伤害')
  assert.equal(me(state).damage, 0, '调查员身上的 5 点伤害全部移走')
  assert.equal(me(state).horror, 1, '恐惧未移动（伤害额度已用满）')
  assert.equal(me(state).assets.some(item => item.id === beatCop.id), false, '01018 被击败')
  assert.equal(me(state).assets.some(item => item.id === guardDog.id), false, '01021 被击败')
  assert.deepEqual([...me(state).discard].sort(), ['01018', '01021'], '被击败的支援进入弃牌堆')
  assert.equal(me(state).hand.length, 2, '击败 2 个支援 → 抽 2 张牌')
  assert.deepEqual(state.removedFromGame, ['10115'], '阴差阳错移出游戏')
  assert.equal(me(state).actionsLeft, 1, '打出 1 行动 + Double 额外 1 行动')
})

// ── 10116 出奇制胜 ──────────────────────────────────────────────────────────
test('P6 10116 出奇制胜 只能投入对所在地点/连接地点敌人的攻击或躲避检定；成功后对该敌人造成 1 点伤害', () => {
  const profile = commitProfile('10116')
  assert.equal(profile.anySkill, true, '印刷没有图标，需要 anySkill 才能进入投入候选')
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  const foe = enemy(state, { fight: 1, evade: 1, health: 30 })
  const testFight = { source: { label: '攻击', enemyId: foe.id }, target: { kind: 'enemy', id: foe.id } }
  assert.equal(profile.commitCondition({ state, owner: inv, test: testFight }), true, '对所在地点敌人的攻击检定可投入')
  assert.equal(profile.commitCondition({ state, owner: inv, test: { source: { label: '调查' } } }), false, '调查检定不可投入')
  foe.location = 'p6-10116-far'
  assert.equal(profile.commitCondition({ state, owner: inv, test: testFight }), false, '不在所在地点/连接地点的敌人不可投入')
  foe.location = inv.location

  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  inv.hand = ['10116']
  move(state, { action: 'fight', enemyId: foe.id })
  let picked = false
  settle(state, pending => {
    if (pending.kind === 'commit' && !picked) {
      const id = optionId(pending, /出奇制胜/)
      if (id != null) { picked = true; return id }
    }
    return null
  })
  assert.equal(picked, true, '真实攻击检定的投入窗口列出出奇制胜')
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2, '攻击基础 1 + 出奇制胜 1')
  assert.ok(me(state).discard.includes('10116'), '投入后进入弃牌堆')
})

// ── 10117 飞斧 ──────────────────────────────────────────────────────────────
test('P6 10117 飞斧 把[敏捷]加入技能值、伤害 +1；未击败则附属到敌人，击败则弃掉飞斧', () => {
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  const hatchet = asset(state, '10117')
  const tough = enemy(state, { fight: 1, evade: 1, health: 30 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  const base = getStat(state, inv, 'combat') + getStat(state, inv, 'agility')

  move(state, { action: 'ability', assetId: hatchet.id, abilityIndex: 0, targetId: tough.id })
  settle(state)
  assert.equal(state.lastTestResult.value, base, '技能值 = [战斗] + [敏捷]')
  assert.equal(state.enemies.find(item => item.id === tough.id).damageTaken, 2, '基础 1 + 1 伤害')
  assert.equal(me(state).assets.some(item => item.id === hatchet.id), false, '未击败敌人 → 失去控制')
  const attached = state.enemies.find(item => item.id === tough.id).attachments
    .find(card => card.code === '10117')
  assert.ok(attached, '飞斧附属到被攻击的敌人')
  assert.equal(attached.hostedPlayerAsset, true, '按玩家附属记录（hosted-asset 原语）')

  // 击败敌人时改为弃掉飞斧。
  const killed = fixture('01001')
  const killerInv = me(killed)
  killerInv.assets = []
  killerInv.hand = []
  const axe = asset(killed, '10117')
  const weak = enemy(killed, { fight: 1, evade: 1, health: 2, damageTaken: 1 })
  killed.chaosBag = ['0']
  killed.debugNextTokens = ['0']
  move(killed, { action: 'ability', assetId: axe.id, abilityIndex: 0, targetId: weak.id })
  settle(killed)
  assert.equal(killed.enemies.some(item => item.id === weak.id), false, '敌人被击败')
  assert.equal(me(killed).assets.some(item => item.id === axe.id), false, '飞斧离开控制区')
  assert.ok(me(killed).discard.includes('10117'), '击败敌人 → 弃掉飞斧')
})

// ── 10118 百折不挠 ──────────────────────────────────────────────────────────
test('P6 10118 百折不挠 手牌投入按[wild]图标正常结算；弃牌堆投入缺引擎读点（note/请求已登记）', () => {
  const entry = registeredEntry('10118')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /primitive-requests\/10118\.json/, '弃牌堆投入的缺读点登记在请求文件')

  // 手牌投入（卡面数据本身的 [wild] 图标）仍然正常：投入后进弃牌堆。
  const state = fixture('01001')
  const inv = me(state)
  inv.assets = []
  inv.hand = []
  const location = state.locations.find(item => item.id === inv.location)
  Object.assign(location, { revealed: true, shroud: 0 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  inv.hand = ['10118']
  move(state, { action: 'investigate' })
  let picked = false
  settle(state, pending => {
    if (pending.kind === 'commit' && !picked) {
      const id = optionId(pending, /百折不挠/)
      if (id != null) { picked = true; return id }
    }
    return null
  })
  assert.equal(picked, true, '手牌中的百折不挠进入投入窗口')
  assert.equal(state.lastTestResult.success, true)
  assert.ok(me(state).discard.includes('10118'), '投入后进入弃牌堆')

  // 弃牌堆里的百折不挠目前不会作为投入候选（缺 play-channels 的弃牌堆 commit 通道）。
  const discarded = fixture('01001')
  const other = me(discarded)
  other.assets = []
  other.hand = []
  other.discard = ['10118']
  const here = discarded.locations.find(item => item.id === other.location)
  Object.assign(here, { revealed: true, shroud: 0 })
  discarded.chaosBag = ['0']
  move(discarded, { action: 'investigate' })
  let offered = false
  settle(discarded, pending => {
    if (pending.kind === 'commit' && pending.options.some(option => /百折不挠/.test(String(option.label)))) offered = true
    return null
  })
  assert.equal(offered, false, '弃牌堆投入在引擎有读点之前不会出现在候选里')
})
