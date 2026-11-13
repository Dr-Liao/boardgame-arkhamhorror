// P7 共享遭遇组（worker B）验收：12 组 / 31 张跨章共享遭遇卡。
//
// 覆盖：
//   · 12 个共享组的逐组真实行为断言（敌人强制 / 诡计显现 / 威胁区 / 地点附属 / 空洞 / 隐匿 / 绯红密钥 /
//     同志会 / 空间异常 / 腐化）；
//   · 单卡条目 → 卡表身份 → 遭遇组归属的一致性；
//   · 近似逐条披露：凡登记 primitive-requests/<code>.json 的条目必须在 note 里写 approximation；
//   · JSON 存档往返：空洞 / 隐匿容器与条目结算在序列化后仍然一致。
//
// 条目用动态 import 逐文件加载（不依赖遭遇索引重建，索引由主进程统一重建）：先造一局基础状态触发引擎
// 默认条目注册，再注册本 worker 的 31 张条目，之后的真实窗口派发/直接钩子调用都能命中。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { fixture } from './core-fixture.mjs'
import { resolveTransaction } from '../src/engine/resolution.js'
import { scenarioRuntime } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { hollowCard, hollowCards, hollowCount } from '../src/engine/tsk-hollow.js'
import { placeMiniCard } from '../src/engine/tsk-concealed.js'
import { bindKey, initializeScarletKeys, scarletKey } from '../src/engine/tsk-scarlet-keys.js'

const MOD = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..')
const SHARED_ROOT = path.join(MOD, 'src/cards/encounter-entries/theScarletKeys/_shared')

// 本 worker 名下的 12 组与 31 张卡（与 artifacts/migration/tsk/campaign-inventory.json 的 sharedGroups 一致）。
// 目录名 = cards-data 的 encounterCode（snake_case，归属算法统一口径）。
// 目录键在这里只用于枚举文件；组名断言一律走卡表 encounterCode。
const GROUPS = {
  agents_of_the_outside: ['09737', '09738'],
  agents_of_yuggoth: ['09739', '09740'],
  cleanup_crew: ['09726a', '09726b', '09727a', '09727b', '09728'],
  dark_veiling: ['09724', '09725'],
  mysteries_abound: ['09720', '09721'],
  outsiders: ['09731', '09732', '09733'],
  scarlet_sorcery: ['09729', '09730'],
  secret_war: ['09734', '09735', '09736'],
  shadow_of_a_doubt: ['09722', '09723'],
  spatial_anomaly: ['09741', '09742', '09743'],
  spreading_corruption: ['09744', '09745', '09746'],
  strange_happenings: ['09718', '09719'],
}
const CODES = Object.values(GROUPS).flat()
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([group, codes]) => codes.map(code => [code, group])))
// 目录键 ↔ 卡表 encounterCode（归属算法要求的 snake_case 口径）。
const ENCOUNTER_CODE_BY_GROUP = {
  agentsOfTheOutside: 'agents_of_the_outside', agents_of_the_outside: 'agents_of_the_outside',
  agentsOfYuggoth: 'agents_of_yuggoth', agents_of_yuggoth: 'agents_of_yuggoth',
  cleanupCrew: 'cleanup_crew', cleanup_crew: 'cleanup_crew',
  darkVeiling: 'dark_veiling', dark_veiling: 'dark_veiling',
  mysteriesAbound: 'mysteries_abound', mysteries_abound: 'mysteries_abound',
  outsiders: 'outsiders',
  scarletSorcery: 'scarlet_sorcery', scarlet_sorcery: 'scarlet_sorcery',
  secretWar: 'secret_war', secret_war: 'secret_war',
  shadowOfADoubt: 'shadow_of_a_doubt', shadow_of_a_doubt: 'shadow_of_a_doubt',
  spatialAnomaly: 'spatial_anomaly', spatial_anomaly: 'spatial_anomaly',
  spreadingCorruption: 'spreading_corruption', spreading_corruption: 'spreading_corruption',
  strangeHappenings: 'strange_happenings', strange_happenings: 'strange_happenings',
}

// ---------------------------------------------------------------- 条目加载
const entryFiles = []
for (const group of Object.keys(GROUPS)) {
  for (const name of fs.readdirSync(path.join(SHARED_ROOT, group)).sort()) {
    if (name.endsWith('.js')) entryFiles.push({ group, code: name.slice(0, -3), file: path.join(SHARED_ROOT, group, name) })
  }
}
const entries = []
for (const item of entryFiles) {
  const module = await import(pathToFileURL(item.file).href)
  assert.ok(module.default, `${item.file} 缺少 default 导出`)
  assert.equal(module.default.code, item.code, `${item.file} 的 code 与文件名不一致`)
  entries.push(module.default)
}
const entryOf = code => entries.find(entry => entry.code === code)

// 先造一局基础状态触发引擎默认注册，再补注册本 worker 的 31 条（与 eote-scenario-shared 同一口径）。
fixture('01001', 1)
registerCardAbilities(entries.filter(entry => !registeredEntry(entry.code)))

// ---------------------------------------------------------------- 测试工具
const pickDefault = pending => pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
  ?? pending.options[0]?.id

function transaction(state, seat, execute, choose = pickDefault) {
  resolveTransaction(state, seat, { action: 'tskSharedBTest' }, draft => execute(draft))
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 300, '共享遭遇测试的选择循环过多')
    const pending = state.pendingChoice
    const custom = choose(pending)
    const optionId = pending.options.some(option => option.id === custom) ? custom : pickDefault(pending)
    resolveTransaction(state, pending.seat ?? seat, { action: 'choose', choiceId: pending.id, optionId }, draft => execute(draft))
  }
}

function sharedState(count = 2) {
  const state = fixture('01001', count)
  state.humanSeats = []
  return state
}

// 场景运行时 api（显现/剧本钩子用）+ 选择事务解答器。
function hookApi(draft) {
  const runtime = scenarioRuntime(draft, [])
  return Object.assign(Object.create(runtime), { scenario: runtime, mechanics: runtime.mechanics })
}

// 能力面 api 的同形适配（描述子 resolve 用）：api.test 收对象形参数，test 的失败标记由引擎给出。
function abilityStyleApi(draft) {
  const api = hookApi(draft)
  const runtime = api.scenario
  api.test = (seat, skill, difficulty, options) => {
    if (typeof options === 'function') return runtime.test(seat, skill, difficulty, options)
    const spec = options || {}
    return runtime.test(seat, skill, difficulty, spec.resolve, Number(spec.skillBonus) || 0, spec.source || null)
  }
  // api-misc 的「场上诡计枚举/去除」在能力面上；测试适配层给出同语义实现。
  api.cardsInPlayTreacheries = () => {
    const out = []
    for (const owner of draft.investigators) {
      for (const threat of owner.threat || []) out.push({ code: threat.originalCode || threat.code, hostType: 'investigator', host: owner, hostId: owner.seat, attachment: threat })
    }
    for (const location of draft.locations || []) {
      for (const attachment of location.attachments || []) out.push({ code: attachment.originalCode || attachment.code, hostType: 'location', host: location, hostId: location.id, attachment })
    }
    for (const enemy of draft.enemies || []) {
      for (const attachment of enemy.attachments || []) out.push({ code: attachment.originalCode || attachment.code, hostType: 'enemy', host: enemy, hostId: enemy.id, attachment })
    }
    return out.filter(entry => entry.code)
  }
  api.discardCardInPlay = entry => {
    const list = entry.hostType === 'investigator' ? entry.host?.threat : entry.host?.attachments
    const index = (list || []).indexOf(entry.attachment)
    if (index < 0) return false
    list.splice(index, 1)
    draft.encounterDiscard.push(entry.code)
    return true
  }
  // api-clue 的威胁区去除在能力面上；测试适配层给出同语义实现（移除实例并进遭遇弃牌堆）。
  api.removeThreat = card => {
    const owner = draft.investigators.find(inv => (inv.threat || []).includes(card))
    if (!owner) return false
    const index = owner.threat.indexOf(card)
    if (index < 0) return false
    owner.threat.splice(index, 1)
    draft.encounterDiscard.push(card.originalCode || card.code)
    return true
  }
  return api
}

function draftEntity(draft, id) {
  if (!id) return null
  const lists = [draft.enemies, draft.locations, draft.storyAssets,
    ...(draft.investigators || []).map(inv => [...(inv.assets || []), ...(inv.threat || [])]),
    ...(draft.enemies || []).map(enemy => enemy.attachments || []),
    ...(draft.locations || []).map(location => location.attachments || [])]
  for (const list of lists) {
    const found = (list || []).find(item => item.id === id)
    if (found) return found
  }
  return null
}

function callEncounter(state, code, seat = 0, choose = pickDefault, card = null) {
  const entry = entryOf(code)
  assert.ok(entry?.encounterResolve, `${code} 缺少 encounterResolve`)
  const target = card || { code, originalCode: code, name: ALL_CARDS[code]?.nameZh || code }
  let result
  transaction(state, seat, draft => {
    const inv = draft.investigators[seat]
    result = entry.encounterResolve(draft, inv, target, hookApi(draft), { location: draft.locations.find(loc => loc.id === inv.location) })
  }, choose)
  return result
}

// 直接调用描述子（真实引擎状态 + 能力面 api；选择走事务解答器）。
function callAbility(state, code, index = 0, seat = 0, context = {}, choose = pickDefault) {
  const entry = entryOf(code)
  const descriptor = entry?.abilities?.[index] ?? entry?.treacheryRule?.attachmentAbilities?.[index]
  assert.ok(descriptor?.resolve, `${code} 第 ${index} 条能力缺少 resolve`)
  const sourceId = context.source?.id ?? null
  transaction(state, seat, draft => {
    const execution = { ...context, seat }
    const source = sourceId ? (draftEntity(draft, sourceId) || context.source) : { code, id: code, name: ALL_CARDS[code]?.nameZh || code }
    descriptor.resolve({
      state: draft, inv: draft.investigators[seat], seat, source,
      context: execution, ctx: execution, api: abilityStyleApi(draft),
    })
  }, choose)
}

// 附属卡自身的行动（treacheryRule.attachmentAbilities，与 07099/07299 同一枚举读点）。
function callAttachmentAbility(state, code, index = 0, seat = 0, context = {}, choose = pickDefault) {
  const descriptor = entryOf(code)?.treacheryRule?.attachmentAbilities?.[index]
  assert.ok(descriptor?.resolve, `${code} 第 ${index} 条附属卡行动缺少 resolve`)
  const sourceId = context.source?.id ?? null
  transaction(state, seat, draft => {
    const execution = { ...context, seat }
    const source = sourceId ? (draftEntity(draft, sourceId) || context.source) : { code, id: code }
    descriptor.resolve({
      state: draft, inv: draft.investigators[seat], seat, source,
      context: execution, ctx: execution, api: abilityStyleApi(draft),
    })
  }, choose)
}

function runRuntime(state, seat, execute, choose = pickDefault) {
  transaction(state, seat, draft => execute(scenarioRuntime(draft, [])), choose)
}

function addLocation(state, id, extra = {}) {
  const location = {
    id, code: extra.code ?? '01112', originalCode: extra.code ?? '01112', name: extra.name ?? id,
    revealed: true, clues: extra.clues ?? 0, maxClues: extra.clues ?? 0, shroud: extra.shroud ?? 2,
    connections: [...(extra.connections ?? [])],
  }
  state.locations.push(location)
  for (const other of state.locations) {
    if (other.id === id) continue
    if ((extra.connections || []).includes(other.id) && !(other.connections || []).includes(id)) {
      other.connections ||= []
      other.connections.push(id)
    }
    if ((other.connections || []).includes(id) && !location.connections.includes(other.id)) location.connections.push(other.id)
  }
  return location
}

function spawnAt(state, code, locationId, extra = {}) {
  const card = ALL_CARDS[code]
  const enemy = {
    id: 'test-' + code + '-' + (state.enemies.length + 1), code, originalCode: code,
    name: card?.nameZh || code, location: locationId,
    fight: card?.fight ?? 0, evade: card?.evade ?? 0, health: card?.health ?? 1,
    damageTaken: 0, damage: card?.damage ?? 0, horror: card?.horror ?? 0,
    exhausted: false, engagedSeat: null, traits: [...(card?.traits || [])], ...extra,
  }
  state.enemies.push(enemy)
  return enemy
}

// 迷你卡 / 空洞的前置布置（测试可以直写 state，条目本身受 R1 约束）。
// 敌人迷你卡的 kind 约定：enemy<卡号>（tsk-concealed 的 KIND_PATTERN 不允许数字开头）。
const enemyKind = code => `enemy${code}`
function placeMini(state, kind, locationId, decoy = false) {
  state.scenarioFlags ||= {}
  return placeMiniCard(state, { kind, decoy, locationId })
}
function placeEnemyMini(state, code, locationId) {
  return placeMini(state, enemyKind(code), locationId)
}
function setAsideHollow(state, code, seat = 0, scope = 'investigator') {
  state.scenarioFlags ||= {}
  return hollowCard(state, { code, source: 'test', scope, seat })
}

// ---------------------------------------------------------------- 1. 数据一致性
test('P7 shared B：12 组 / 31 张与卡表归属、文件名、scope 一致，近似逐条披露', () => {
  assert.equal(entryFiles.length, 31)
  assert.deepEqual(Object.keys(GROUPS).sort(), [...new Set(entryFiles.map(item => item.group))].sort())
  for (const item of entryFiles) {
    const card = ALL_CARDS[item.code]
    assert.ok(card, `${item.code} 不在卡表`)
    assert.equal(card.encounterCode, ENCOUNTER_CODE_BY_GROUP[item.group], `${item.code} 的遭遇组与目录不一致`)
    assert.equal(GROUP_OF[item.code], item.group)
    const entry = entryOf(item.code)
    assert.equal(entry.implemented, true, `${item.code} 未标 implemented`)
    const expectedScope = card.type === 'asset' ? 'storyAsset' : card.type
    assert.equal(entry.scope, expectedScope, `${item.code} 的 scope 与卡表类型不一致`)
    const hasLogic = typeof entry.encounterResolve === 'function'
      || (entry.abilities || []).some(ability => typeof ability.resolve === 'function')
      || (entry.treacheryRule?.attachmentAbilities || []).some(ability => typeof ability.resolve === 'function')
    assert.ok(hasLogic, `${item.code} 是无行为空壳`)
  }
  // 登记了原语请求的卡必须在 note 里披露近似。
  const requestDir = path.join(MOD, '../../artifacts/migration/tsk/primitive-requests')
  const requested = new Set(CODES.filter(code => fs.existsSync(path.join(requestDir, `${code}.json`))))
  assert.ok(requested.size > 0)
  for (const code of requested) {
    const note = String(entryOf(code)?.note || '')
    assert.match(note, /approximation/, `${code} 有原语请求但 note 未披露 approximation`)
  }
})

// ---------------------------------------------------------------- 2. strangeHappenings
test('P7 shared B strangeHappenings：现实塌缩的二选一与瓢泼大雨的逐点失败', () => {
  const discard = sharedState(2)
  discard.investigators[0].hand = ['01020', '01030', '01059']
  discard.investigators[0].clues = 1
  callEncounter(discard, '09718', 0, pending => pending.options.find(option => option.id === 'discard')?.id)
  assert.equal(discard.investigators[0].clues, 1, '09718：选弃牌时不应花费线索')
  assert.equal(discard.investigators[0].hand.length, 1, '09718：弃掉一半非弱点手牌（向上取整 = 2 张）')

  const clue = sharedState(2)
  clue.investigators[0].hand = ['01020']
  clue.investigators[0].clues = 2
  callEncounter(clue, '09718')
  assert.equal(clue.investigators[0].clues, 1, '09718：选花费 1 个线索')

  const horror = sharedState(2)
  horror.investigators[0].willpower = 0
  horror.investigators[0].clues = 0
  horror.chaosBag = ['0']
  const beforeHorror = horror.investigators[0].horror
  callEncounter(horror, '09719')
  assert.equal(horror.investigators[0].horror - beforeHorror, 3, '09719：无线索时失败差值全部转为恐惧')

  const place = sharedState(2)
  place.investigators[0].willpower = 0
  place.investigators[0].clues = 3
  place.chaosBag = ['0']
  const here = place.investigators[0].location
  const locationCluesBefore = place.locations.find(loc => loc.id === here).clues
  callEncounter(place, '09719', 0, pending => pending.options.find(option => option.id === 'clue')?.id)
  assert.equal(place.investigators[0].clues, 0, '09719：选放线索时逐点花掉线索')
  assert.equal(place.locations.find(loc => loc.id === here).clues - locationCluesBefore, 3, '09719：线索放到所在地点')
})

// ---------------------------------------------------------------- 3. mysteriesAbound
test('P7 shared B mysteriesAbound：结社代表动态巡逻 + 就在眼前附属（无目标时涌动）', () => {
  const state = sharedState(2)
  const here = state.investigators[0].location
  addLocation(state, 'patrol-far', { connections: [] })
  state.locations.find(loc => loc.id === here).connections.push('patrol-far')
  placeEnemyMini(state, '09737', 'patrol-far')
  const envoy = spawnAt(state, '09720', here)
  callAbility(state, '09720', 0, 0, { source: { id: envoy.id } })
  assert.equal(state.enemies.find(item => item.id === envoy.id).location, 'patrol-far', '09720：巡逻向有迷你卡的地点移动一步')
  callAbility(state, '09720', 0, 0, { source: { id: envoy.id } })
  assert.equal(state.enemies.find(item => item.id === envoy.id).location, 'patrol-far', '09720：已在目标地点时不再移动')
  callAbility(state, '09720', 1, 0, { source: { id: envoy.id }, enemy: state.enemies.find(item => item.id === envoy.id) })

  const none = sharedState(1)
  const surge = callEncounter(none, '09721')
  assert.deepEqual(surge, { gainSurge: true }, '09721：没有阴影中的[[域外]]敌人时获得涌动')

  const attach = sharedState(1)
  const location = attach.investigators[0].location
  addLocation(attach, 'shadows-a', { connections: [] })
  placeEnemyMini(attach, '09737', 'shadows-a')
  const hidden = spawnAt(attach, '09737', 'shadows-a')
  const result = callEncounter(attach, '09721')
  assert.deepEqual(result, { placed: true }, '09721：附属成功时返回 placed')
  const host = attach.enemies.find(item => item.id === hidden.id)
  assert.ok((host.attachments || []).some(card => (card.originalCode || card.code) === '09721'), '09721 应附属到阴影中的敌人')
  void location
})

// ---------------------------------------------------------------- 4. shadowOfADoubt
test('P7 shared B shadowOfADoubt：暗中一刀的威胁区/涌动/回合末检定，乔装卧底的诱饵', () => {
  const state = sharedState(1)
  callEncounter(state, '09722')
  assert.ok(state.investigators[0].threat.some(card => card.code === '09722'), '09722：进入威胁区域')
  const surplus = callEncounter(state, '09722')
  assert.deepEqual(surplus, { gainSurge: true }, '09722：威胁区已有同卡时获得涌动')

  const escape = sharedState(1)
  callEncounter(escape, '09722')
  escape.investigators[0].agility = 5
  escape.chaosBag = ['0']
  const threat = escape.investigators[0].threat.find(card => card.code === '09722')
  callAbility(escape, '09722', 1, 0, { source: { id: threat.id } })
  assert.equal(escape.investigators[0].threat.length, 0, '09722：回合末敏捷检定成功后弃掉')

  const undercover = sharedState(1)
  const location = undercover.investigators[0].location
  const noEnemy = callEncounter(undercover, '09723')
  assert.deepEqual(noEnemy, { gainSurge: true }, '09723：阴影中没有敌人时获得涌动')

  const fail = sharedState(1)
  fail.investigators[0].intellect = 0
  fail.chaosBag = ['0']
  const at = fail.investigators[0].location
  placeEnemyMini(fail, '09737', at)
  spawnAt(fail, '09737', at)
  callEncounter(fail, '09723', 0, pending => pending.options.find(option => option.id === 'intellect')?.id)
  const cards = fail.scenarioFlags.mechanics.tsk.concealed.miniCards
  assert.ok(cards.some(card => card.decoy === true), '09723：失败后放置 1 张诱饵')
  void location
})

// ---------------------------------------------------------------- 5. darkVeiling
test('P7 shared B darkVeiling：误见阴影的检定失败恐惧与黑暗中的身影二选一', () => {
  const state = sharedState(1)
  const here = state.investigators[0].location
  callEncounter(state, '09724')
  placeEnemyMini(state, '09737', here)
  const threat = state.investigators[0].threat.find(card => card.code === '09724')
  const beforeHorror = state.investigators[0].horror
  callAbility(state, '09724', 0, 0, { source: { id: threat.id }, result: { success: false } })
  assert.equal(state.investigators[0].horror - beforeHorror, 1, '09724：有迷你卡的地点检定失败受 1 点恐惧')

  const attacks = sharedState(1)
  const at = attacks.investigators[0].location
  placeEnemyMini(attacks, '09737', at)
  spawnAt(attacks, '09737', at)
  const damageBefore = attacks.investigators[0].damage
  const horrorBefore = attacks.investigators[0].horror
  callEncounter(attacks, '09725', 0, pending => pending.options.find(option => option.id === 'attacks')?.id)
  assert.equal(attacks.investigators[0].damage - damageBefore, 1, '09725：阴影中的敌人攻击你（伤害）')
  assert.equal(attacks.investigators[0].horror - horrorBefore, 1, '09725：阴影中的敌人攻击你（恐惧）')

  const actions = sharedState(2)
  const where = actions.investigators[0].location
  placeEnemyMini(actions, '09737', where)
  spawnAt(actions, '09737', where)
  const before = actions.investigators[0].actionsLeft
  callEncounter(actions, '09725', 0, pending => pending.options.find(option => option.id === 'actions')?.id)
  assert.equal(actions.investigators[0].actionsLeft, before - 1, '09725：每位调查员失去 1 个行动')
})

// ---------------------------------------------------------------- 6. cleanupCrew
test('P7 shared B cleanupCrew：结社打手/刺客的阴影强制与溜之大吉的最近结社敌人', () => {
  const enforcer = sharedState(1)
  const here = enforcer.investigators[0].location
  placeEnemyMini(enforcer, '09726a', here)
  placeEnemyMini(enforcer, '09737', here)
  const guard = spawnAt(enforcer, '09726a', here)
  const before = enforcer.investigators[0].horror
  callAbility(enforcer, '09726a', 0, 0, { source: { id: guard.id }, kind: 'enemy09737' })
  assert.equal(enforcer.investigators[0].horror - before, 1, '09726a：揭露其他敌人后从阴影中攻击')

  const assassin = sharedState(2)
  const at = assassin.investigators[0].location
  placeEnemyMini(assassin, '09727a', at)
  placeEnemyMini(assassin, '09737', at)
  assassin.investigators[1].location = 'elsewhere'
  addLocation(assassin, 'elsewhere', { connections: [] })
  const killer = spawnAt(assassin, '09727a', at)
  assassin.phase = 'upkeep'
  const damageBefore = assassin.investigators[0].damage
  callAbility(assassin, '09727a', 0, 0, { source: { id: killer.id } })
  assert.equal(assassin.investigators[0].damage - damageBefore, 1, '09727a：敌军阶段结束攻击有迷你卡地点的调查员')

  const none = sharedState(1)
  const surge = callEncounter(none, '09728')
  assert.deepEqual(surge, { gainSurge: true }, '09728：场上没有[[结社]]敌人时获得涌动')

  const retreat = sharedState(1)
  retreat.investigators[0].agility = 0
  retreat.chaosBag = ['0']
  const coterie = spawnAt(retreat, '09726b', retreat.investigators[0].location)
  const hurt = retreat.investigators[0].horror
  callEncounter(retreat, '09728')
  assert.equal(retreat.investigators[0].horror - hurt, 1, '09728：失败后最近的[[结社]]敌人攻击你（09726b 恐惧 1）')
  void coterie
})

// ---------------------------------------------------------------- 7. scarletSorcery
test('P7 shared B scarletSorcery：身染猩红附属最高生命值结社敌人 + 稳定钥匙翻面；钥匙充能变换敌人钥匙', () => {
  const state = sharedState(1)
  const here = state.investigators[0].location
  const low = spawnAt(state, '09727a', here)
  const high = spawnAt(state, '09726a', here)
  const result = callEncounter(state, '09729')
  assert.deepEqual(result, { placed: true })
  const host = state.enemies.find(item => item.id === high.id)
  assert.ok((host.attachments || []).some(card => card.code === '09729'), '09729：附属到印刷生命值最高的结社敌人')
  assert.ok(!(state.enemies.find(item => item.id === low.id).attachments || []).length, '09729：不附属低生命值敌人')
  assert.deepEqual(entryOf('09729').treacheryRule.attackBonus, { damage: 1, horror: 1 })

  initializeScarletKeys(state, [{ id: 'redKey', stableFace: '09830a', unstableFace: '09830b' }])
  bindKey(state, 'redKey', { type: 'investigator', seat: 0 })
  assert.equal(scarletKey(state, 'redKey').stable, true)
  const attachment = state.enemies.find(item => item.id === high.id).attachments.find(card => card.code === '09729')
  callAbility(state, '09729', 0, 0, { source: { id: attachment.id } })
  assert.equal(scarletKey(state, 'redKey').stable, false, '09729：把稳定钥匙翻至动荡面')
  assert.ok(!(state.enemies.find(item => item.id === high.id).attachments || []).some(card => card.code === '09729'), '09729：之后弃掉本卡')

  const charge = sharedState(1)
  initializeScarletKeys(charge, [{ id: 'blueKey', stableFace: '09831a', unstableFace: '09831b' }])
  const holder = spawnAt(charge, '09726a', charge.investigators[0].location)
  bindKey(charge, 'blueKey', { type: 'enemy', enemyId: holder.id })
  const stableBefore = scarletKey(charge, 'blueKey').stable
  callEncounter(charge, '09730')
  assert.equal(scarletKey(charge, 'blueKey').stable, !stableBefore, '09730：敌人持有的每把钥匙各变换一次')
})

// ---------------------------------------------------------------- 8. secretWar
test('P7 shared B secretWar：异界仿体对空洞同名卡的反应、记忆变体放密谋旁、失落的秘密逐点空洞', () => {
  const mimic = sharedState(1)
  const here = mimic.investigators[0].location
  mimic.investigators[0].hand = ['01088']
  setAsideHollow(mimic, '01088')
  const copy = spawnAt(mimic, '09734', here)
  const horrorBefore = mimic.investigators[0].horror
  callAbility(mimic, '09734', 0, 0, { source: { id: copy.id }, cardCode: '01088' })
  assert.equal(mimic.investigators[0].horror - horrorBefore, 2, '09734：打出空洞同名卡后攻击该调查员（09734 恐惧 2）')

  const memory = sharedState(1)
  memory.investigators[0].discard = ['01088']
  const placed = callEncounter(memory, '09735')
  assert.deepEqual(placed, { placed: true })
  assert.ok((memory.agendaAside || []).some(card => (card.originalCode || card.code) === '09735'), '09735：放到密谋牌库旁')
  callAbility(memory, '09735', 0, 0, { cardCode: '01088' })
  assert.ok(hollowCards(memory).some(card => card.code === '01088'), '09735：打出的事件改为放在一边成为空洞')

  const lost = sharedState(1)
  lost.investigators[0].hand = ['01020', '01030', '01059']
  lost.investigators[0].willpower = 0
  lost.chaosBag = ['0']
  callEncounter(lost, '09736')
  assert.equal(hollowCount(lost, { scope: 'investigator', seat: 0 }), 3, '09736：失败差值逐点把非弱点手牌设为空洞')
  assert.equal(lost.investigators[0].hand.length, 0)

  const recall = sharedState(1)
  recall.investigators[0].willpower = 10
  recall.chaosBag = ['0']
  setAsideHollow(recall, '01020')
  callEncounter(recall, '09736', 0, pending => (pending.options.find(option => option.id === 'take')?.id
    ?? pending.options[1]?.id))
  assert.equal(recall.investigators[0].hand.includes('01020'), true, '09736：成功 2+ 时受 1 点恐惧换回 1 张空洞')
})

// ---------------------------------------------------------------- 9. agentsOfTheOutside
test('P7 shared B agentsOfTheOutside：常态颠扑者回合末空洞与 3 张阈值攻击；物质颠倒失去冷漠', () => {
  const state = sharedState(1)
  const here = state.investigators[0].location
  state.investigators[0].deck = ['01020', '01030', '01059']
  setAsideHollow(state, '01086')
  setAsideHollow(state, '01087')
  const enemy = spawnAt(state, '09737', here)
  const damageBefore = state.investigators[0].damage
  callAbility(state, '09737', 0, 0, { source: { id: enemy.id }, seat: 0 })
  assert.equal(state.investigators[0].deck.length, 2, '09737：牌库顶非弱点牌被移出牌库')
  assert.ok(hollowCards(state).some(card => card.code === '01059'), '09737：牌库顶成为空洞')
  assert.equal(state.investigators[0].damage - damageBefore, 1, '09737：3 张空洞后它攻击你')

  const weak = sharedState(1)
  const at = weak.investigators[0].location
  weak.investigators[0].deck = ['10135']
  setAsideHollow(weak, '01020')
  setAsideHollow(weak, '01030')
  const effacer = spawnAt(weak, '09737', at)
  callAbility(weak, '09737', 0, 0, { source: { id: effacer.id }, seat: 0 })
  assert.equal(weak.investigators[0].deck.length, 1, '09737：牌库顶是弱点时留在原处')
  assert.equal(hollowCount(weak, { scope: 'investigator', seat: 0 }), 2, '09737：弱点不成为空洞')

  const inversion = sharedState(1)
  const outsider = spawnAt(inversion, '09731', inversion.investigators[0].location, { aloof: true })
  const result = callEncounter(inversion, '09738')
  assert.deepEqual(result, { placed: true })
  const host = inversion.enemies.find(item => item.id === outsider.id)
  assert.equal(host.aloof, false, '09738：附属的敌人失去冷漠')
  setAsideHollow(inversion, '01020')
  callAbility(inversion, '09738', 0, 0, { source: { id: (host.attachments || [])[0].id }, enemy: host })
  assert.equal(inversion.investigators[0].hand.includes('01020'), true, '09738：成功躲避后抽取 1 张空洞')
  assert.ok(!(inversion.enemies.find(item => item.id === outsider.id).attachments || []).some(card => card.code === '09738'), '09738：之后弃掉本卡')
})

// ---------------------------------------------------------------- 10. agentsOfYuggoth
test('P7 shared B agentsOfYuggoth：密使在阴影中的线索强制；阴晦日食轮末弃置', () => {
  // 密使「隐匿 2」= enemyRule.concealed（内容层 concealedAmountOf 的唯一声明读点）。
  assert.equal(registeredEntry('09739')?.enemyRule?.concealed, 2)
  const state = sharedState(1)
  const here = state.investigators[0].location
  placeEnemyMini(state, '09739', here)
  const emissary = spawnAt(state, '09739', here)
  const before = state.investigators[0].horror
  callAbility(state, '09739', 0, 0, { source: { id: emissary.id }, seat: 0, location: here })
  assert.equal(state.investigators[0].horror - before, 1, '09739：在阴影中时发现线索后攻击你')

  const eclipse = sharedState(1)
  const placed = callEncounter(eclipse, '09740')
  assert.deepEqual(placed, { placed: true })
  const aside = eclipse.agendaAside.find(card => (card.originalCode || card.code) === '09740')
  assert.ok(aside, '09740：放到密谋牌库旁')
  // 「轮末弃掉 1 张（每轮最多一次）」= 引擎 phases.js#upkeepPhase 的旁置卡扫描读点
  // treacheryRule.discardOneAtRoundEnd（与 07095 印斯茅斯之雾同款）；
  // 不再声明 roundEnds 描述子——agendaAside 不在 nonPlayerAbilitySources 的来源枚举里，永不被派发。
  const eclipseEntry = registeredEntry('09740')
  assert.equal(eclipseEntry?.treacheryRule?.discardOneAtRoundEnd, true, '09740：轮末弃置走引擎读点')
  assert.equal(eclipseEntry.abilities.some(ability => ability.trigger?.includes('roundEnds')), false,
    '09740：不再声明不可达的 roundEnds 描述子')
})

// ---------------------------------------------------------------- 11. outsiders
test('P7 shared B outsiders：无端存在交战时空洞、天启噩兆入场强制与被击败回收、物质伪饰同名弃牌', () => {
  const entity = sharedState(1)
  const here = entity.investigators[0].location
  entity.investigators[0].deck = ['01020', '01030']
  const paracausal = spawnAt(entity, '09731', here, { engagedSeat: 0 })
  callAbility(entity, '09731', 0, 0, { source: { id: paracausal.id } })
  assert.equal(entity.investigators[0].deck.length, 1, '09731：交战时空洞化牌库顶')
  assert.ok(hollowCards(entity).some(card => card.code === '01030'))

  const presage = sharedState(2)
  const at = presage.investigators[0].location
  presage.investigators[0].hand = ['01020']
  presage.investigators[1].hand = ['01030']
  const apocalypse = spawnAt(presage, '09732', at)
  callAbility(presage, '09732', 0, 0, { source: { id: apocalypse.id }, enemy: presage.enemies.find(item => item.id === apocalypse.id) })
  assert.equal(hollowCount(presage, { scope: 'team' }), 2, '09732：入场时每位调查员各设 1 张空洞')
  callAbility(presage, '09732', 1, 0, {
    source: { id: apocalypse.id }, enemy: presage.enemies.find(item => item.id === apocalypse.id),
  }, pending => pending.options.find(option => option.id !== 'done')?.id)
  assert.ok(hollowCount(presage, { scope: 'team' }) < 2, '09732：被击败后回收空洞到所有者手牌')

  const veneer = sharedState(1)
  veneer.investigators[0].hand = ['01020', '01030']
  setAsideHollow(veneer, '01020')
  const damageBefore = veneer.investigators[0].damage
  const horrorBefore = veneer.investigators[0].horror
  callEncounter(veneer, '09733')
  assert.equal(veneer.investigators[0].hand.includes('01020'), false, '09733：弃掉与空洞同名的卡牌')
  assert.equal(veneer.investigators[0].damage - damageBefore, 1, '09733：受到 1 点伤害')
  assert.equal(veneer.investigators[0].horror - horrorBefore, 1, '09733：受到 1 点恐惧')

  const fallback = sharedState(1)
  fallback.investigators[0].hand = ['01030']
  callEncounter(fallback, '09733')
  assert.ok(hollowCards(fallback).some(card => card.code === '01030'), '09733：没有弃牌时新设 1 张空洞')
})

// ---------------------------------------------------------------- 12. spatialAnomaly
test('P7 shared B spatialAnomaly：裂隙空间/越界的 Hex 计数与正好 3 张弃置；现实扭曲回合末空洞', () => {
  const splinter = sharedState(1)
  const here = splinter.investigators[0].location
  splinter.investigators[0].agility = 0
  splinter.chaosBag = ['0']
  const damageBefore = splinter.investigators[0].damage
  const result = callEncounter(splinter, '09741')
  assert.deepEqual(result, { placed: true })
  const attached = splinter.locations.find(loc => loc.id === here).attachments.filter(card => card.code === '09741')
  assert.equal(attached.length, 1, '09741：附属到你所在地点')
  assert.equal(splinter.investigators[0].damage - damageBefore, 1, '09741：失败时每张[[巫术]]诡计 1 点伤害（含自身）')

  const three = sharedState(1)
  const at = three.investigators[0].location
  three.investigators[0].agility = 5
  three.chaosBag = ['0']
  for (let index = 0; index < 2; index += 1) {
    three.locations.find(loc => loc.id === at).attachments ||= []
    three.locations.find(loc => loc.id === at).attachments.push({ id: `preset-${index}`, code: '09741', originalCode: '09741' })
  }
  callEncounter(three, '09741')
  assert.equal((three.locations.find(loc => loc.id === at).attachments || []).filter(card => card.code === '09741').length, 0,
    '09741：正好 3 张时全部弃掉')

  const pale = sharedState(1)
  pale.investigators[0].willpower = 0
  pale.chaosBag = ['0']
  const horrorBefore = pale.investigators[0].horror
  callEncounter(pale, '09742')
  assert.equal(pale.investigators[0].horror - horrorBefore, 1, '09742：失败时每张[[巫术]]诡计 1 点恐惧')

  const warped = sharedState(1)
  const where = warped.investigators[0].location
  warped.investigators[0].hand = ['01020']
  callEncounter(warped, '09743')
  const attachment = warped.locations.find(loc => loc.id === where).attachments.find(card => card.code === '09743')
  assert.ok(attachment, '09743：附属到你所在地点')
  callAbility(warped, '09743', 0, 0, { source: { id: attachment.id }, seat: 0 })
  assert.ok(hollowCards(warped).some(card => card.code === '01020'), '09743：回合结束时空洞化一张非弱点手牌')
  const keyed = warped.locations.find(loc => loc.id === where).attachments.find(card => card.code === '09743')
  callAttachmentAbility(warped, '09743', 0, 0, { source: { id: keyed.id } })
  assert.ok(!(warped.locations.find(loc => loc.id === where).attachments || []).some(card => card.code === '09743'),
    '09743：[action][action] 弃掉本卡')
})

// ---------------------------------------------------------------- 13. spreadingCorruption
test('P7 shared B spreadingCorruption：异世界之触最高费用支援、突来冲动回合开始揭示、理智扭曲回合末检定', () => {
  const touch = sharedState(1)
  const expensive = { id: 'asset-expensive', code: '01020', name: '大砍刀', exhausted: false }
  const cheap = { id: 'asset-cheap', code: '01030', name: '放大镜', exhausted: false }
  touch.investigators[0].assets = [cheap, expensive]
  callEncounter(touch, '09744')
  assert.equal(touch.investigators[0].assets.find(asset => asset.id === 'asset-expensive').doom, 1, '09744：毁灭放在印刷费用最高的支援上')

  const noAsset = sharedState(1)
  const surge = callEncounter(noAsset, '09744')
  assert.deepEqual(surge, { gainSurge: true }, '09744：没有可放置毁灭的支援时获得涌动')

  const compulsion = sharedState(1)
  callEncounter(compulsion, '09745')
  const threat = compulsion.investigators[0].threat.find(card => card.code === '09745')
  assert.ok(threat, '09745：进入威胁区域')
  callAbility(compulsion, '09745', 0, 0, { source: { id: threat.id }, seat: 0 })
  assert.ok(compulsion.investigators[0].threat.some(card => card.code === '09745'), '09745：非符号标记时本卡留在威胁区')
  callAbility(compulsion, '09745', 1, 0, { source: { id: threat.id } })
  assert.equal(compulsion.investigators[0].threat.length, 0, '09745：[action][action] 弃掉本卡')

  const reasoning = sharedState(1)
  callEncounter(reasoning, '09746')
  reasoning.investigators[0].willpower = 10
  reasoning.chaosBag = ['0']
  const card = reasoning.investigators[0].threat.find(item => item.code === '09746')
  callAbility(reasoning, '09746', 0, 0, { source: { id: card.id }, seat: 0 })
  assert.equal(reasoning.investigators[0].threat.length, 0, '09746：回合末意志检定成功后弃掉')

  const stuck = sharedState(1)
  callEncounter(stuck, '09746')
  stuck.investigators[0].willpower = 0
  stuck.chaosBag = ['0']
  const stuckCard = stuck.investigators[0].threat.find(item => item.code === '09746')
  callAbility(stuck, '09746', 0, 0, { source: { id: stuckCard.id }, seat: 0 })
  assert.equal(stuck.investigators[0].threat.length, 1, '09746：检定失败时保留')
})

// ---------------------------------------------------------------- 14. JSON 往返
test('P7 shared B JSON 往返：空洞/隐匿容器与条目结算在序列化后仍然一致', () => {
  const state = sharedState(1)
  const here = state.investigators[0].location
  setAsideHollow(state, '01020')
  placeEnemyMini(state, '09737', here)
  const clone = JSON.parse(JSON.stringify(state))
  assert.equal(hollowCount(clone, { scope: 'investigator', seat: 0 }), 1, '空洞记录随 JSON 往返')
  assert.equal(clone.scenarioFlags.mechanics.tsk.concealed.miniCards.length, 1, '隐匿迷你卡随 JSON 往返')

  // 序列化后的状态仍能被条目正常结算（异世界之触在克隆上放毁灭）。
  clone.investigators[0].assets = [{ id: 'clone-asset', code: '01020', exhausted: false }]
  let result
  transaction(clone, 0, draft => {
    result = entryOf('09744').encounterResolve(draft, draft.investigators[0], { code: '09744' }, hookApi(draft))
  })
  assert.notDeepEqual(result, { gainSurge: true })
  assert.equal(clone.investigators[0].assets[0].doom, 1, 'JSON 往返后条目仍可结算')
})
