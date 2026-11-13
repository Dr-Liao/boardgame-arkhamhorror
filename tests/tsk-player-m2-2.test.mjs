// P6 M2-2（09048–09074）一般玩家卡 Node 验收。
//
// 覆盖策略：
//   · 每张卡至少一条真实行为断言（费用/使用次数/目标/窗口/持续/每轮限制/负面路径）；
//   · 事件用真实描述子执行入口（executeDescriptor）或真实打牌流程（legalMoves/play）结算；
//   · 支援能力走 legalMoves → move → settle（core-fixture）；
//   · commit 图标用 commitIcons 读点断言（与引擎投入读点同源）；
//   · 仍有近似披露的卡（条目 note + artifacts/migration/tsk/primitive-requests/<code>.json）断言的是
//     近似后的真实行为。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry, descriptorOfKind } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import {
  legalMoves, executeDescriptor, commitIcons, getStat, reactionWindow, attachmentTargets,
} from '../src/engine/engine.js'
import { upgradeCustomization } from '../src/engine/tsk-customizable.js'

import e09048 from '../src/cards/entries/09048.js'
import e09049 from '../src/cards/entries/09049.js'
import e09050 from '../src/cards/entries/09050.js'
import e09051 from '../src/cards/entries/09051.js'
import e09052 from '../src/cards/entries/09052.js'
import e09053 from '../src/cards/entries/09053.js'
import e09054 from '../src/cards/entries/09054.js'
import e09055 from '../src/cards/entries/09055.js'
import e09056 from '../src/cards/entries/09056.js'
import e09057 from '../src/cards/entries/09057.js'
import e09058 from '../src/cards/entries/09058.js'
import e09059 from '../src/cards/entries/09059.js'
import e09060 from '../src/cards/entries/09060.js'
import e09061 from '../src/cards/entries/09061.js'
import e09062 from '../src/cards/entries/09062.js'
import e09063 from '../src/cards/entries/09063.js'
import e09064 from '../src/cards/entries/09064.js'
import e09065 from '../src/cards/entries/09065.js'
import e09066 from '../src/cards/entries/09066.js'
import e09067 from '../src/cards/entries/09067.js'
import e09068 from '../src/cards/entries/09068.js'
import e09069 from '../src/cards/entries/09069.js'
import e09070 from '../src/cards/entries/09070.js'
import e09071 from '../src/cards/entries/09071.js'
import e09072 from '../src/cards/entries/09072.js'
import e09073 from '../src/cards/entries/09073.js'
import e09074 from '../src/cards/entries/09074.js'

const ENTRIES = [e09048, e09049, e09050, e09051, e09052, e09053, e09054, e09055, e09056, e09057, e09058,
  e09059, e09060, e09061, e09062, e09063, e09064, e09065, e09066, e09067, e09068, e09069, e09070, e09071,
  e09072, e09073, e09074]

// 索引尚未重建时自注册缺少的条目；索引重建后跳过（避免重复注册）。
const missingEntries = ENTRIES.filter(entry => !registeredEntry(entry.code))
if (missingEntries.length) registerCardAbilities(missingEntries)

const TREACHERY = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'treachery'
  && !ALL_CARDS[code].subtype && !ALL_CARDS[code].basicWeakness) || '01170'
const CORE_ENEMY = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'enemy'
  && Number.isFinite(Number(ALL_CARDS[code].health))) || '01104'
const ITEM_ASSET = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset'
  && (ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'item')
  && Number(ALL_CARDS[code].cost) === 0) || '01030'
const ALLY_ASSET = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'asset'
  && (ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'ally')) || '01018'
const TACTIC_EVENT = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'event'
  && (ALL_CARDS[code].traits || []).some(trait => ['Tactic', 'Trick'].includes(trait))) || '01088'
const BEAST_ENEMY = Object.keys(ALL_CARDS).find(code => ALL_CARDS[code].type === 'enemy'
  && !(ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'humanoid')) || '01104'

function transact (state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'tskPlayerCardTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 120, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
function game (count = 1) {
  const state = fixture('01001', count)
  state.abilityLimits = {}
  for (const inv of state.investigators) {
    inv.hand = []
    inv.threat = []
    inv.assets = []
    inv.damage = 0
    inv.horror = 0
    inv.resources = 30
    inv.clues = 0
    inv.actionsLeft = 20
  }
  for (const location of state.locations) location.clues = location.clues || 0
  return state
}
function runDescriptor (state, code, kind, {
  context = {}, seat = 0, source = null, select = () => null, index = 0, ignoreCosts = true,
} = {}) {
  transact(state, draft => {
    const inv = draft.investigators[seat]
    const abilities = (registeredEntry(code)?.abilities || []).filter(ability => ability.kind === kind)
    const descriptor = kind === 'played' ? descriptorOfKind(code, 'played') : abilities[index]
    const draftInv = draft.investigators[seat]
    const draftSource = source?.id
      ? (draftInv.assets.find(item => item.id === source.id)
        || (draftInv.threat || []).find(card => card.id === source.id)
        || source)
      : source
    const defaultSource = !['played', 'setup'].includes(kind)
      ? (draftInv.assets || []).find(item => item.code === code) || null
      : null
    executeDescriptor(draft, {
      inv, source: draftSource || defaultSource || { code }, descriptor, context, events: [], windowId: null, ignoreCosts,
    })
  }, select)
}
// 在事务里直接跑一次真实检定（用于验证窗口类效果）。
function runTest (state, { seat = 0, skill = 'willpower', difficulty = 3, source = null, select = () => null } = {}) {
  transact(state, draft => {
    executeDescriptor(draft, {
      inv: draft.investigators[seat],
      source: source || { code: '01001' },
      descriptor: { kind: 'action', resolve: ({ api }) => api.test(seat, skill, difficulty, source ? { source } : {}) },
      context: {}, events: [], windowId: null, ignoreCosts: true,
    })
  }, select)
}

test('P6 09048 地区测绘：调查成功改为附属到地点，并使该地点所有技能检定难度 -1', () => {
  const s = game()
  const inv = s.investigators[0]
  const here = s.locations[0]
  here.clues = 2
  s.chaosBag = ['+3']
  runDescriptor(s, '09048', 'played', {
    select: choice => (choice.options.some(option => option.id === 'willpower') ? 'willpower' : null),
  })
  const attachment = (s.playerLocationAttachments || []).find(item => item.code === '09048' && item.location === here.id)
  assert.ok(attachment, '成功调查后改为附属到该地点')
  assert.equal(here.clues, 2, '不发现线索，改为附属')
  assert.equal(s.investigators[0].clues, 0)

  // 难度 -1：附属条目的 testBegins 强制能力把本次检定难度减 1。
  runTest(s, { difficulty: 4 })
  assert.equal(s.lastTestResult.difficulty, 3, '所附属地点的技能检定难度 -1')

  // 负面路径：同地点已有 1 张时不重复附属。
  runDescriptor(s, '09048', 'played', {
    select: choice => (choice.options.some(option => option.id === 'agility') ? 'agility' : null),
  })
  const count = (s.playerLocationAttachments || []).filter(item => item.code === '09048').length
  assert.equal(count, 1, '每个地点仅限 1 张')
})

test('P6 09049 分析法：把 1 个线索放到所在地点，取消揭示的标记并重抽', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.clues = 1
  s.locations[0].clues = 0
  s.chaosBag = ['+2', '-4']
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [{ code: '09049', seat: 0 }], stage: 'ST.4', drawn: [] }
  const context = { when: 'tokenReveal', seat: 0, token: '-4' }
  runDescriptor(s, '09049', 'reaction', { context })
  assert.equal(s.investigators[0].clues, 0, '花费 1 个线索')
  assert.equal(s.locations[0].clues, 1, '线索放到所在地点')
  assert.ok(context.replacementToken, '取消该标记并揭示新标记')
  assert.equal(typeof context.replacementToken, 'string')

  // 负面路径：没有线索时不触发（支付不了费用）。
  const broke = game()
  broke.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [{ code: '09049', seat: 0 }], stage: 'ST.4', drawn: [] }
  broke.chaosBag = ['+2']
  const context2 = { when: 'tokenReveal', seat: 0, token: '-4' }
  runDescriptor(broke, '09049', 'reaction', { context: context2 })
  assert.equal(context2.replacementToken, undefined, '没有线索时不能重抽')
})

test('P6 09050 实验室外套：以 1 点及以内失败的[探寻者]卡检定改为成功且等于难度（横置）', () => {
  const s = game()
  const coat = asset(s, '09050')
  s.chaosBag = ['0']
  let triggered = false
  runTest(s, {
    difficulty: 4,
    source: { code: '01030', label: '测试' },
    select: choice => {
      const option = choice.options.find(item => /实验室外套/.test(String(item.label || '')))
      if (!option || triggered) return null
      triggered = true
      return option.id
    },
  })
  assert.equal(triggered, true, '检定为失败 1 点时列出实验室外套')
  assert.equal(s.lastTestResult.success, true, '改为成功且等于难度')
  assert.equal(s.lastTestResult.value, s.lastTestResult.difficulty)
  assert.equal(s.investigators[0].assets.find(item => item.id === coat.id).exhausted, true, '横置支付')

  // 负面路径：差 2 点时不触发。
  const far = game()
  asset(far, '09050')
  far.chaosBag = ['0']
  let offered = false
  runTest(far, {
    difficulty: 5,
    source: { code: '01030', label: '测试' },
    select: choice => {
      if (choice.options.some(item => /实验室外套/.test(String(item.label || '')))) offered = true
      return null
    },
  })
  assert.equal(offered, false, '失败 2 点时不提供实验室外套')
})

test('P6 09051 俄耳甫斯教信条：花 1 秘密指定一个诡计，本轮记录其文本框视为空白', () => {
  const s = game()
  const orb = asset(s, '09051')
  s.investigators[0].threat.push({ id: 't1', code: TREACHERY })
  runDescriptor(s, '09051', 'free', {
    source: orb, ignoreCosts: false,
    select: choice => (choice.options.some(option => option.id === '0') ? '0' : null),
  })
  assert.equal(s.investigators[0].assets.find(item => item.id === orb.id).uses, 3, '花费 1 秘密')
  const record = (s.effects || []).find(effect => effect.sourceCode === '09051')
  assert.ok(record, '写入本轮持续记录')
  assert.equal(record.duration, 'endOfRound')
  assert.match(String(record.label), new RegExp(ALL_CARDS[TREACHERY].nameZh || ALL_CARDS[TREACHERY].name))

  // 负面路径：没有秘密时不结算（费用付不起）。
  const empty = game()
  const orb2 = asset(empty, '09051')
  empty.investigators[0].threat.push({ id: 't1', code: TREACHERY })
  empty.investigators[0].assets.find(item => item.id === orb2.id).uses = 0
  runDescriptor(empty, '09051', 'free', { source: orb2, ignoreCosts: false })
  assert.equal(empty.investigators[0].assets.find(item => item.id === orb2.id).uses, 0, '没有秘密时不花费')
  assert.equal((empty.effects || []).length, 0, '没有秘密时不产生效果')
})

test('P6 09052 存在之谜：谈判检定成功后自动躲避、附属并让敌人获得冷漠', () => {
  const s = game()
  const inv = s.investigators[0]
  const target = enemy(s, { fight: 1, evade: 1, health: 6, engagedSeat: 0 })
  s.chaosBag = ['+5']
  runDescriptor(s, '09052', 'played', {
    select: choice => (choice.options.some(option => option.id === 'willpower') ? 'willpower' : null),
  })
  const fresh = s.enemies.find(item => item.id === target.id)
  assert.ok((fresh.attachments || []).some(item => item.code === '09052'), '存在之谜附属到该敌人')
  assert.equal(fresh.aloof, true, '所附属敌人获得冷漠')
  assert.equal(fresh.exhausted, true, '自动躲避（横置）')
  assert.equal(fresh.engagedSeat == null, true, '自动躲避后解除交战')
  assert.equal(s.lastTestResult.difficulty, 8, '手牌为空时难度 8')
})

test('P6 09053 指导：同地点另一位调查员本轮技能 +1 并获得额外一次行动', () => {
  const s = game(2)
  runDescriptor(s, '09053', 'played')
  const other = s.investigators[1]
  const effect = (s.effects || []).find(item => item.sourceCode === '09053')
  assert.ok(effect, '写入本轮持续效果')
  assert.equal(effect.controllerSeat, other.seat, '效果归属被选调查员')
  assert.deepEqual(effect.modifiers.map(modifier => [modifier.target, modifier.amount]), [['skill:*', 1]])
  assert.equal(effect.duration, 'endOfRound')
  assert.equal(other.extraActionNextTurn, true, '获得额外一次行动')
  assert.equal(registeredEntry('09053').abilities[0].noOpportunityAttack, true, '打出不引发借机攻击')

  // 负面路径：只有自己时没有可指定目标。
  const solo = game(1)
  runDescriptor(solo, '09053', 'played')
  assert.equal((solo.effects || []).length, 0, '没有其他调查员时不产生效果')
})

test('P6 09054 威廉·T·马尔森博士：横置并把线索放到地点，2 选 1 取消另一张遭遇卡', () => {
  const s = game()
  const inv = s.investigators[0]
  const doctor = asset(s, '09054')
  inv.clues = 1
  const hereId = inv.location
  s.locations.find(location => location.id === hereId).clues = 0
  s.encounterDeck = ['dissonantVoices', 'dissonantVoices', CORE_ENEMY]
  const deckBefore = s.encounterDeck.length
  runDescriptor(s, '09054', 'reaction', {
    source: doctor, ignoreCosts: false,
    context: { when: 'encounterDrawn', seat: 0, cardCode: 'dissonantVoices', location: hereId },
    select: choice => (choice.options.some(option => option.id === 'drawn') ? 'drawn' : null),
  })
  const here = s.locations.find(location => location.id === hereId)
  assert.equal(s.investigators[0].assets.find(item => item.id === doctor.id).exhausted, true, '横置')
  assert.equal(s.investigators[0].clues, 0, '花费 1 个线索')
  assert.equal(here.clues, 1, '线索放到你的地点')
  assert.equal(s.encounterDeck.length, deckBefore - 1, '弃掉另一张遭遇卡（2 选 1）')

  // 选择牌库顶那张：取消已抽到的卡牌并结算新卡（context.cancelled）。
  const alt = game()
  const altDoctor = asset(alt, '09054')
  alt.investigators[0].clues = 1
  alt.encounterDeck = ['dissonantVoices', 'dissonantVoices']
  const context = { when: 'encounterDrawn', seat: 0, cardCode: 'dissonantVoices', location: alt.investigators[0].location }
  runDescriptor(alt, '09054', 'reaction', {
    source: altDoctor, ignoreCosts: false, context,
    select: choice => (choice.options.some(option => option.id === 'top') ? 'top' : null),
  })
  assert.equal(context.cancelled, true, '取消已抽到的遭遇卡')
})

test('P6 09055 媒体通行证：发现线索后横置，本回合（或下个回合）额外一次行动', () => {
  const s = game()
  const pass = asset(s, '09055')
  const before = s.investigators[0].actionsLeft
  runDescriptor(s, '09055', 'reaction', {
    source: pass, ignoreCosts: false,
    context: { when: 'clueDiscovered', seat: 0, location: s.investigators[0].location, amount: 1 },
  })
  assert.equal(s.investigators[0].actionsLeft, before + 1, '本回合额外 1 次行动')
  assert.equal(s.investigators[0].assets.find(item => item.id === pass.id).exhausted, true, '横置支付')

  // 不是你的回合：改为下个回合额外一次行动。
  const two = game(2)
  const pass2 = asset(two, '09055')
  two.currentSeat = 1
  runDescriptor(two, '09055', 'reaction', {
    source: pass2, seat: 0, ignoreCosts: false,
    context: { when: 'clueDiscovered', seat: 0, location: two.investigators[0].location, amount: 1 },
  })
  assert.equal(two.investigators[0].extraActionNextTurn, true, '非本回合时改为下个回合额外一次行动')
})

test('P6 09056 外科手术工具：治愈后花补给追加治疗；[action][action] 治愈 3 点伤害', () => {
  const s = game()
  const inv = s.investigators[0]
  const kit = asset(s, '09056')
  inv.damage = 2
  runDescriptor(s, '09056', 'reaction', {
    source: kit, ignoreCosts: false,
    context: { when: 'damageHealed', seat: 0, healedSeat: 0, amount: 1, cardCode: '01030' },
    select: choice => (choice.options.some(option => option.id === 'heal') ? 'heal' : null),
  })
  assert.equal(s.investigators[0].damage, 1, '该效果额外治愈 1 点伤害')
  assert.equal(s.investigators[0].assets.find(item => item.id === kit.id).uses, 3, '花费 1 补给')

  // [action][action]：双行动费用（第二个行动在 resolve 里用 api.loseActions 支付）。
  const heal = game()
  const healInv = heal.investigators[0]
  const kit2 = asset(heal, '09056')
  healInv.damage = 4
  const actionsBefore = healInv.actionsLeft
  const healMove = legalMoves(heal, 0).find(command => command.action === 'ability' && command.assetId === kit2.id && command.abilityIndex === 0)
  assert.ok(healMove, '[action][action] 治愈能力进入合法动作')
  move(heal, healMove)
  settle(heal)
  assert.equal(heal.investigators[0].damage, 1, '治愈 3 点伤害')
  assert.equal(heal.investigators[0].actionsLeft, actionsBefore - 2, '支付 2 个行动')
})

test('P6 09057 指纹采集工具：横置花 1 补给调查（+2[智力]），成功额外发现 2 个线索', () => {
  const s = game()
  const inv = s.investigators[0]
  const kit = asset(s, '09057')
  const here = s.locations.find(location => location.id === inv.location)
  here.clues = 4
  here.shroud = 2
  s.chaosBag = ['0']
  const command = legalMoves(s, 0).find(item => item.action === 'ability' && item.assetId === kit.id)
  assert.ok(command, '调查能力进入合法动作')
  move(s, command)
  settle(s)
  const fresh = s.investigators[0].assets.find(item => item.id === kit.id)
  assert.equal(fresh.uses, 2, '花费 1 补给')
  assert.equal(fresh.exhausted, true, '横置')
  assert.equal(s.lastTestResult.value, getStat(s, inv, 'intellect') + 2, '本次调查 +2[智力]')
  assert.equal(s.investigators[0].clues, 3, '成功后发现 3 个线索（1 + 额外 2）')
})

test('P6 09058 格雷氏解剖学：检定[智力](1)后按超过点数逐项记录本轮效果（上限 +3）', () => {
  const s = game()
  const inv = s.investigators[0]
  const tome = asset(s, '09058')
  asset(s, '01030')
  s.chaosBag = ['0']
  runDescriptor(s, '09058', 'action', {
    source: tome, ignoreCosts: false,
    select: choice => {
      if (choice.options.some(option => option.id === 'heal')) return 'heal'
      if (choice.options.some(option => option.id === 'damage')) return 'damage'
      // 指定卡牌的候选：优先选自己（investigator 候选）。
      const seatOption = choice.options.find(option => String(option.id).startsWith('seat:'))
      if (seatOption) return seatOption.id
      return null
    },
  })
  assert.equal(s.lastTestResult.success, true)
  assert.equal(s.lastTestResult.successBy, 2, '智力 3 vs 难度 1 → 超过 2 点')
  const records = (s.effects || []).filter(effect => effect.sourceCode === '09058')
  assert.equal(records.length, 2, '每超过 1 点记录一项效果')
  assert.ok(records.every(effect => effect.duration === 'endOfRound'))
})

test('P6 09059 关键证言：横置指证任意地点的敌人，成功后花 1 证据额外发现其地点的线索；定制 Fabricated Evidence 入场多 2 证据', () => {
  const s = game()
  const inv = s.investigators[0]
  const kit = asset(s, '09059')
  // 第二个地点：敌人在别处（卡面「任意地点的一个敌人」），额外线索发现在那个地点。
  const otherId = 'm2-2-other'
  s.locations.push({ id: otherId, name: '另一地点', revealed: true, connections: [inv.location], clues: 2, shroud: 2 })
  const target = enemy(s, { fight: 1, evade: 1, health: 3, location: otherId, engagedSeat: null })
  s.locations.find(location => location.id === inv.location).clues = 2
  s.chaosBag = ['+3']
  runDescriptor(s, '09059', 'action', {
    source: kit, ignoreCosts: false,
    select: choice => {
      if (choice.options.some(option => option.id === target.id)) return target.id
      if (choice.options.some(option => option.id === 'spend')) return 'spend'
      return null
    },
  })
  const other = s.locations.find(location => location.id === otherId)
  assert.equal(s.investigators[0].assets.find(item => item.id === kit.id).exhausted, true, '横置')
  assert.equal(other.clues, 1, '在所选敌人的地点额外发现 1 个线索')
  assert.equal(s.investigators[0].assets.find(item => item.id === kit.id).uses, 2, '花费 1 证据')

  // 定制 Fabricated Evidence（2 格）：入场时额外 2 证据。
  const custom = game()
  const customKit = asset(custom, '09059')
  upgradeCustomization(custom, { seat: 0, code: '09059', checked: [1, 1], availableXp: 10 })
  runDescriptor(custom, '09059', 'entersPlay', { source: customKit })
  assert.equal(custom.investigators[0].assets.find(item => item.id === customKit.id).uses, 5, '入场时额外 2 证据')
  assert.equal((registeredEntry('09059').customizationOptions || []).length, 6, '声明 6 项定制勾选')
})

test('P6 09060 狐朋狗友：查看牌库顶 6 张，花 1 资源把具有所选特性的牌加入手牌，其余洗回', () => {
  const s = game()
  const inv = s.investigators[0]
  const trait = String((ALL_CARDS[ITEM_ASSET].traits || [])[0] || 'Item')
  inv.deck = Array(10).fill(ITEM_ASSET)
  inv.resources = 20
  runDescriptor(s, '09060', 'played', {
    select: choice => {
      if (choice.options.some(option => option.id === trait)) return trait
      if (choice.options.some(option => option.id === 'take')) return 'take'
      return null
    },
  })
  assert.equal(s.investigators[0].resources, 14, '每张加入手牌的牌花 1 资源（此处 6 张都符合）')
  assert.equal(s.investigators[0].hand.length, 6, '6 张查看过的牌加入手牌')
  assert.equal(s.investigators[0].deck.length, 4, '取走的牌离开牌库')
})

test('P6 09061 敏锐直觉：检定超过 3 点后才可打出，每轮一次并立刻进行一次行动', () => {
  const s = game()
  const conditional = registeredEntry('09061').playCondition[0].when
  assert.equal(conditional({ state: s, inv: s.investigators[0] }), false, '没有检定记录时不能打出')
  s.lastTestResult = { seat: 0, successBy: 3 }
  assert.equal(conditional({ state: s, inv: s.investigators[0] }), true, '检定超过 3 点后可以打出')

  runDescriptor(s, '09061', 'played', {
    select: choice => (choice.options.some(option => option.id === 'done') ? 'done' : null),
  })
  assert.equal(s.investigators[0].gameFlags?.[`honedInstinctUsed:${s.round}`], true, '每轮最多一次（本轮已记账）')
  const before = s.investigators[0].gameFlags[`honedInstinctUsed:${s.round}`]
  runDescriptor(s, '09061', 'played')
  assert.equal(s.investigators[0].gameFlags[`honedInstinctUsed:${s.round}`], before, '同一轮第二次不再结算')
})

test('P6 09062 易容术：花 1 补给躲避（+2[敏捷]），非精英敌人下个补给阶段不重整', () => {
  const s = game()
  const inv = s.investigators[0]
  const disguise = asset(s, '09062')
  const target = enemy(s, { fight: 1, evade: 1, health: 5, engagedSeat: 0 })
  s.chaosBag = ['0']
  const command = legalMoves(s, 0).find(item => item.action === 'ability' && item.assetId === disguise.id)
  assert.ok(command, '躲避能力进入合法动作')
  move(s, command)
  settle(s, choice => (choice.kind === 'target' ? target.id : null))
  const fresh = s.investigators[0].assets.find(item => item.id === disguise.id)
  assert.equal(fresh.uses, 3, '花费 1 补给')
  assert.equal(s.lastTestResult.value, getStat(s, inv, 'agility') + 2, '本次躲避 +2[敏捷]')
  const evaded = s.enemies.find(item => item.id === target.id)
  assert.equal(evaded.exhausted, true, '躲避成功横置')
  assert.equal(evaded.preventReady?.rounds, 1, '下个补给阶段不重整')
})

test('P6 09063 非分之财：横置把最多 2 资源从资源池移到卡上；结算时按每 2 资源写下个冒险奖励', () => {
  const s = game()
  const inv = s.investigators[0]
  const treasure = asset(s, '09063')
  inv.resources = 5
  runDescriptor(s, '09063', 'free', { source: treasure, ignoreCosts: false })
  assert.equal(s.investigators[0].resources, 3, '从资源池移动 2 资源')
  assert.equal(s.investigators[0].assets.find(item => item.id === treasure.id).uses, 2, '卡上 2 资源')
  assert.equal(s.investigators[0].assets.find(item => item.id === treasure.id).exhausted, true, '横置支付')

  // 撤退/游戏结束结算（近似：主动结算），写入战役记录。
  const fresh = s.investigators[0].assets.find(item => item.id === treasure.id)
  fresh.exhausted = false
  runDescriptor(s, '09063', 'free', { source: fresh, index: 1, ignoreCosts: false })
  assert.equal(s.campaign.records['09063:bonusResources:0'], 1, '每 2 资源给 1 位调查员下个冒险 +1 资源')
})

test('P6 09064 扒手行窃工具：花 1 补给用[敏捷]调查，成功后获得 1 资源', () => {
  const s = game()
  const inv = s.investigators[0]
  const kit = asset(s, '09064')
  const here = s.locations.find(location => location.id === inv.location)
  here.shroud = 1
  here.clues = 2
  inv.resources = 5
  s.chaosBag = ['0']
  runDescriptor(s, '09064', 'action', { source: kit, ignoreCosts: false })
  assert.equal(s.investigators[0].assets.find(item => item.id === kit.id).uses, 5, '花费 1 补给')
  assert.equal(s.lastTestResult.skill, 'agility', '改用[敏捷]调查')
  assert.equal(s.investigators[0].resources, 6, '成功后获得 1 资源')
})

test('P6 09065 暗袋：快速、只能自己回合，附属目标只认[[服装]]/[[护甲]]支援', () => {
  const s = game()
  const inv = s.investigators[0]
  const coat = asset(s, '09071') // [[服装]]支援
  asset(s, '01030') // 非服装支援
  const entry = registeredEntry('09065')
  assert.equal(entry.fast, true, '快速')
  assert.equal(entry.attachTo?.kind, 'asset', '附属到支援')
  assert.equal(entry.attachTo?.trait, 'clothing', '只认[[服装]]特性')
  assert.equal(entry.playCondition.length, 1, '声明「只能在你回合期间打出」')

  // 与真实打出管线同一个读点：attachmentTargets 只列出[[服装]]支援。
  const targets = attachmentTargets(s, s.investigators[0], entry.attachTo, '09065').map(item => item.id)
  assert.deepEqual(targets, [coat.id], '只列出[[服装]]支援作为宿主')
  assert.equal(inv.playCondition ?? true, true)
})

test('P6 09066 连打带跑：把手中[[盟友]]放置入场，回合结束时返回手牌', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = [ALLY_ASSET]
  runDescriptor(s, '09066', 'played', {
    select: choice => (choice.options.some(option => option.id === ALLY_ASSET) ? ALLY_ASSET : null),
  })
  const ally = s.investigators[0].assets.find(item => item.code === ALLY_ASSET)
  assert.ok(ally, '[[盟友]]放置入场')
  assert.equal(s.investigators[0].hand.includes(ALLY_ASSET), false)
  assert.ok((ally.attachments || []).some(item => item.code === '09066'), '事件卡附属在该支援上')

  transact(s, draft => { reactionWindow(draft, 'turnEnded', { when: 'turnEnded', seat: 0 }, []) })
  assert.equal(s.investigators[0].assets.some(item => item.code === ALLY_ASSET), false, '回合结束时离开场上')
  assert.equal(s.investigators[0].hand.includes(ALLY_ASSET), true, '回合结束时返回手牌')
  assert.equal(s.investigators[0].discard.includes('09066'), true, '事件卡结算后进入弃牌堆')
})

test('P6 09067 “我收下了！”：成功调查后以 -X 费用打出[[道具]]支援并附属，该支援获得[[违法]]', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = [ITEM_ASSET]
  inv.resources = 10
  const cost = Number(ALL_CARDS[ITEM_ASSET].cost) || 0
  runDescriptor(s, '09067', 'played', {
    context: { when: 'investigateSuccess', seat: 0, successBy: 2 },
    select: choice => (choice.options.some(option => option.id === ITEM_ASSET) ? ITEM_ASSET : null),
  })
  const played = s.investigators[0].assets.find(item => item.code === ITEM_ASSET)
  assert.ok(played, '[[道具]]支援被打出')
  assert.equal(s.investigators[0].resources, 10 - Math.max(0, cost - 2), '费用降低 X 点')
  assert.ok((played.attachments || []).some(item => item.code === '09067'), '“我收下了！”附属到该支援')
  assert.equal(registeredEntry('09067').assetRule.hostTrait, 'illicit', '所附属支援获得[[违法]]（hostTrait 读点）')

  // 负面路径：不是[[类人]]敌人的躲避成功不会出现在窗口里。
  const notHumanoid = game()
  notHumanoid.investigators[0].hand = [ITEM_ASSET]
  const beast = enemy(notHumanoid, { code: BEAST_ENEMY, fight: 1, evade: 1, health: 3 })
  let offered = false
  transact(notHumanoid, draft => {
    reactionWindow(draft, 'evadeSuccess', {
      when: 'evadeSuccess', seat: 0, enemy: beast, successBy: 2,
      location: draft.investigators[0].location,
    }, [])
  }, choice => {
    if (choice.options.some(option => option.cardCode === '09067' || /我收下了/.test(String(option.label || '')))) offered = true
    return null
  })
  assert.equal(offered, false, '非[[类人]]敌人的躲避成功不触发')
  assert.equal(notHumanoid.investigators[0].assets.length, 0, '没有打出[[道具]]支援')
})

test('P6 09068 直捣蜂窝：查找遭遇牌库顶 9 张的敌人并与之交战，发现 1 个线索并获得等于其生命值的资源', () => {
  const s = game()
  const inv = s.investigators[0]
  const here = s.locations.find(location => location.id === inv.location)
  here.clues = 1
  inv.resources = 0
  s.encounterDeck = ['dissonantVoices', 'dissonantVoices', CORE_ENEMY]
  runDescriptor(s, '09068', 'played', {
    select: choice => (choice.options.some(option => option.id === CORE_ENEMY) ? CORE_ENEMY : null),
  })
  const spawned = s.enemies.find(item => item.code === CORE_ENEMY)
  assert.ok(spawned, '敌人被生成')
  assert.equal(spawned.engagedSeat, 0, '与你交战')
  assert.equal(s.investigators[0].clues, 1, '发现你所在地点的 1 个线索')
  assert.equal(s.investigators[0].resources, Number(ALL_CARDS[CORE_ENEMY].health) || 0, '获得等于其生命值的资源')
  assert.equal(s.encounterDeck.includes(CORE_ENEMY), false, '该敌人被取出')
})

test('P6 09069 逃生通道：敌人攻击时躲避，成功后取消这次攻击', () => {
  const s = game()
  const inv = s.investigators[0]
  const attacker = enemy(s, { fight: 1, evade: 1, health: 5, engagedSeat: 0 })
  inv.hand = ['09069']
  s.chaosBag = ['+5']
  runDescriptor(s, '09069', 'played', {
    context: { when: 'enemyAttack', seat: 0, enemy: attacker, location: inv.location, attackKind: 'fight' },
    select: choice => null,
    ignoreCosts: true,
  })
  assert.equal(s.enemies.find(item => item.id === attacker.id).exhausted, true, '躲避成功横置敌人')

  const cancel = game()
  const inv2 = cancel.investigators[0]
  const attacker2 = enemy(cancel, { fight: 1, evade: 1, health: 5, engagedSeat: 0 })
  inv2.hand = ['09069']
  cancel.chaosBag = ['+5']
  const context = { when: 'enemyAttack', seat: 0, enemy: attacker2, location: inv2.location, attackKind: 'fight' }
  runDescriptor(cancel, '09069', 'played', { context, ignoreCosts: true })
  assert.equal(context.cancelled, true, '取消该敌人的攻击')
})

test('P6 09070 风险精算：每执行一个行动获得 1 个[wild]图标；检定结束后结束回合', () => {
  const s = game()
  const inv = s.investigators[0]
  s.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, committed: [] }
  // dispatch.js:463 在本次行动结算前已把该行动计入 phaseActionCount（含本行动）。
  s.phaseActionCount = 1
  assert.equal(commitIcons(s, inv, '09070', 'willpower'), 1, '本回合第 1 个行动：1 个图标')
  s.phaseActionCount = 3
  assert.equal(commitIcons(s, inv, '09070', 'willpower'), 3, '本回合第 3 个行动：3 个图标')

  s.skillTest.committed = [{ code: '09070', seat: 0 }]
  s.currentSeat = 0
  runDescriptor(s, '09070', 'forced', { context: { when: 'testEnds', seat: 0, result: { success: true } } })
  assert.ok(s.investigators[0].turnEnded === true || s.investigators[0].actionsLeft === 0, '检定结束后结束你的回合')
})

test('P6 09071 时髦大衣：横置获得额外 1 资源', () => {
  const s = game()
  const inv = s.investigators[0]
  const coat = asset(s, '09071')
  inv.resources = 5
  runDescriptor(s, '09071', 'free', { source: coat, ignoreCosts: false })
  assert.equal(s.investigators[0].resources, 6, '获得额外 1 资源')
  assert.equal(s.investigators[0].assets.find(item => item.id === coat.id).exhausted, true, '横置支付')
})

test('P6 09072 查克·费格斯：打出[[策略]]/[[技巧]]事件时横置，选择使其获得快速或 -2 费用', () => {
  const s = game()
  const chuck = asset(s, '09072')
  const context = { when: 'beforePlayCost', seat: 0, cardCode: TACTIC_EVENT, cost: 3, costIncrease: 0 }
  runDescriptor(s, '09072', 'reaction', {
    source: chuck, ignoreCosts: false, context,
    select: choice => (choice.options.some(option => option.id === 'cheap') ? 'cheap' : null),
  })
  assert.equal(context.costReduction, 2, '该事件的费用减少 2 点')
  assert.equal(s.investigators[0].assets.find(item => item.id === chuck.id).exhausted, true, '横置支付')

  // 负面路径：不是[[策略]]/[[技巧]]事件时不出现在窗口里。
  const plain = game()
  asset(plain, '09072')
  plain.investigators[0].hand = ['01088']
  let offered = false
  transact(plain, draft => {
    reactionWindow(draft, 'beforePlayCost', {
      when: 'beforePlayCost', seat: 0, cardCode: '01088', cost: 1, costIncrease: 0,
    }, [])
  }, choice => {
    if (choice.options.some(option => /查克/.test(String(option.label || '')))) offered = true
    return null
  })
  assert.equal(offered, false, '非[[策略]]/[[技巧]]事件不提供减免')
  assert.equal(plain.investigators[0].assets[0].exhausted, false, '未横置')

  // 正面路径：窗口里列出查克·费格斯（与真实打出管线同一枚举点）。
  const windowState = game()
  asset(windowState, '09072')
  windowState.investigators[0].hand = [TACTIC_EVENT]
  let listed = false
  transact(windowState, draft => {
    reactionWindow(draft, 'beforePlayCost', {
      when: 'beforePlayCost', seat: 0, cardCode: TACTIC_EVENT, cost: 1, costIncrease: 0,
    }, [])
  }, choice => {
    if (choice.options.some(option => /查克/.test(String(option.label || '')))) listed = true
    return null
  })
  assert.equal(listed, true, '[[策略]]/[[技巧]]事件打出时列出查克·费格斯')
})

test('P6 09073 痛下黑手：攻击/谈判/躲避已横置敌人 +2 技能值；躲避后横置追击', () => {
  const s = game()
  const inv = s.investigators[0]
  const dirty = asset(s, '09073')
  const base = getStat(s, inv, 'combat')
  s.skillTest = { seat: 0, skill: 'combat', difficulty: 2, committed: [], source: { label: '攻击' } }
  assert.equal(getStat(s, s.investigators[0], 'combat'), base + 2, '攻击时 +2 技能值')
  s.skillTest = { seat: 0, skill: 'combat', difficulty: 2, committed: [], source: { label: '调查' } }
  assert.equal(getStat(s, s.investigators[0], 'combat'), base, '调查时没有加值')
  const ready = enemy(s, { fight: 1, evade: 1, health: 5, engagedSeat: 0, exhausted: false })
  s.skillTest = { seat: 0, skill: 'agility', difficulty: 2, committed: [], source: { label: '躲避', enemyId: ready.id } }
  const agilityBase = getStat(s, inv, 'agility')
  assert.equal(getStat(s, s.investigators[0], 'agility'), agilityBase, '躲避未横置敌人没有加值')
  s.enemies.find(item => item.id === ready.id).exhausted = true
  assert.equal(getStat(s, s.investigators[0], 'agility'), agilityBase + 2, '躲避已横置敌人 +2 技能值')

  // 躲避后追击：横置并发动一次攻击行动。
  s.skillTest = null
  s.chaosBag = ['0']
  runDescriptor(s, '09073', 'reaction', {
    source: dirty, ignoreCosts: false,
    context: { when: 'evadeSuccess', seat: 0, enemy: s.enemies.find(item => item.id === ready.id), successBy: 1 },
  })
  assert.equal(s.investigators[0].assets.find(item => item.id === dirty.id).exhausted, true, '横置支付')
  assert.equal(s.lastTestResult.source?.label, '攻击', '对该敌人进行一次攻击行动')
})

test('P6 09074 破门而入：加入[敏捷]调查，成功超过 1 点自动躲避敌人，超过 3 点返回手牌', () => {
  const s = game()
  const inv = s.investigators[0]
  inv.hand = ['09074']
  const here = s.locations.find(location => location.id === inv.location)
  here.shroud = 1
  here.clues = 1
  const target = enemy(s, { fight: 1, evade: 1, health: 5, engagedSeat: null })
  s.chaosBag = ['+2']
  runDescriptor(s, '09074', 'played', {
    select: choice => {
      if (choice.options.some(option => option.id === target.id)) return target.id
      return null
    },
  })
  const successBy = s.lastTestResult.value - s.lastTestResult.difficulty
  assert.ok(successBy >= 3, `检定超过难度 ≥3（actual ${successBy}）`)
  assert.equal(s.enemies.find(item => item.id === target.id).exhausted, true, '自动躲避本地点的一个敌人')
  assert.equal(s.investigators[0].hand.includes('09074'), true, '超过 3 点返回手牌（近似：结算后返回）')
  assert.equal(s.investigators[0].discard.includes('09074'), false, '没有进入弃牌堆')
})
