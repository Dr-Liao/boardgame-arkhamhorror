// 《盛宴》P6 M2-8 分片逐卡验收（10089–10098 共 10 张）。
//
// 约定（与 tests/tsk-player-m2-4.test.mjs / tests/eote-player-m2-4.test.mjs 相同）：
//   · 直接 import 单卡条目 + registerCardAbilities，不依赖 entries/index.js（索引由主进程重建）；
//   · 每次 move/applyMove 后引擎可能替换调查员对象，断言前重新从 state 读取；
//   · 本阶段条目尚未进 entries/index.js，事件卡不能走真实 play 入口（runtimeCardAvailable=false），
//     因此 played 描述子用 executeDescriptor 执行；支援/技能卡走真实 ability / performTest 管线；
//   · 缺读点的卡在对应单卡文件 note + artifacts/migration/fhv/primitive-requests/<code>.json 披露。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, decisionSeat } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry, playedActionCost } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { executeDescriptor, getStat, performTest, reactionWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'

import entry10089 from '../src/cards/entries/10089.js'
import entry10090 from '../src/cards/entries/10090.js'
import entry10091 from '../src/cards/entries/10091.js'
import entry10092 from '../src/cards/entries/10092.js'
import entry10093 from '../src/cards/entries/10093.js'
import entry10094 from '../src/cards/entries/10094.js'
import entry10095 from '../src/cards/entries/10095.js'
import entry10096 from '../src/cards/entries/10096.js'
import entry10097 from '../src/cards/entries/10097.js'
import entry10098 from '../src/cards/entries/10098.js'

const ENTRIES = [entry10089, entry10090, entry10091, entry10092, entry10093,
  entry10094, entry10095, entry10096, entry10097, entry10098]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const CODES = ENTRIES.map(entry => entry.code)
const ROT_CODES = ['10086', '10087', '10088', '10089', '10090']

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 与 tests/tsk-player-m2-4.test.mjs 相同的三段式：一次真实事务里执行能力/检定描述子，
// 之后逐个回答残留的待决选择（每次回答沿用同一个 execute，让被中断的结算继续）。
function runTest(state, execute, choose = () => null, limit = 200) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = (typeof choose === 'function' ? choose(pending) : null)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 真实行动/能力结算里残留的待决选择（支援能力走 legalMoves → applyMove，被中断的结算由 choose 继续）。
function resolveChoices(state, choose = () => null, limit = 120) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

function runDescriptor(state, code, kind, { context = {}, choose = null, source = null } = {}) {
  const descriptor = registeredEntry(code)?.abilities?.find(ability => ability.kind === kind)
  assert.ok(descriptor, `${code} 缺少 ${kind} 描述符`)
  runTest(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0],
    source: source || { id: `probe:${code}`, code },
    descriptor, events: [], context, silent: false,
  }), choose)
  return descriptor
}

// 用真实能力面执行一段 api 调用（与 tests/fhv-primitives.test.mjs 的 viaAbilityApi 相同）。
function viaAbilityApi(state, resolve) {
  let output
  const inv = state.investigators[0]
  executeDescriptor(state, { inv, events: [], silent: true, alreadyPaid: true,
    descriptor: { kind: 'free', code: inv.code, cost: {}, resolve: ({ api }) => { output = resolve(api) } } })
  return output
}

// 同上，但在事务的 draft 上执行（会开反应窗口的结算必须走事务）。
function viaDraftApi(draft, resolve) {
  let output
  const inv = draft.investigators[0]
  executeDescriptor(draft, { inv, events: [], silent: true, alreadyPaid: true,
    descriptor: { kind: 'free', code: inv.code, cost: {}, resolve: ({ api }) => { output = resolve(api) } } })
  return output
}

const pickOption = pattern => pending => {
  const option = pending.options.find(item => pattern.test(String(item.label || '')))
  return option ? option.id : null
}

const pickCardCode = code => pending => {
  const option = pending.options.find(item => item.cardCode === code || item.id === code)
  return option ? option.id : null
}

const isRotCode = code => ROT_CODES.includes(String(code))
const hasRotTrait = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'rot')

// ---------------------------------------------------------------------------
// 10089 / 10090 / 10098：卡纳玛戈斯之杖 + 绑定[[腐烂]]事件
// ---------------------------------------------------------------------------

test('P6 10098 卡纳玛戈斯之杖：每揭示 1 个诅咒就查找并附魔一张[[腐烂]]事件；无诅咒不附属', () => {
  const state = fixture('01001')
  const rod = asset(state, '10098')
  const foe = enemy(state, { health: 20, engagedSeat: null })
  state.chaosBag = ['curse', 'curse', '0', '0', '0']

  move(state, { action: 'ability', assetId: rod.id, abilityIndex: 0 })
  // 每次「查找一张腐烂事件并附属」都选第一个可选的腐烂事件；其余选择走默认项。
  resolveChoices(state, pending => pending.options.find(option => isRotCode(option.cardCode))?.id ?? null)
  const after = state.enemies.find(item => item.id === foe.id)
  assert.equal(after.attachments.length, 2, '两个诅咒标记 → 附属 2 张腐烂事件')
  for (const attachment of after.attachments) {
    assert.ok(isRotCode(attachment.code), `附属的是[[腐烂]]事件：${attachment.code}`)
    assert.equal(hasRotTrait(attachment.code), true, `${attachment.code} 带 Rot 特性`)
  }
  // 非检定揭示不消耗祝福/诅咒：5 个标记原样放回混乱袋。
  assert.equal(state.chaosBag.length, 5)
  assert.equal(state.chaosBag.filter(token => token === 'curse').length, 2)
  assert.equal(state.investigators[0].assets.find(item => item.id === rod.id).exhausted, true, '法杖横置')
  // 取出的两份副本离开场外绑定集合（两张杖共用 10085 这个 canonical 集合键）。
  const set = state.bondedSets?.['10085']
  assert.ok(set, '场外绑定集合已建立')
  assert.equal(set.cards.length, 3, '5 张腐烂里 2 张已被取出')
  for (const attachment of after.attachments) assert.equal(set.cards.includes(attachment.code), false)

  // 负面路径：没有诅咒标记时不查找、不附属。
  const clean = fixture('01001')
  const cleanRod = asset(clean, '10098')
  const cleanFoe = enemy(clean, { health: 20, engagedSeat: null })
  clean.chaosBag = ['0', '0', '0', '0', '0']
  move(clean, { action: 'ability', assetId: cleanRod.id, abilityIndex: 0 })
  resolveChoices(clean)
  assert.deepEqual(clean.enemies.find(item => item.id === cleanFoe.id).attachments || [], [])
})

test('P6 10089 猩红腐烂：被法杖附属后，每轮结束对所附属敌人造成 1 点伤害', () => {
  const state = fixture('01001')
  const rod = asset(state, '10098')
  const foe = enemy(state, { health: 20, engagedSeat: null })
  state.chaosBag = ['curse', '0', '0', '0', '0']

  move(state, { action: 'ability', assetId: rod.id, abilityIndex: 0 })
  resolveChoices(state, pickCardCode('10089'))
  const attached = state.enemies.find(item => item.id === foe.id).attachments || []
  assert.deepEqual(attached.map(item => item.code), ['10089'], '猩红腐烂附属到该敌人')
  assert.deepEqual(registeredEntry('10089').treacheryRule.rotRule, { roundEndDamage: 1 })

  const before = state.enemies.find(item => item.id === foe.id).damageTaken || 0
  runTest(state, draft => { reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []) })
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, before + 1, '轮末造成 1 点伤害')

  // 下一轮仍然生效（不是一次性的「本轮轮末」效果）。
  state.round += 1
  runTest(state, draft => { reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []) })
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, before + 2, '第二轮轮末再造成 1 点')
})

test('P6 10090 霉绿腐烂：被法杖附属到敌人；被击败时放到一边（场外绑定集合）', () => {
  const state = fixture('01001')
  const rod = asset(state, '10098')
  const foe = enemy(state, { health: 3, engagedSeat: null })
  state.chaosBag = ['curse', 'curse', '0', '0', '0']

  move(state, { action: 'ability', assetId: rod.id, abilityIndex: 0 })
  resolveChoices(state, pickCardCode('10090'))
  const after = state.enemies.find(item => item.id === foe.id)
  assert.deepEqual(after.attachments.map(item => item.code), ['10090'], '霉绿腐烂附属到该敌人')
  assert.equal(hasRotTrait('10090'), true)
  assert.equal(registeredEntry('10090').zoneReplacement.discard, 'bonded', '离场走「放到一边」的区域替换')
  const entry = registeredEntry('10090')
  assert.equal(entry.simplified, true, '条目自述为近似')
  assert.match(entry.note, /不能移动/, 'note 逐条披露缺读点')

  // 缺口证据：敌人附属目前不是实体规则来源，所以「所附属敌人不能移动」还拦不住移动。
  const here = state.investigators[0].location
  state.locations.push({ id: 'm2-8-elsewhere', name: '别处', revealed: true, connections: [here], clues: 0 })
  state.locations.find(item => item.id === here).connections = ['m2-8-elsewhere']
  assert.equal(viaAbilityApi(state, api => api.moveEnemy(after, 'm2-8-elsewhere')?.moved === true), true,
    '缺口：附魔后敌人仍能移动（敌人附属不是 entityModifierRows / enemy.immobile 的读点）')

  // 「在所附属敌人离场时：放到一边，位于场外」：被击败 → 腐烂回到场外绑定集合，不进弃牌堆。
  runTest(state, draft => {
    const target = draft.enemies.find(item => item.id === foe.id)
    if (!target) return
    viaDraftApi(draft, api => api.damageEnemy(target, 30, 0))
  })
  assert.equal(state.enemies.some(item => item.id === foe.id), false, '敌人被击败')
  assert.ok((state.bondedSets?.['10085']?.cards || []).includes('10090'), '霉绿腐烂回到场外绑定集合')
  assert.equal(state.investigators[0].discard.includes('10090'), false, '不进入弃牌堆')
})

// ---------------------------------------------------------------------------
// 10091 通灵术
// ---------------------------------------------------------------------------

test('P6 10091 通灵术：花费任意数量贡品，揭示等量标记；有骷髅则把弃牌堆的[[法术]]事件返回手牌', () => {
  const state = fixture('01001')
  const speak = asset(state, '10091')
  state.investigators[0].discard = ['11041', '01088'] // 11041 宇宙启示（法术事件）；01088 不是法术事件
  state.chaosBag = ['skull', 'skull', '0']

  move(state, { action: 'ability', assetId: speak.id, abilityIndex: 0 })
  resolveChoices(state, pending => {
    const spend = pending.options.find(option => option.id === '2' && /花费 2 个贡品/.test(String(option.label || '')))
    if (spend) return spend.id
    const event = pending.options.find(option => option.cardCode === '11041')
    return event ? event.id : null
  })
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === speak.id).uses, 4, '花费 2 个贡品（6 → 4）')
  assert.ok(inv.hand.includes('11041'), '法术事件返回手牌')
  assert.equal(inv.discard.includes('11041'), false, '离开弃牌堆')
  assert.ok(inv.discard.includes('01088'), '非[[法术]]/[[仪式]]事件不受影响')
})

test('P6 10091 通灵术：没有揭示骷髅/诅咒时事件留在弃牌堆（负面路径）', () => {
  const state = fixture('01001')
  const speak = asset(state, '10091')
  state.investigators[0].discard = ['11041']
  state.chaosBag = ['0', '0', '0']

  move(state, { action: 'ability', assetId: speak.id, abilityIndex: 0 })
  resolveChoices(state, pending => pending.options.find(option => option.id === '1')?.id ?? null)
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === speak.id).uses, 5, '贡品已花费')
  assert.ok(inv.discard.includes('11041'), '检定失败（无骷髅/诅咒）时事件留在弃牌堆')
  assert.equal(inv.hand.includes('11041'), false)
})

// ---------------------------------------------------------------------------
// 10092 邪恶祭祀刀
// ---------------------------------------------------------------------------

test('P6 10092 邪恶祭祀刀：加入 1-3 个诅咒（每个 +2 战斗），击败敌人后补满 1 充能', () => {
  const state = fixture('01001')
  const athame = asset(state, '10092')
  const scrying = asset(state, '01061', { uses: 1, usesType: 'charges' })
  const foe = enemy(state, { health: 1, fight: 1, engagedSeat: 0 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0'] // 本次攻击固定揭示「0」，让 +6 战斗体现在检定值上
  const baseCombat = getStat(state, state.investigators[0], 'combat')

  move(state, { action: 'ability', assetId: athame.id, abilityIndex: 0, targetId: foe.id })
  resolveChoices(state, pending => pending.options.find(option => option.id === '2' && /再加入 2 个/.test(String(option.label || '')))?.id ?? null)
  assert.equal(state.lastTestResult.value, baseCombat + 6, '3 个诅咒 → 本次攻击 +6 战斗')
  assert.equal(state.enemies.some(item => item.id === foe.id), false, '敌人被击败')
  assert.equal(state.chaosBag.filter(token => token === 'curse').length, 3, '费用 1 个 + 追加 2 个诅咒标记')
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.id === scrying.id).uses, 2, '击败后补满 1 充能')
  assert.ok(inv.assets.some(item => item.id === athame.id), '邪恶祭祀刀留在场上')
})

test('P6 10092 邪恶祭祀刀：未击败敌人时不补满（负面路径）', () => {
  const state = fixture('01001')
  const athame = asset(state, '10092')
  const scrying = asset(state, '01061', { uses: 1, usesType: 'charges' })
  const foe = enemy(state, { health: 5, fight: 1, engagedSeat: 0 })
  state.chaosBag = ['0']
  state.debugNextTokens = ['0']

  move(state, { action: 'ability', assetId: athame.id, abilityIndex: 0, targetId: foe.id })
  resolveChoices(state, pending => pending.options.find(option => option.id === '0' && /不再加入/.test(String(option.label || '')))?.id ?? null)
  const after = state.enemies.find(item => item.id === foe.id)
  assert.ok(after, '敌人仍存活')
  assert.equal(after.damageTaken, 1, '只造成 1 点伤害')
  assert.equal(state.investigators[0].assets.find(item => item.id === scrying.id).uses, 1, '没有补满')
})

// ---------------------------------------------------------------------------
// 10093 洪荒赞歌（双重）
// ---------------------------------------------------------------------------

const HYMN_DECK = ['01164', '01165', '01166', '01167', '01168', '01169']

test('P6 10093 洪荒赞歌：额外花 1 行动；揭示遭遇牌库顶 5 张，加诅咒放牌库底，其余放回牌库顶', () => {
  const state = fixture('01001')
  state.encounterDeck = [...HYMN_DECK]
  state.chaosBag = ['0']
  const descriptor = registeredEntry('10093').abilities.find(item => item.kind === 'played')
  assert.deepEqual(descriptor.cost, { action: 1 }, '双重：played 描述子声明额外 1 行动')
  assert.equal(playedActionCost('10093'), 1, '引擎读点 playedActionCost 认得这项额外费用')

  let asked = 0
  runDescriptor(state, '10093', 'played', {
    choose: pending => {
      const option = pending.options.find(item => item.id === (asked < 2 ? 'curse' : 'top'))
      if (option) asked += 1
      return option ? option.id : null
    },
  })
  // 顶 5 张（f..b）里前 2 张换到牌库底，其余 3 张按原顺序放回牌库顶。
  assert.deepEqual(state.encounterDeck, ['01168', '01169', '01164', '01165', '01166', '01167'])
  assert.equal(state.chaosBag.filter(token => token === 'curse').length, 2, '每放底 1 张加 1 个诅咒')
  assert.equal(state.encounterDeck.length, 6, '没有牌离开遭遇牌库')
})

test('P6 10093 洪荒赞歌：全部放回牌库顶时牌库顺序不变（负面路径）', () => {
  const state = fixture('01001')
  state.encounterDeck = [...HYMN_DECK]
  state.chaosBag = ['0']
  runDescriptor(state, '10093', 'played', { choose: pickOption(/放回遭遇牌库顶/) })
  assert.deepEqual(state.encounterDeck, [...HYMN_DECK], '不加诅咒 → 牌库顺序不变')
  assert.equal(state.chaosBag.includes('curse'), false)
})

// ---------------------------------------------------------------------------
// 10094 精华汲取
// ---------------------------------------------------------------------------

test('P6 10094 精华汲取：谈判检定意志(X=敌人攻击值)，成功把 2 点伤害（非精英）移到敌人', () => {
  const state = fixture('01001')
  state.investigators[0].damage = 2
  const foe = enemy(state, { fight: 2, health: 10, engagedSeat: 0 })
  state.chaosBag = ['0']

  runDescriptor(state, '10094', 'played', {
    choose: pending => {
      const two = pending.options.find(option => option.id === '2')
      return two ? two.id : null
    },
  })
  const after = state.enemies.find(item => item.id === foe.id)
  assert.equal(state.lastTestResult.difficulty, 2, 'X = 敌人攻击值 2')
  assert.equal(state.lastTestResult.success, true)
  assert.equal(after.damageTaken, 2, '2 点伤害移动到敌人')
  assert.equal(state.investigators[0].damage, 0, '调查员身上的伤害被移走')
})

test('P6 10094 精华汲取：精英敌人最多移动 1 点伤害（负面路径）', () => {
  const state = fixture('01001')
  state.investigators[0].damage = 2
  const elite = enemy(state, { fight: 2, health: 10, elite: true, engagedSeat: 0 })
  state.chaosBag = ['0']

  runDescriptor(state, '10094', 'played')
  const after = state.enemies.find(item => item.id === elite.id)
  assert.equal(after.damageTaken, 1, '精英只移动 1 点')
  assert.equal(state.investigators[0].damage, 1, '调查员身上还剩 1 点')
})

// ---------------------------------------------------------------------------
// 10095 身受诅咒
// ---------------------------------------------------------------------------

test('P6 10095 身受诅咒：投入后本次检定的诅咒标记修正视为 0（-2 → 0）', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['10095']
  state.chaosBag = ['curse']
  state.debugNextTokens = ['curse', '0']
  const base = getStat(state, state.investigators[0], 'willpower')
  let result = null
  runTest(state, draft => {
    performTest(draft, 0, 'willpower', base + 1, { resolve: value => { result = value } })
  }, pending => {
    if (pending.kind === 'commit') return pickOption(/Accursed|身受诅咒/)(pending)
    if (pending.kind === 'effect') {
      const none = pending.options.find(option => option.id === '0')
      if (none) return none.id
    }
    return null
  })
  assert.ok(result, '检定完成')
  const profile = registeredEntry('10095').abilities.find(item => item.kind === 'commit').skill
  assert.equal(profile.tokenModifiers.curse, 0, 'commit 档案把诅咒修正声明为 0')
  assert.equal(result.drawn.includes('curse'), true, '本次检定揭示了诅咒标记')
  assert.equal(result.value, base + 1, '诅咒 -2 被改为 0（意志 3 + 1 万能图标 + 0）')
  assert.equal(result.success, true, '没有 0 修正时 3+1-2=2 会失败')
})

test('P6 10095 身受诅咒：投入时可加入至多 3 个诅咒标记', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['10095']
  state.chaosBag = ['0', '0', '0', '0']
  state.debugNextTokens = ['0']
  runTest(state, draft => { performTest(draft, 0, 'willpower', 0) }, pending => {
    if (pending.kind === 'commit') return pickOption(/Accursed|身受诅咒/)(pending)
    if (pending.kind === 'effect') {
      const three = pending.options.find(option => option.id === '3')
      if (three) return three.id
    }
    return null
  })
  assert.equal(state.chaosBag.filter(token => token === 'curse').length, 3, '加入 3 个诅咒标记')
})

// ---------------------------------------------------------------------------
// 10096 催眠作用
// ---------------------------------------------------------------------------

test('P6 10096 催眠作用：投入技能检定提供意志+万能图标；「忽略效果」缺读点已披露', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['10096']
  state.chaosBag = ['0']
  const base = getStat(state, state.investigators[0], 'willpower')
  let result = null
  runTest(state, draft => {
    performTest(draft, 0, 'willpower', 1, { resolve: value => { result = value } })
  }, pending => (pending.kind === 'commit' ? pickOption(/Mesmeric|催眠作用/)(pending) : null))
  assert.ok(result, '检定完成')
  assert.equal(result.value, base + 2, '投入后意志 +1、万能 +1')
  assert.equal(result.success, true)
  const entry = registeredEntry('10096')
  assert.equal(entry.simplified, true, '条目自述为近似')
  assert.match(entry.note, /忽略/, 'note 披露「忽略关键词/地点效果」缺读点')
  assert.ok(entry.abilities.some(item => item.kind === 'commit'), 'commit 描述子可投入')
})

// ---------------------------------------------------------------------------
// 10097 奥利芙·麦克布莱德（等级 2）
// ---------------------------------------------------------------------------

test('P6 10097 奥利芙·麦克布莱德：横置后改为揭示 4 个标记并选择 2 个结算，其余归还', () => {
  const state = fixture('01001')
  const olive = asset(state, '10097')
  state.chaosBag = ['0', '0', '0', '-2']
  state.debugNextTokens = ['0', '0', '0', '-2']
  let result = null
  runTest(state, draft => {
    performTest(draft, 0, 'willpower', 0, { resolve: value => { result = value } })
  }, pending => {
    if (pending.kind === 'reaction' && pending.source === 'oliveMcBride2') return 'trigger'
    if (pending.kind === 'token') return pending.options[0]?.id ?? null
    return null
  })
  assert.ok(result, '检定完成')
  assert.equal(result.drawn.length, 2, '结算 2 个标记（从一个标记改为 4 选 2）')
  assert.equal(state.chaosBag.length, 4, '被忽略的标记归还混乱袋')
  assert.equal(state.investigators[0].assets.find(item => item.id === olive.id).exhausted, true, '奥利芙横置')
})

// ---------------------------------------------------------------------------
// 分片完整性守卫
// ---------------------------------------------------------------------------

test('P6 M2-8 分片：10 张条目全部注册且 code 与文件名一致', () => {
  assert.equal(CODES.length, 10, 'M2-8 分片固定 10 张')
  for (const code of CODES) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册`)
    assert.equal(entry.code, code)
    assert.ok(ALL_CARDS[code], `${code} 缺少卡面数据`)
  }
  // 缺读点的卡必须逐张披露（simplified + note）。
  for (const code of ['10089', '10090', '10092', '10093', '10094', '10096', '10098']) {
    assert.equal(registeredEntry(code).simplified, true, `${code} 应声明 simplified`)
    assert.ok(registeredEntry(code).note, `${code} 应带 note`)
  }
  // 「谈判」指示的两张事件必须在描述子上声明（借机攻击豁免门禁）。
  for (const code of ['10094']) {
    assert.equal(registeredEntry(code).abilities.find(item => item.kind === 'played').countsAs, 'parley')
  }
  assert.equal(registeredEntry('10092').abilities.find(item => item.kind === 'action').countsAs, 'fight')
})
