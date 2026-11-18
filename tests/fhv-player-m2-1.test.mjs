// 九循环《铁杉谷盛宴》P6 一般玩家卡 · M2-1 分片（10019–10028）逐卡验收。
//
// 分片共 10 张；每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> …` 真实行为测试。
// 近似实现（缺引擎读点）在条目 note 里披露，并在
// `artifacts/migration/fhv/primitive-requests/<code>.json` 登记。
//
// 约定：
//   · 事件走真实打牌管线（legalMoves / play + settle），支援能力走 move 的 ability 动作；
//   · 引擎在每次 applyMove 后替换调查员对象 —— 断言前从 state 重新读取；
//   · 混乱袋用 state.debugNextTokens 强制揭示顺序（与 fhv-primitives 同一调试读点，仅测试用）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle, asset, enemy, validateMove } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry, playedActionCost } from '../src/engine/ability.js'
import { legalMoves, canEquip, getStat } from '../src/engine/engine.js'
import { availableUseCost, payUseCost } from '../src/engine/use-transfer.js'

import card10019 from '../src/cards/entries/10019.js'
import card10020 from '../src/cards/entries/10020.js'
import card10021 from '../src/cards/entries/10021.js'
import card10022 from '../src/cards/entries/10022.js'
import card10023 from '../src/cards/entries/10023.js'
import card10024 from '../src/cards/entries/10024.js'
import card10025 from '../src/cards/entries/10025.js'
import card10026 from '../src/cards/entries/10026.js'
import card10027 from '../src/cards/entries/10027.js'
import card10028 from '../src/cards/entries/10028.js'

const ENTRIES = [card10019, card10020, card10021, card10022, card10023,
  card10024, card10025, card10026, card10027, card10028]
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const me = (state, seat = 0) => state.investigators[seat]
const fresh = (state, id) => state.investigators.flatMap(inv => inv.assets).find(card => card.id === id)
const blessings = state => state.chaosBag.filter(token => token === 'bless').length
const pickLabel = (pending, pattern) => (pending.options.find(option => pattern.test(String(option.label))) || {}).id ?? null
const pickId = (pending, id) => (pending.options.some(option => String(option.id) === String(id)) ? String(id) : null)

// ── 10019 御守 ───────────────────────────────────────────────────────────────
test('P6 10019 御守 击败敌人后横置，按印刷生命加入祝福标记（上限 5）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const token = asset(state, '10019')
  const scout = enemy(state, { code: '10011', health: 3, fight: 0, damageTaken: 2, engagedSeat: 0 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']
  move(state, { action: 'fight', enemyId: scout.id })
  settle(state, pending => pickLabel(pending, /御守/))
  assert.equal(state.enemies.some(item => item.id === scout.id), false, '敌人被击败')
  assert.equal(blessings(state), 3, '印刷生命 3 → 加入 3 个祝福标记')
  assert.equal(fresh(state, token.id).exhausted, true, '御守横置')

  // 印刷生命 10 的敌人：上限 5。
  fresh(state, token.id).exhausted = false
  const titan = enemy(state, { code: '10600', health: 10, fight: 0, damageTaken: 9, engagedSeat: 0 })
  state.debugNextTokens = ['0']
  move(state, { action: 'fight', enemyId: titan.id })
  settle(state, pending => pickLabel(pending, /御守/))
  assert.equal(state.enemies.some(item => item.id === titan.id), false)
  assert.equal(blessings(state), 8, '印刷生命 10 但上限 5 → 再 +5')
  assert.equal(fresh(state, token.id).exhausted, true)
})

// ── 10020 清理工具套装 ──────────────────────────────────────────────────────
test('P6 10020 清理工具套装 3 补给可当作自己支援的子弹支付', () => {
  const state = fixture('01001')
  me(state).assets = []
  const kit = asset(state, '10020')
  assert.deepEqual([kit.uses, kit.usesType], [3, 'supplies'], '使用(3 补给)')
  const firearm = asset(state, '01016', { uses: 1, usesType: 'ammo' })
  assert.equal(availableUseCost(state, firearm, registeredEntry), 4, '可用弹药 = 枪上 1 + 清理工具 3')
  let substituted = null
  let sourceChoices = null
  const paid = payUseCost(state, 0, firearm, 2, registeredEntry,
    spec => { sourceChoices = spec.options.map(option => option.id); return '1' },
    (source, amount) => { substituted = [source.code, amount] })
  assert.equal(paid, true, '可以支付 2 发子弹')
  assert.deepEqual(sourceChoices, ['0', '1'], '候选来源 = 枪本身 + 清理工具套装')
  assert.deepEqual(substituted, ['10020', 2], '2 发子弹由清理工具套装的补给代付')
  assert.deepEqual([fresh(state, kit.id).uses, fresh(state, firearm.id).uses], [1, 1], '扣的是清理工具，不是枪上那 1 发')
})

// ── 10021 武士刀 ────────────────────────────────────────────────────────────
test('P6 10021 武士刀 攻击 +2[combat]；正好成功 2 点时可横置 +2 伤害；[fast] 改用敏捷', () => {
  const state = fixture('01001')
  me(state).assets = []
  const katana = asset(state, '10021')
  const base = getStat(state, me(state), 'combat')
  // value = base + 2（武士刀） + 0（标记）＝ base + 2；难度 base → 正好成功 2 点。
  const target = enemy(state, { fight: base, health: 30, engagedSeat: 0 })
  state.chaosBag = ['0']
  const attack = legalMoves(state).find(option => option.action === 'ability'
    && option.assetId === katana.id && option.targetId === target.id)
  assert.ok(attack, '武士刀有攻击行动')
  move(state, attack)
  let asked = false
  settle(state, pending => {
    const option = pending.options.find(item => String(item.id) === 'exhaust')
    if (option) { asked = true; return option.id }
    return null
  })
  assert.equal(asked, true, '成功正好 2 点时询问是否横置')
  assert.equal(state.lastTestResult.value, base + 2, '本次检定 +2[combat]')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 3, '基础 1 + 横置 2 伤害')
  assert.equal(fresh(state, katana.id).exhausted, true, '武士刀横置')

  // 成功 3 点：不询问、不加伤害。
  const other = fixture('01001')
  other.investigators[0].assets = []
  const blade = asset(other, '10021')
  const far = enemy(other, { fight: getStat(other, other.investigators[0], 'combat') - 1, health: 30, engagedSeat: 0 })
  other.chaosBag = ['0']
  move(other, { action: 'ability', assetId: blade.id, abilityIndex: 0, targetId: far.id })
  let offered = false
  settle(other, pending => {
    if (pending.options.some(item => String(item.id) === 'exhaust')) offered = true
    return null
  })
  assert.equal(offered, false, '成功 3 点时不询问 +2 伤害')
  assert.equal(other.enemies.find(item => item.id === far.id).damageTaken, 1, '只造成基础 1 点伤害')
  assert.equal(fresh(other, blade.id).exhausted, false, '武士刀保持重整')

  // [fast] 横置：改用敏捷攻击。
  const agile = fixture('01001')
  agile.investigators[0].assets = []
  const katana2 = asset(agile, '10021')
  const dummy = enemy(agile, { fight: 0, health: 30, engagedSeat: 0 })
  agile.chaosBag = ['0']
  const free = legalMoves(agile).filter(option => option.action === 'ability' && option.assetId === katana2.id)
  assert.equal(free.length, 2, '两条能力：攻击 / [fast] 敏捷攻击')
  const agilityAttack = free.find(option => option.abilityIndex === 1)
  move(agile, agilityAttack)
  settle(agile)
  assert.equal(agile.lastTestResult.skill, 'agility', '使用敏捷代替战斗')
  assert.equal(agile.lastTestResult.value, getStat(agile, agile.investigators[0], 'agility'), '检定值取敏捷')
  assert.ok(agile.enemies.find(item => item.id === dummy.id).damageTaken >= 1, '攻击造成伤害')
  assert.equal(fresh(agile, katana2.id).exhausted, true, '[fast] 攻击横置武士刀')
})

// ── 10022 御札 ──────────────────────────────────────────────────────────────
test('P6 10022 御札 地点首次揭示祝福补满充能（每轮一次）；非精英敌人失去四关键词', () => {
  const state = fixture('01001')
  me(state).assets = []
  const ofuda = asset(state, '10022', { uses: 0 })
  state.locations.find(location => location.id === me(state).location).shroud = 0
  state.chaosBag = ['bless', '0', '-1']
  state.debugNextTokens = ['bless', '0']
  move(state, { action: 'investigate' })
  settle(state, pending => (pending.options.find(option => /desc:10022/.test(String(option.id))) || {}).id ?? null)
  assert.equal(fresh(state, ofuda.id).uses, 1, '地点首次揭示祝福 → 补满 1 充能')

  // 同一轮第二次揭示：每轮仅一次，不再补满。
  fresh(state, ofuda.id).uses = 0
  state.debugNextTokens = ['bless', '0']
  move(state, { action: 'investigate' })
  let replenishOffered = false
  settle(state, pending => {
    const option = pending.options.find(item => /desc:10022/.test(String(item.id)))
    if (option) replenishOffered = true
    return null
  })
  assert.equal(replenishOffered, false, '每轮仅第一次揭示补满（limit perRound）')
  assert.equal(fresh(state, ofuda.id).uses, 0)

  // [fast] 花 1 充能：只对非精英敌人可用，敌人失去警戒/冷漠/逃逸/反击。
  fresh(state, ofuda.id).uses = 1
  const elite = enemy(state, { elite: true, engagedSeat: null })
  const plain = enemy(state, { elite: false, engagedSeat: null })
  const candidates = legalMoves(state).filter(option => option.action === 'ability' && option.assetId === ofuda.id)
  assert.deepEqual(candidates.map(option => option.targetId), [plain.id], '非精英敌人才是合法目标')
  move(state, candidates[0])
  settle(state)
  const keywords = state.enemies.find(item => item.id === plain.id).keywordOverrides
  assert.deepEqual(Object.keys(keywords).sort(), ['alert', 'aloof', 'elusive', 'retaliate'])
  for (const keyword of ['alert', 'aloof', 'elusive', 'retaliate']) {
    assert.equal(keywords[keyword].enabled, false, `${keyword} 被取消`)
    assert.equal(keywords[keyword].throughRound, state.round, '持续到本轮结束')
  }
  assert.equal(fresh(state, ofuda.id).uses, 0, '花费 1 充能')
  assert.equal(state.enemies.find(item => item.id === elite.id).keywordOverrides, undefined, '精英敌人未被选中')
})

// ── 10023 狼面具 ────────────────────────────────────────────────────────────
test('P6 10023 狼面具 每个人限 1 张[[面具]]；交战后补满贡品；花贡品使战斗检定 +2', () => {
  const state = fixture('01001')
  me(state).assets = []
  const mask = asset(state, '10023', { uses: 1 })
  assert.equal(canEquip(me(state), { code: '10023', type: 'asset', slots: [] }), false,
    '每位调查员仅限 1 张[[面具]]（已有 1 张时不能再打出狼面具）')
  const foe = enemy(state, { fight: 0, health: 30, engagedSeat: null })
  const engage = legalMoves(state).find(option => option.action === 'engage')
  assert.ok(engage, '可以主动交战')
  move(state, { action: 'engage', enemyId: foe.id })
  assert.equal(state.enemies.find(item => item.id === foe.id).engagedSeat, 0)
  settle(state, pending => (pending.options.find(option => /desc:10023/.test(String(option.id))) || {}).id ?? null)
  assert.equal(fresh(state, mask.id).uses, 2, '交战后补满 1 个贡品（上限 2）')

  // 战斗检定：花 1 贡品 +2。
  state.chaosBag = ['0']
  const base = getStat(state, me(state), 'combat')
  let picked = false
  move(state, { action: 'fight', enemyId: foe.id })
  for (let index = 0; state.pendingChoice && index < 80; index++) {
    const pending = state.pendingChoice
    let choice = null
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit' && !picked) {
      const option = pending.options.find(item => /狼面具/.test(String(item.label)))
      if (option) { choice = option.id; picked = true }
    }
    move(state, { action: 'choose', choiceId: pending.id, optionId: choice ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id)) ?? pending.options[0].id })
  }
  assert.equal(picked, true, '战斗检定窗口列出狼面具')
  assert.equal(state.lastTestResult.value, base + 2, '本次检定 +2[combat]')
  assert.equal(fresh(state, mask.id).uses, 1, '花费 1 贡品')

  // 智力检定不提供该能力（卡面只给 [combat] / [agility]）。
  state.chaosBag = ['0']
  state.locations.find(location => location.id === me(state).location).shroud = 0
  move(state, { action: 'investigate' })
  let offeredOnIntellect = false
  settle(state, pending => {
    if (pending.options.some(option => /狼面具/.test(String(option.label)))) offeredOnIntellect = true
    return null
  })
  assert.equal(offeredOnIntellect, false, '智力检定不提供狼面具加值')
})

// ── 10024 赦免 ──────────────────────────────────────────────────────────────
test('P6 10024 赦免 X 费揭示 3+X 个标记：非符号标记转祝福；祝福治愈恐惧', () => {
  const numeric = fixture('01001')
  me(numeric).assets = []
  me(numeric).hand = ['10024']
  me(numeric).resources = 10
  numeric.chaosBag = ['-1', '-1', '-1', '-1', '-1']
  move(numeric, { action: 'play', cardId: '10024' })
  settle(numeric, pending => pickId(pending, '2'))
  assert.equal(me(numeric).resources, 8, '支付 X=2 资源')
  assert.equal(blessings(numeric), 5, '5 个非符号标记 → 加入 5 个祝福')
  assert.equal(me(numeric).discard.includes('10024'), true, '事件结算后进弃牌堆')

  const healer = fixture('01001')
  me(healer).assets = []
  me(healer).hand = ['10024']
  me(healer).resources = 10
  me(healer).horror = 2
  healer.chaosBag = ['bless', 'bless', '0', '0', '0']
  move(healer, { action: 'play', cardId: '10024' })
  settle(healer, pending => pickId(pending, '2') ?? pickId(pending, 'seat:0'))
  assert.equal(me(healer).horror, 0, '2 个祝福标记 → 治愈 2 点恐惧')
  assert.equal(blessings(healer), 3, '3 个非符号标记 → 加入 3 个祝福（揭示的祝福已归还标记池）')
  assert.equal(me(healer).resources, 8, '支付 X=2 资源')
})

// ── 10025 信仰指引 ──────────────────────────────────────────────────────────
test('P6 10025 信仰指引 意志代替智力调查；揭示前 +2 祝福；揭示祝福额外 1 线索', () => {
  const state = fixture('01003')
  me(state).assets = []
  me(state).hand = ['10025']
  me(state).resources = 10
  const here = state.locations.find(location => location.id === me(state).location)
  here.clues = 3
  here.shroud = 1
  state.chaosBag = ['bless', '0', '-1']
  state.debugNextTokens = ['bless', '0']
  move(state, { action: 'play', cardId: '10025' })
  settle(state, pending => pickId(pending, 'willpower'))
  assert.equal(state.lastTestResult.skill, 'willpower', '用意志代替智力调查')
  assert.ok(state.lastTestResult.drawn.includes('bless'), '本次检定揭示了祝福标记')
  assert.equal(me(state).clues, 2, '调查成功 1 个线索 + 揭示祝福额外 1 个')
  assert.equal(state.locations.find(location => location.id === here.id).clues, 1, '地点线索共被取走 2 个')
  assert.equal(me(state).resources, 8, '支付 2 资源')
  assert.equal(blessings(state), 2, '揭示前加入 2 个祝福（揭示的那 1 个已归还标记池）')

  // 没有揭示祝福/旧印：只发现基础 1 个线索。
  const plain = fixture('01003')
  me(plain).assets = []
  me(plain).hand = ['10025']
  me(plain).resources = 10
  const room = plain.locations.find(location => location.id === me(plain).location)
  room.clues = 3
  room.shroud = 0
  plain.chaosBag = ['0', '-1', '+1']
  plain.debugNextTokens = ['0', '-1']
  move(plain, { action: 'play', cardId: '10025' })
  settle(plain, pending => pickId(pending, 'willpower'))
  assert.equal(me(plain).clues, 1, '未揭示祝福/旧印 → 不额外发现线索')
  assert.equal(plain.locations.find(location => location.id === room.id).clues, 2, '只取走 1 个线索')
})

// ── 10026 举起手来 ──────────────────────────────────────────────────────────
test('P6 10026 举起手来 谈判攻击不造成伤害；成功以 -成功点数费用打出手牌[[道具]]支援', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10026', '01020']
  me(state).resources = 10
  const foe = enemy(state, { fight: 1, health: 30, engagedSeat: null })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10026' })
  settle(state, pending => pickId(pending, '01020') ?? null)
  const machete = me(state).assets.find(card => card.code === '01020')
  assert.ok(machete, '成功后将所选[[道具]]支援打出')
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 0, '改为打出支援，不造成伤害')
  assert.equal(me(state).resources, 9, '事件 1 资源 + 砍刀费用 3 被成功点数 3 减免为 0')
  assert.equal(me(state).hand.includes('01020'), false, '打出的支援离开手牌')

  // 检定失败：不造成伤害、不打出支援。
  const fail = fixture('01001')
  me(fail).assets = []
  me(fail).hand = ['10026', '01020']
  me(fail).resources = 10
  const hard = enemy(fail, { fight: 8, health: 30, engagedSeat: null })
  fail.chaosBag = ['0']
  move(fail, { action: 'play', cardId: '10026' })
  settle(fail, pending => pickId(pending, '01020') ?? null)
  assert.equal(me(fail).hand.includes('01020'), true, '检定失败时支援留在手牌')
  assert.equal(me(fail).assets.some(card => card.code === '01020'), false)
  assert.equal(fail.enemies.find(item => item.id === hard.id).damageTaken, 0)

  // 打出条件：同地点没有敌人时不能打出。
  const blocked = fixture('01001')
  me(blocked).hand = ['10026', '01020']
  me(blocked).resources = 10
  assert.equal(legalMoves(blocked).some(option => option.action === 'play' && option.cardId === '10026'), false)
  assert.match(String(validateMove(blocked, 0, { action: 'play', cardId: '10026' })), /敌人/)
})

// ── 10027 特遣队 ────────────────────────────────────────────────────────────
test('P6 10027 特遣队 Double 额外花 1 行动；同地点调查员免行动费结算[action]能力、发现线索、移动', () => {
  assert.equal(playedActionCost('10027'), 1, 'Double：played 描述子声明额外行动费用')
  const state = fixture('01001', 2)
  me(state).assets = []
  me(state, 1).assets = []
  me(state).hand = ['10027']
  me(state).resources = 10
  me(state).actionsLeft = 4
  me(state, 1).actionsLeft = 0
  const here = state.locations.find(location => location.id === me(state).location)
  here.clues = 2
  here.connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 1, shroud: 1, connections: [here.id], revealed: true })
  const machete = asset(state, '01020', {}, 1)
  const foe = enemy(state, { fight: 0, health: 30, engagedSeat: 1 })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '10027' })
  assert.equal(me(state).actionsLeft, 2, '打出 1 行动 + Double 额外 1 行动')
  const order = ['ability', 'clue', 'move']
  let step = 0
  for (let index = 0; state.pendingChoice && index < 80; index++) {
    const pending = state.pendingChoice
    let choice = null
    if (pending.kind === 'effect' && /选择接下来/.test(String(pending.prompt))) choice = pickId(pending, order[step++])
    else if (pending.kind === 'investigator') choice = pickId(pending, '1')
    move(state, { action: 'choose', choiceId: pending.id, optionId: choice ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id)) ?? pending.options[0].id })
  }
  assert.equal(me(state, 1).actionsLeft, 0, '免行动费：0 行动点的调查员也能结算 [action] 能力')
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 2, '所选的 [action] 能力（砍刀攻击）真实结算')
  assert.equal(fresh(state, machete.id).exhausted, false)
  assert.equal(me(state, 1).clues, 1, '该调查员发现其所在地点的 1 个线索')
  assert.equal(state.locations.find(location => location.id === here.id).clues, 1, '地点线索从 2 减到 1')
  assert.equal(me(state, 1).location, 'attic', '该调查员移动到连接地点')
  assert.equal(me(state).resources, 8, '特遣队 2 资源')
  assert.equal(me(state).discard.includes('10027'), true)
})

// ── 10028 修修补补 ──────────────────────────────────────────────────────────
test('P6 10028 修修补补 快速附属于[[工具]]支援，宿主少占 1 个饰品槽位', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10028']
  me(state).resources = 10
  me(state).actionsLeft = 0
  const kit = asset(state, '10020')
  const accessoryProbe = { code: 'probe-accessory', type: 'asset', slots: ['Accessory'] }
  assert.equal(canEquip(me(state), accessoryProbe), false, '饰品槽已被清理工具套装占满')
  const option = legalMoves(state).find(row => row.action === 'play' && row.cardId === '10028')
  assert.ok(option, '快速事件在行动点用尽的空档期是直接打出行动')
  move(state, option)
  settle(state)
  const host = fresh(state, kit.id)
  assert.ok((host.attachments || []).some(card => card.code === '10028'), '修修补补附属到[[工具]]支援')
  assert.deepEqual(host.ignoredSlots, ['accessory'], '宿主少占 1 个饰品槽位')
  assert.equal(canEquip(me(state), accessoryProbe), true, '多出的饰品槽位可用于另一件饰品')
  assert.equal(me(state).resources, 9, '事件 1 资源')
  assert.equal(me(state).hand.includes('10028'), false, '事件已打出')
  assert.equal(me(state).discard.includes('10028'), false, 'keepOnPlay：事件留在宿主上')

  // 打出条件：没有[[工具]]支援时不能打出。
  const blocked = fixture('01001')
  me(blocked).assets = []
  me(blocked).hand = ['10028']
  me(blocked).resources = 10
  me(blocked).actionsLeft = 0
  assert.equal(legalMoves(blocked).some(row => row.action === 'play' && row.cardId === '10028'), false)
  assert.match(String(validateMove(blocked, 0, { action: 'play', cardId: '10028' })), /工具/)
})
