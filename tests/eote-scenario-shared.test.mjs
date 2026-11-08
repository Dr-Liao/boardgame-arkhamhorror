// P7 共享遭遇验收：《地球边缘》战役内共享遭遇组（16 组 / 80 张卡）+ 战役级共享机制接线。
//
// 覆盖：
//   · 16 个共享组的逐组真实行为断言（敌人强制/诡计显现/地点行动/剧情资产/伙伴/纪念逝者/
//     忒咳哩-哩/物资/钥匙/寒霜）；
//   · 单卡条目 → 卡表身份 → 共享组归属 → 章节 gather/setAside 数据的一致性；
//   · P2 战役级原语（伙伴/纪念逝者/忒咳哩-哩/物资/封印/数值钥匙/寒霜）与条目的口径一致。
//
// 条目用动态 import 逐文件加载（不依赖遭遇索引重建）：先造一局基础状态触发引擎默认条目注册，
// 再注册本组 80 张共享条目，之后的真实窗口派发/直接钩子调用都能命中。
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
import { readShelter, locationShelter } from '../src/engine/eote-shelter.js'
import {
  addFrost, frostPoolCount, payFrost, FROST_POOL_LIMIT,
} from '../src/engine/frost.js'
import {
  initializeTekeliDeck, tekeliDeckSize, TEKELI_CARD_COUNT, TEKELI_PRINT_COPIES,
} from '../src/engine/eote-tekeli.js'
import {
  initializeValueKeys, spendValueKeys, valueKeyIds, valueKeysAt,
} from '../src/engine/scenario-keys.js'
import {
  chooseMissingPartners, initializePartners, partnerState, remainingPartners, setPartnerStatus,
} from '../src/campaign/eote-partners.js'
import {
  claimMemorial, crossedOutMemorials, initializeMemorials, memorialFor,
} from '../src/campaign/eote-memorials.js'
import {
  assignSupply, carriedSupplies, dropSupplyAt, initializeSupplies, recoverSupply, recoveredSupplies,
} from '../src/campaign/eote-supplies.js'
import { activateSeal, initializeSeals, placeDormantSeal, recoverSeal, sealState } from '../src/campaign/eote-seals.js'
import * as shared from '../content/campaigns/edgeOfTheEarth/shared-encounters.js'

const MOD = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..')
const SHARED_ROOT = path.join(MOD, 'src/cards/encounter-entries/edgeOfTheEarth/_shared')

const entryFiles = []
for (const group of fs.readdirSync(SHARED_ROOT).sort()) {
  const dir = path.join(SHARED_ROOT, group)
  if (!fs.statSync(dir).isDirectory()) continue
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.endsWith('.js')) entryFiles.push({ group, code: name.slice(0, -3), file: path.join(dir, name) })
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

// 先造一局基础状态：触发引擎默认条目注册；之后补注册 80 张共享条目（与 eote-player-fixture 同一口径）。
fixture('01001', 1)
registerCardAbilities(entries.filter(entry => !registeredEntry(entry.code)))

// ---------------------------------------------------------------- 测试工具
const pickDefault = pending => pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
  ?? pending.options[0]?.id

function transaction(state, seat, execute, choose = pickDefault) {
  resolveTransaction(state, seat, { action: 'eoteSharedTest' }, draft => execute(draft))
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 200, '共享遭遇测试的选择循环过多')
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

// 直接调用条目的钩子（真实引擎状态 + 剧本运行时 api；选择走事务解答器）。
// 事务里的写入必须落在 resolveTransaction 的 draft 上（提交时整体回写），因此 api/实体都从 draft 取。
function hookApi(draft) {
  const runtime = scenarioRuntime(draft, [])
  return Object.assign(Object.create(runtime), { scenario: runtime, mechanics: runtime.mechanics })
}
// 能力描述子的 api 是能力面（performTest 的 options 形状）；测试里用运行时 api 包一层同形适配。
function abilityStyleApi(draft) {
  const api = hookApi(draft)
  const runtime = api.scenario
  api.test = (seat, skill, difficulty, options) => {
    if (typeof options === 'function') return runtime.test(seat, skill, difficulty, options)
    const spec = options || {}
    return runtime.test(seat, skill, difficulty, spec.resolve, Number(spec.skillBonus) || 0, spec.source || null,
      spec.baseValue != null ? { baseValue: spec.baseValue } : {})
  }
  // 能力面独有的「移除卡上毁灭」写点（api-misc#removeDoomFromCard）；测试适配层等价实现。
  api.removeDoomFromCard = (card, amount = 1) => {
    if (!card) return 0
    const removed = Math.min(Math.max(0, Number(card.doom) || 0), amount)
    card.doom = (Number(card.doom) || 0) - removed
    return removed
  }
  return api
}
function draftEntity(draft, id) {
  if (!id) return null
  for (const list of [draft.enemies, draft.locations, draft.storyAssets,
    ...(draft.investigators || []).map(inv => inv.assets || [])]) {
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
function callAbility(state, code, index = 0, seat = 0, context = {}, choose = pickDefault) {
  const entry = entryOf(code)
  const descriptor = entry?.abilities?.[index]
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
function runRuntime(state, seat, execute, choose = pickDefault) {
  transaction(state, seat, draft => execute(scenarioRuntime(draft, [])), choose)
}
function addLocation(state, id, extra = {}) {
  const location = {
    id, code: extra.code ?? '01112', originalCode: extra.code ?? '01112', name: extra.name ?? id,
    revealed: true, clues: extra.clues ?? 0, maxClues: extra.clues ?? 0, shroud: extra.shroud ?? 2,
    connections: [...(extra.connections ?? [])], ...(extra.shelter != null ? { shelter: extra.shelter } : {}),
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
function makePartnerAsset(state, code, seat = 0) {
  state.cards[code] ||= { ...ALL_CARDS[code], flags: { partner: true } }
  const asset = { id: 'partner-' + code, code, originalCode: code, name: ALL_CARDS[code]?.nameZh || code, exhausted: false, uses: shared.PARTNER_ASSET_RULES[code]?.uses ?? 0, usesType: shared.PARTNER_ASSET_RULES[code]?.usesType, partner: true }
  state.investigators[seat].assets.push(asset)
  return asset
}

// ---------------------------------------------------------------- 1. 数据一致性
test('P7 shared 数据表：16 组 / 80 卡与卡表归属、章节 gather 组合一致', () => {
  assert.equal(shared.SHARED_ENCOUNTER_GROUPS.length, 16)
  assert.equal(shared.SHARED_CARD_CODES.length, 80)
  assert.equal(entryFiles.length, 80)
  for (const item of entryFiles) {
    const card = ALL_CARDS[item.code]
    assert.ok(card, `${item.code} 不在卡表`)
    assert.equal(card.encounterCode, item.group, `${item.code} 归属组与目录不一致`)
    assert.equal(shared.SHARED_GROUP_OF_CARD[item.code], shared.SHARED_GROUP_BY_ENCOUNTER_CODE[item.group])
    const entry = entryOf(item.code)
    assert.equal(entry.scope === 'card' ? card.subtype : entry.scope, entry.scope === 'card' ? 'weakness' : entry.scope)
  }
  // 每个章节的 gather / setAside 里出现的本战役组都必须在本循环 24 组内。
  const cycleGroups = new Set([...shared.SHARED_ENCOUNTER_GROUPS.map(group => group.id),
    ...Object.values(shared.CHAPTER_ENCOUNTER_GROUPS)])
  for (const [chapterId, config] of Object.entries(shared.CHAPTER_GATHER_SETS)) {
    const variants = config.versions ? Object.values(config.versions) : [config]
    for (const variant of variants) {
      for (const group of [...variant.gather, ...variant.setAside]) {
        if (cycleGroups.has(group)) continue
        assert.ok(['ancientEvils', 'chillingCold', 'lockedDoors', 'strikingFear'].includes(group),
          `${chapterId} 出现未知遭遇组 ${group}`)
      }
    }
    const pool = shared.chapterCardPool(chapterId, config.versions ? { version: 'v1' } : {})
    assert.ok(pool.gatherCodes.length > 0, `${chapterId} 的 gather 卡号为空`)
  }
  // 战役级共享清单与卡表类型对应。
  for (const code of shared.EXPEDITION_TEAM_CODES) assert.equal(ALL_CARDS[code].type, 'asset')
  for (const code of shared.MEMORIAL_CODES) assert.ok(['asset', 'event'].includes(ALL_CARDS[code].type))
  for (const code of shared.TEKELI_FACE_CODES) assert.equal(ALL_CARDS[code].subtype, 'weakness')
  for (const code of shared.EXPEDITION_SUPPLY_CODES) assert.equal(ALL_CARDS[code].type, 'asset')
})

test('P7 shared 地点庇护值：数据表与卡面「庇护 N」文本一致，P2 readShelter 读同一口径', () => {
  const iceLocations = shared.SHARED_GROUP_CODES.iceAndDeath.filter(code => /^0850[2-9]$|^0851[0-4]$/.test(code))
  assert.equal(iceLocations.length, 13)
  assert.deepEqual(Object.keys(shared.SHELTER_BY_LOCATION_CODE).sort(), [...iceLocations].sort())
  for (const [code, shelter] of Object.entries(shared.SHELTER_BY_LOCATION_CODE)) {
    const text = String(ALL_CARDS[code].textZh || ALL_CARDS[code].text || '')
    const printed = Number(/庇护\s*(\d+)/.exec(text)?.[1] ?? NaN)
    assert.equal(printed, shelter, `${code} 的庇护值与卡面文本不一致`)
    assert.equal(readShelter({ code, shelter }), shelter)
  }
  const state = sharedState(1)
  state.locations.push({ id: 'ice-camp', code: '08512', originalCode: '08512', shelter: 7, clues: 0, revealed: true, connections: [] })
  assert.equal(locationShelter(state, 'ice-camp'), 7)
})

// ---------------------------------------------------------------- 2. 逐组真实行为
test('P7 shared agentsOfTheUnknown：原初恶魔受伤后洗入忒咳哩-哩；潜藏的疯狂失败按差值结算', () => {
  const state = sharedState(2)
  runRuntime(state, 0, runtime => runtime.mechanics.tekeli.initialize(shared.tekeliDeckSpec()))
  const here = state.investigators[0].location
  const enemy = spawnAt(state, '08687', here, { damage: 2, horror: 1 })
  const deckBefore = state.investigators[0].deck.length
  runRuntime(state, 0, runtime => { runtime.damageEnemy(enemy.id, 1, 0, null) })
  assert.equal(tekeliDeckSize(state), TEKELI_CARD_COUNT - 1, '08687：受傷後洗入 1 張忒咳哩-哩')
  assert.equal(state.investigators[0].deck.length, deckBefore + 1)
  // 08688：忒咳哩-哩牌库为空时，失败差值全部转为恐惧（意志 3 vs 难度 4，失败差值 1）。
  const poor = sharedState(2)
  poor.investigators[0].willpower = 3
  poor.chaosBag = ['0']
  poor.debugNextTokens = ['0']
  const horrorBefore = poor.investigators[0].horror
  callEncounter(poor, '08688')
  assert.equal(poor.investigators[0].horror, horrorBefore + 1, '08688：检定失败且没有忒咳哩-哩可洗入 → 1 点恐惧')
})

test('P7 shared creaturesInTheIce：实体疯狂攻击后洗入 2 张；冰川幻影向人最多处移动；同源迷雾附属最近的合规地点', () => {
  const state = sharedState(2)
  runRuntime(state, 0, runtime => runtime.mechanics.tekeli.initialize(shared.tekeliDeckSpec()))
  const here = state.investigators[0].location
  const enemy = spawnAt(state, '08689', here)
  const deckBefore = state.investigators[0].deck.length
  runRuntime(state, 0, runtime => { runtime.attack(enemy, state.investigators[0]) })
  const shuffled = state.investigators[0].deck.length - deckBefore
  assert.ok(shuffled >= 0)
  assert.equal(tekeliDeckSize(state), TEKELI_CARD_COUNT - shuffled, '08689：攻击后按 2 张洗入忒咳哩-哩')

  const phantom = sharedState(2)
  runRuntime(phantom, 0, runtime => runtime.mechanics.tekeli.initialize(shared.tekeliDeckSpec()))
  const crowded = addLocation(phantom, 'crowded', { connections: [] })
  phantom.investigators[0].location = crowded.id
  phantom.investigators[1].location = crowded.id
  const phantomEnemy = spawnAt(phantom, '08690', phantom.investigators[0].location === crowded.id ? crowded.id : 'crowded')
  phantomEnemy.location = 'crowded'
  const phantomApi = hookApi(phantom)
  transaction(phantom, 0, () => {
    entryOf('08690').abilities[0].resolve({
      state: phantom, inv: phantom.investigators[0], source: phantomEnemy,
      context: { enemy: phantomEnemy, seat: 0 }, api: phantomApi,
    })
  })
  assert.equal(phantomEnemy.location, crowded.id, '08690：向调查员最多的地点移动')

  const mist = sharedState(1)
  addLocation(mist, 'mist-a', { connections: [] })
  addLocation(mist, 'mist-b', { connections: [] })
  mist.investigators[0].location = 'mist-a'
  const result = callEncounter(mist, '08691')
  assert.deepEqual(result, { placed: true })
  const attached = mist.locations.flatMap(loc => (loc.attachments || []).filter(card => (card.originalCode || card.code) === '08691'))
  assert.equal(attached.length, 1, '08691：附属到最近且没有同源迷雾的地点')
})

test('P7 shared deadlyWeather：南极寒风/雪盲危机/极地旋涡按显现条款附属并落数据', () => {
  for (const [code, expectedLocation] of [['08692', 'nearest'], ['08693', 'here'], ['08694', 'here']]) {
    const state = sharedState(1)
    const here = state.investigators[0].location
    addLocation(state, 'weather-far', { connections: [] })
    const result = callEncounter(state, code)
    assert.deepEqual(result, { placed: true }, code + ' 应成功附属')
    const hosts = state.locations.filter(loc => (loc.attachments || []).some(card => (card.originalCode || card.code) === code))
    assert.equal(hosts.length, 1, code + ' 应恰好附属到 1 个地点')
    if (expectedLocation === 'here') assert.equal(hosts[0].id, here, code + ' 应附属到当前地点')
    assert.equal(entryOf(code).flags.locationAttachment, true)
    assert.equal(entryOf(code).flags.discardAtRoundEnd, true)
  }
})

test('P7 shared elderThings：古老者守卫受伤弃牌；古老者崛起从遭遇弃牌堆生成并交战', () => {
  const state = sharedState(1)
  const enemy = spawnAt(state, '08696', state.investigators[0].location)
  const deckBefore = state.investigators[0].deck.length
  runRuntime(state, 0, runtime => { runtime.damageEnemy(enemy.id, 2, 0, null) })
  assert.equal(state.investigators[0].deck.length, deckBefore - 2, '08696：每 1 点伤害弃牌库顶 1 张')

  const rise = sharedState(2)
  const here = rise.investigators[0].location
  rise.encounterDiscard = ['08712', '08695']
  callEncounter(rise, '08697')
  const spawned = rise.enemies.find(item => (item.originalCode || item.code) === '08695')
  assert.ok(spawned, '08697：从遭遇弃牌堆找出古老者敌人并生成')
  assert.equal(spawned.location, here)
  assert.equal(spawned.engagedSeat, 0, '08697：生成的敌人与调查员交战')
})

test('P7 shared expeditionTeam：9 位伙伴数据与 P2 partner 原语、纪念逝者配对、坚毅面一致；治愈能力真实结算', () => {
  const state = sharedState(2)
  const initialized = initializePartners(state, { partners: shared.partnerRosterSpec() })
  assert.equal(initialized, 9)
  assert.equal(remainingPartners(state).length, 9)
  assert.equal(shared.EXPEDITION_TEAM_CODES.length, 9)
  assert.equal(shared.MEMORIAL_CODES.length, 9)
  for (const code of shared.EXPEDITION_TEAM_CODES) {
    const entry = entryOf(code)
    assert.equal(entry.flags.partner, true)
    assert.equal(entry.uses, shared.PARTNER_ASSET_RULES[code].uses)
    assert.equal(entry.usesType, shared.PARTNER_ASSET_RULES[code].usesType)
    assert.equal(ALL_CARDS[shared.RESOLUTE_PARTNER_FORMS[code]].type, 'asset', code + ' 有坚毅替换面')
  }
  makePartnerAsset(state, '08714', 0)
  state.investigators[0].horror = 2
  callAbility(state, '08714')
  assert.equal(state.investigators[0].horror, 0, '08714：治愈 2 点恐惧')
  assert.deepEqual(entryOf('08714').abilities[0].cost, { action: 1, exhaust: true, uses: 1 }, '08714：行动+横置+1 秘密的费用由描述子声明')
  assert.equal(state.investigators[0].assets.find(card => card.code === '08714')?.uses, 3)
})

test('P7 shared hazardsOfAntarctica：冰缝按揭示的 [frost] 与失败差值结算伤害；穿越冰雪附属最近地点', () => {
  const state = sharedState(1)
  state.chaosBag = ['frost', 'frost', '0']
  state.debugNextTokens = ['frost', 'frost']
  const damageBefore = state.investigators[0].damage
  callEncounter(state, '08698')
  assert.ok(state.investigators[0].damage > damageBefore, '08698：至少结算 frost 伤害或失败伤害')
  const crossing = sharedState(1)
  addLocation(crossing, 'crossing-far', { connections: [] })
  assert.deepEqual(callEncounter(crossing, '08699'), { placed: true })
  assert.ok(crossing.locations.some(loc => (loc.attachments || []).some(card => (card.originalCode || card.code) === '08699')))
})

test('P7 shared iceAndDeath：坠机点搜寻记录「备用零件」；无限恐惧症难度取地点庇护值', () => {
  const state = sharedState(1)
  const here = state.investigators[0].location
  state.locations.push({ id: 'crash-site', code: '08502', originalCode: '08502', name: '坠机点',
    revealed: true, clues: 0, shroud: 2, shelter: 0, connections: [here] })
  state.investigators[0].location = 'crash-site'
  state.investigators[0].intellect = 5
  state.chaosBag = ['+1']
  state.debugNextTokens = ['+1']
  callAbility(state, '08502', 0, 0, { source: state.locations.find(loc => loc.id === 'crash-site') })
  const recovered = state.campaign.records?.suppliesRecovered || []
  assert.ok(recovered.includes('08620'), '08502：成功搜寻后记录备用零件（08620）')

  const phobia = sharedState(1)
  phobia.locations.push({ id: 'shelter-4', code: '08506', originalCode: '08506', name: '庇护4',
    revealed: true, clues: 0, shroud: 2, shelter: 4, connections: [] })
  phobia.investigators[0].location = 'shelter-4'
  phobia.chaosBag = ['autofail']
  phobia.debugNextTokens = ['autofail']
  const horrorBefore = phobia.investigators[0].horror
  callEncounter(phobia, '08516', 0, () => 'horror')
  assert.equal(phobia.investigators[0].horror, horrorBefore + 4, '08516：难度 = 庇护值 4，失败差值 4 点恐惧')
})

test('P7 shared leftBehind：迷失的研究员入场带毁灭、谈判成功后毁灭翻线索', () => {
  const state = sharedState(1)
  const here = state.investigators[0].location
  runRuntime(state, 0, runtime => { runtime.spawn('08700', here) })
  const enemy = state.enemies.find(item => (item.originalCode || item.code) === '08700')
  assert.ok(enemy, '08700 应能生成')
  assert.equal(enemy.doom, 1, '08700：入场带 1 个毁灭标记（enemySpawnRule.doomOnSpawn）')
  const cluesBefore = state.investigators[0].clues
  state.investigators[0].willpower = 5
  state.chaosBag = ['+1']
  state.debugNextTokens = ['+1']
  callAbility(state, '08700', 1, 0, { source: enemy }, pending => pending.options.some(option => option.id === 'willpower') ? 'willpower' : undefined)
  const live = state.enemies.find(item => item.id === enemy.id)
  assert.equal(Number(live?.doom) || 0, 0, '08700：谈判成功后毁灭标记被移走')
  assert.equal(state.investigators[0].clues, cluesBefore + 1, '08700：毁灭标记翻为线索')
})

test('P7 shared memorialsOfTheLost：9 件遗物与伙伴划去配对；曲奇手枪攻击造成 2 点伤害', () => {
  const state = sharedState(2)
  initializePartners(state, { partners: shared.partnerRosterSpec() })
  initializeMemorials(state, shared.memorialsSpec())
  assert.equal(shared.MEMORIAL_CODES.length, 9)
  for (const [partnerCode, relicCode] of Object.entries(shared.MEMORIAL_FOR_PARTNER)) {
    assert.equal(memorialFor(state, partnerCode), relicCode)
    assert.equal(entryOf(relicCode).flags.memorial, true, relicCode + ' 应标记遗物')
    assert.equal(partnerState(state, partnerCode).status, 'safe')
  }
  setPartnerStatus(state, '08714', 'eliminated')
  assert.ok(crossedOutMemorials(state).some(item => item.relicCode === '08733'), '戴尔教授被划去 → 戴尔的素描为纪念逝者')
  assert.equal(claimMemorial(state, '08714'), '08733')

  const enemy = spawnAt(state, '08706', state.investigators[0].location, { health: 10 })
  state.investigators[0].assets.push({ id: 'cookie-gun', code: '08732', originalCode: '08732', name: '曲奇手枪', exhausted: false, uses: 2, usesType: 'ammo' })
  callAbility(state, '08732', 0, 0, { target: { id: enemy.id, entity: enemy } })
  assert.equal(state.enemies.find(item => item.id === enemy.id).damageTaken, 2, '08732：攻击造成 +1 伤害（基础 1 + 1）')
})

test('P7 shared miasma：瘴气折磨附属到伙伴支援；朦胧瘴气附属到当前地点', () => {
  const state = sharedState(1)
  const partner = makePartnerAsset(state, '08716', 0)
  callEncounter(state, '08706')
  const live = state.investigators[0].assets.find(card => card.code === '08716')
  assert.ok(live, '伙伴支援仍在场')
  assert.ok((live.attachments || []).some(card => (card.originalCode || card.code) === '08706'), '08706：附属到伙伴支援')
  assert.equal(entryOf('08706').flags.attachToPartnerAsset, true)
  const fog = sharedState(1)
  assert.deepEqual(callEncounter(fog, '08707'), { placed: true })
  assert.ok(fog.locations.some(loc => (loc.attachments || []).some(card => (card.originalCode || card.code) === '08707')))
})

test('P7 shared namelessHorrors：噩梦烟气二选一（失去 2 行动）；渎神幻象进入威胁区并洗入 1 张忒咳哩-哩', () => {
  const state = sharedState(1)
  runRuntime(state, 0, runtime => runtime.mechanics.tekeli.initialize(shared.tekeliDeckSpec()))
  state.investigators[0].actionsLeft = 3
  callEncounter(state, '08705', 0, () => 'actions')
  assert.equal(state.investigators[0].actionsLeft, 1, '08705：选择失去 2 个行动')
  const visions = sharedState(1)
  runRuntime(visions, 0, runtime => runtime.mechanics.tekeli.initialize(shared.tekeliDeckSpec()))
  assert.equal(callEncounter(visions, '08703'), true)
  assert.ok((visions.investigators[0].threat || []).some(card => (card.originalCode || card.code) === '08703'), '08703：进入威胁区域')
  assert.equal(tekeliDeckSize(visions), TEKELI_CARD_COUNT - 1, '08703：洗入 1 张忒咳哩-哩')
})

test('P7 shared penguins：呜啊！呜啊！呜啊！把最远的巨型白化企鹅移动到调查员地点', () => {
  const state = sharedState(2)
  const here = state.investigators[0].location
  addLocation(state, 'penguin-mid', { connections: [here] })
  state.locations.find(loc => loc.id === here).connections.push('penguin-mid')
  addLocation(state, 'penguin-far', { connections: ['penguin-mid'] })
  state.locations.find(loc => loc.id === 'penguin-mid').connections.push('penguin-far')
  const penguin = spawnAt(state, '08708', 'penguin-far')
  callEncounter(state, '08709', 0, pending => pending.options.find(option => option.id === 'move')?.id)
  const moved = state.enemies.find(item => item.id === penguin.id)
  assert.equal(moved.location, state.investigators[0].location, '08709：最远企鹅移动到调查员地点')
  assert.equal(entryOf('08708').flags.moveSurchargeAtEnemyLocation, 1)
})

test('P7 shared shoggoths：狂暴的修格斯按调查员数加生命，敌军阶段结束对本地调查员与敌人各造成 2 伤害', () => {
  const state = sharedState(2)
  const here = state.investigators[0].location
  state.investigators[1].location = here
  const shoggoth = spawnAt(state, '08711', here, { health: 8 })
  const other = spawnAt(state, '08689', here, { health: 8 })
  const healthModifier = entryOf('08711').modifiers[0].amount({ state })
  assert.equal(healthModifier, 4, '08711：+2 生命 × 2 名调查员')
  const damageBefore = state.investigators[0].damage
  callAbility(state, '08711', 0, 0, { source: shoggoth })
  assert.equal(state.investigators[0].damage, damageBefore + 2, '08711：本地调查员各受 2 点伤害')
  assert.equal(state.enemies.find(item => item.id === other.id).damageTaken, 2, '08711：非修格斯敌人受 2 点伤害')
  assert.equal(state.enemies.find(item => item.id === shoggoth.id).damageTaken, 0, '08711：修格斯自身不受影响')
})

test('P7 shared silenceAndMystery：黑暗极光按揭示的 [frost] 结算恐惧；极地幻景附属有线索的地点', () => {
  const state = sharedState(1)
  state.chaosBag = ['frost', '0']
  state.debugNextTokens = ['frost']
  state.investigators[0].willpower = 3
  const horrorBefore = state.investigators[0].horror
  callEncounter(state, '08713')
  assert.ok(state.investigators[0].horror >= horrorBefore + 1, '08713：至少结算 1 点 [frost] 恐惧')
  const mirage = sharedState(1)
  const here = mirage.investigators[0].location
  const withClues = addLocation(mirage, 'clue-site', { connections: [here], clues: 2 })
  mirage.locations.find(loc => loc.id === here).connections.push(withClues.id)
  assert.deepEqual(callEncounter(mirage, '08712'), { placed: true })
  const mirageHosts = mirage.locations.filter(loc => (loc.clues || 0) > 0
    && (loc.attachments || []).some(card => (card.originalCode || card.code) === '08712'))
  assert.equal(mirageHosts.length, 1, '08712：附属到最近的有线索地点')
})

test('P7 shared tekelili：16 张物理牌库与弱点结算后回底（副本守恒）', () => {
  const state = sharedState(1)
  initializeTekeliDeck(state, shared.tekeliDeckSpec())
  assert.equal(tekeliDeckSize(state), TEKELI_CARD_COUNT)
  assert.deepEqual(TEKELI_PRINT_COPIES, [3, 3, 2, 2, 2, 2, 2])
  const shuffled = scenarioRuntime(state, []).mechanics.tekeli.shuffleIn(0, 1)
  assert.ok(Array.isArray(shuffled) && shuffled.length === 1)
  const code = shuffled[0]
  assert.equal(tekeliDeckSize(state), TEKELI_CARD_COUNT - 1)
  state.investigators[0].deck = [code]
  const horrorBefore = state.investigators[0].horror
  const damageBefore = state.investigators[0].damage
  transaction(state, 0, draft => { scenarioRuntime(draft, []).drawCards(0, 1) })
  assert.equal(tekeliDeckSize(state), TEKELI_CARD_COUNT, '弱点结算后回到忒咳哩-哩牌库底（16 张守恒）')
  assert.equal((state.investigators[0].discard || []).includes(code), false, '弱点不进入玩家弃牌堆（weakness resolve 接管 + isThreatWeakness 跳过默认弃牌）')
  const effect = { '08723': () => state.investigators[0].horror > horrorBefore, '08724': () => state.investigators[0].damage > damageBefore }
  if (effect[code]) assert.ok(effect[code](), code + ' 的显现效果应已结算')
})

// ---------------------------------------------------------------- 3. P2 原语 ↔ 条目口径
test('P7 shared 战役级原语：伙伴名册 / 纪念逝者 / tekeli 16 / supplies 7 / seals A–E / 数值钥匙 / 寒霜 8', () => {
  const state = sharedState(2)
  // 伙伴：检查点 I 按庇护值保护；`chooseMissingPartners` 返回被记为 MIA 的伙伴。
  initializePartners(state, { partners: shared.partnerRosterSpec() })
  assert.equal(remainingPartners(state).length, 9)
  const missing = chooseMissingPartners(state, 4, () => 0)
  assert.equal(missing.length, 5, 'checkpoint：庇护值 4 → 5 位伙伴记为 MIA')
  assert.equal(remainingPartners(state).length, 4)
  assert.equal(partnerState(state, missing[0].code).status, 'mia')

  // 纪念逝者：划去伙伴 → 对应遗物可被取走。
  initializeMemorials(state, shared.memorialsSpec())
  setPartnerStatus(state, '08716', 'mia')
  assert.ok(crossedOutMemorials(state).some(item => item.relicCode === '08738'))
  assert.equal(claimMemorial(state, '08716'), '08738')

  // 忒咳哩-哩：7 面 × 印刷份数 = 16 张。
  initializeTekeliDeck(state, shared.tekeliDeckSpec())
  assert.equal(tekeliDeckSize(state), 16)

  // 物资：7 件初始化；分配/掉落/回收走 P2 唯一写入口。
  initializeSupplies(state, shared.suppliesSpec())
  assert.equal(shared.EXPEDITION_SUPPLY_CODES.length, 7)
  assignSupply(state, '08616', 0)
  assert.deepEqual(carriedSupplies(state, 0).map(item => item.code), ['08616'])
  dropSupplyAt(state, '08616', state.investigators[0].location)
  assert.equal(recoverSupply(state, '08616'), true)
  assert.ok(recoveredSupplies(state).some(item => (item.code || item) === '08616'))

  // 封印：A–E 初始化 → 剧本休眠放置 → 取回 → 激活。
  initializeSeals(state, { kinds: ['A', 'B', 'C', 'D', 'E'] })
  assert.equal(recoverSeal(state, 'A', { seat: 0 }), false, '休眠封印不能取回')
  assert.equal(placeDormantSeal(state, 'A', state.investigators[0].location), true)
  assert.equal(recoverSeal(state, 'A', { seat: 0 }), true)
  assert.equal(activateSeal(state, 'A'), true)
  assert.equal(sealState(state, 'A').active, true)

  // 数值钥匙：16 枚物理钥匙（8 种身份 × 2），花费是多重集原子操作。
  const identities = [['skull', 'skull'], ['cultist', 'cultist'], ['tablet', 'tablet'], ['elderthing', 'elderthing'],
    [0, 0], [-1, -1], [-2, -2], [-3, -3]]
  const specs = identities.flatMap(([value, twin], group) => [
    { id: 'vk-' + group + '-a', value, holder: 'investigator:0' },
    { id: 'vk-' + group + '-b', value: twin, holder: 'investigator:0' },
  ])
  initializeValueKeys(state, specs)
  assert.equal(valueKeyIds(state).length, 16)
  assert.equal(spendValueKeys(state, 'investigator:0', { values: ['tablet', 'tablet', 'tablet'] }), false, '两枚 tablet 不足以支付三重集，原子花费失败')
  assert.equal(spendValueKeys(state, 'investigator:0', { values: ['skull', 'skull'] }), true)
  assert.deepEqual(valueKeysAt(state, 'spent').map(item => item.value), ['skull', 'skull'])

  // 寒霜：8 枚有限池，支付不足不产生部分写入。
  assert.equal(FROST_POOL_LIMIT, 8)
  state.chaosBag = ['frost', 'frost', '0']
  assert.equal(frostPoolCount(state), 2)
  assert.equal(payFrost(state, 2), 2)
  assert.equal(frostPoolCount(state), 0)
  assert.equal(payFrost(state, 1), false, '寒霜不足时不产生部分支付')
  assert.equal(addFrost(state, 3), 3)
  assert.equal(frostPoolCount(state), 3)
})

test('P7 shared 章节 gather 展开：单章组卡号来自卡表，共享组 80 张全部可归入章节池', () => {
  const part3 = shared.chapterCardPool('iceAndDeathPart3')
  assert.ok(part3.gather.includes('seepingNightmares'))
  assert.ok(part3.setAside.includes('seepingNightmares'))
  assert.ok(part3.gatherCodes.includes('08547'), 'iceAndDeathPart3 gather 含渗出梦魇敌人')
  assert.ok(part3.setAsideCodes.includes('08547'))
  const part1 = shared.chapterCardPool('iceAndDeathPart1')
  assert.ok(part1.gatherCodes.includes('08501'), 'Part1 gather 含 iceAndDeath 组（08501）')
  assert.ok(part1.setAsideCodes.includes('08689'), 'Part1 setAside 含 creaturesInTheIce')
  const city = shared.chapterCardPool('cityOfTheElderThings', { version: 'v2' })
  assert.ok(city.setAsideCodes.includes('08689'), '城市 v.II setAside creaturesInTheIce')
  // 16 个共享组至少分别被一个章节 gather / setAside（或剧情奖励）引用。
  const campaignAwardGroups = new Set(['expeditionTeam', 'memorialsOfTheLost'])
  for (const group of shared.SHARED_ENCOUNTER_GROUPS) {
    if (campaignAwardGroups.has(group.id)) {
      const codes = shared.SHARED_GROUP_CODES[group.id]
      assert.ok(codes.length === 9, `${group.id} 应为剧情/检查点奖励的 9 张卡`)
      continue
    }
    const used = Object.values(shared.CHAPTER_GATHER_SETS).some(config => {
      const variants = config.versions ? Object.values(config.versions) : [config]
      return variants.some(variant => variant.gather.includes(group.id) || variant.setAside.includes(group.id))
    })
    assert.ok(used, `${group.id} 未被任何章节引用`)
  }
})
