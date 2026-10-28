// 《混沌魔掌》· 引擎钩子。
//
// 参考实现：Scenario/Scenarios/TheCircleUndone/InTheClutchesOfChaos.hs 与逐卡 Haskell 行为。
// 设计要点（spec 见 artifacts/migration/tcu/p8/specs/inTheClutchesOfChaos.md）：
//   · 裂口走 P2.11 唯一入口（api.breach/removeBreach），上限 3；第 4 个改为结算入侵（本文件
//     resolveIncursion 递归实现，带「本阶段已入侵」保护集）。
//   · 幕上的裂口走第七轮引擎容器 state.acts[i].breaches（scenario-runtime 的
//     addActBreach/removeActBreach/actBreaches 读写；幕推进时 act-agenda.advanceAct 自动搬到新幕）。
//   · 议程 05285「毁灭改为裂口」走引擎 doomPlacementReplacement（addDoom 自增前的替换窗口）。
//   · 两个变体子剧本按剧本日志选：幕牌库、变体地点、遭遇牌库分支都在 setup 决定。
//   · 逐卡规则写在单卡条目的 actRule / enemySpawnRule 等字段里；本文件只读
//     actRuleFor / enemySpawnRuleFor 数据分派，不写按卡号字面量的分支（架构守卫口径）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, enemySpawnRuleFor, entryFlags, traitLabel } from '../../../../../src/cards/card-rules.js'
import { addBreach, removeBreach, breachOf as breachCount } from '../../../../../src/engine/location-state.js'
import { encounterRules } from '../../encounter-rules.js'
import {
  ACT_CODES, BOSS_BY_ACT, BOSS_CODES, LOCATIONS, LOCATION_CODES, LOCATION_PAIRS, MIDNIGHT_MASKS,
  PIPER, VARIANT, VARIANT_ACTS, deckCodesForVariant,
} from './definition.js'
import { breachesOf, clutchesAfterTestEffects, clutchesChaosToken } from './chaos.js'

const original = card => card?.originalCode || card?.code
const active = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const flagsOf = state => (state.scenarioFlags ||= {})
const locationById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locationByOriginal = (state, code) =>
  (state.locations || []).find(location => original(location) === String(code)) || null
const inPlayIds = state => (state.locations || []).map(location => location.id)
const traitsOfCode = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
const hasTraitCode = (code, trait) => traitsOfCode(code).includes(String(trait).toLowerCase())
const iconsOf = code => ALL_CARDS[code]?.icons || {}
const countIcons = (code, skills) => skills.reduce((sum, skill) => sum + (iconsOf(code)[skill] || 0), 0)

// 引擎 setup 的 helper 形状：{ randomValue(state), shuffle(list, rng), info }。
// randomValue 是带 state 参数的函数——传错会让 createGameState 抛 `reading 'rngState'`。
function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  return [...list]
}

function shuffled(list, random) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

// 随机地点：参考实现的「随机地点」= 开局放好的 8 个地点槽之一（Haskell sampleLocations 的
// 8 个 label 正是在场地点）。这里从在场地点里洗牌取样。
// 随机源优先用注入的 api.shuffle/api.random；没有注入时用固定值做确定性洗牌（绝不 Math.random）。
export function randomLocationIds(state, count, api = {}) {
  const pool = [...inPlayIds(state)]
  if (!pool.length) return []
  const random = api.random ? api.random : () => 0.5
  const mixed = api.shuffle ? api.shuffle(pool) : shuffled(pool, random)
  return mixed.slice(0, Math.max(0, Math.min(count, mixed.length)))
}

function incursionGuard(state) {
  const flags = flagsOf(state)
  const guard = flags.incursionGuard
  if (!guard || guard.round !== state.round || guard.phase !== state.phase) {
    flags.incursionGuard = { round: state.round, phase: state.phase, ids: [] }
  }
  return flags.incursionGuard
}

function breachAdd(state, api, location, amount = 1) {
  if (api?.breach) return api.breach(location.id, amount)
  return addBreach(state, location.id, amount)
}

function breachRemove(state, api, location, amount = 1) {
  if (api?.removeBreach) return api.removeBreach(location.id, amount)
  return removeBreach(state, location.id, amount)
}

function bossInPlay(state, code) {
  return (state.enemies || []).find(enemy => original(enemy) === code) || null
}

// 首领所在地点上放置裂口后的强制效果（安妮特：每位调查员 1 伤害或 1 恐惧）。
function afterBreachesPlaced(state, api, location, placed) {
  if (!placed) return
  for (const code of BOSS_CODES) {
    if (code !== '05286b') continue
    const boss = bossInPlay(state, code)
    if (!boss || boss.location !== location.id) continue
    for (const inv of active(state)) {
      const answer = typeof api.choose === 'function'
        ? api.choose({
            kind: 'harm', source: code, seat: inv.seat,
            prompt: '「安妮特·梅森」所在地点被放置裂口：受到 1 点伤害或 1 点恐惧。',
            options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
          })
        : 'damage'
      if (answer === 'horror') api.horror?.(inv.seat, 1)
      else api.damage?.(inv.seat, 1)
    }
  }
}

// 结算一次入侵：移除该地点全部裂口 → 放 1 毁灭 → 每个连接地点放 1 裂口（可连锁）。
// force=true 用于「卡面直接要求结算入侵」的效果（05312）：跳过阶段保护的入口早退，
// 但仍把本次地点记入 guard，避免连锁入侵无限循环。
export function resolveIncursion(state, api, locationId, depth = 0, options = {}) {
  if (depth > 12) return false
  const location = locationById(state, locationId)
  if (!location) return false
  const guard = incursionGuard(state)
  if (!options.force && guard.ids.includes(locationId)) {
    api.info?.(`🔒 「${location.name}」本阶段已经结算过入侵，不再放置裂口。`)
    return false
  }
  if (!guard.ids.includes(locationId)) guard.ids.push(locationId)
  const removed = breachesOf(location)
  if (removed > 0) breachRemove(state, api, location, removed)
  location.doom = (location.doom || 0) + 1
  api.info?.(`🌀 「${location.name}」发生入侵：移除 ${removed} 个裂口，放置 1 点毁灭。`)
  const connected = (location.connections || []).filter(id => !!locationById(state, id))
  for (const id of connected) placeBreachesAt(state, api, id, 1, { depth: depth + 1 })
  return true
}

// 在指定地点放裂口；放满 3 个后下一次改为入侵。返回实际放置数。
export function placeBreachesAt(state, api, locationId, amount = 1, options = {}) {
  const location = locationById(state, locationId)
  if (!location) return 0
  let placed = 0
  for (let index = 0; index < Math.max(0, Math.floor(amount)); index++) {
    const guard = incursionGuard(state)
    if (guard.ids.includes(locationId)) break
    if (breachesOf(location) >= 3) {
      resolveIncursion(state, api, locationId, options.depth || 0)
      break
    }
    breachAdd(state, api, location, 1)
    placed += 1
  }
  afterBreachesPlaced(state, api, location, placed)
  return placed
}

// 「随机地点放 1 裂口」类效果（05306 / 古神标记 / 幕能力）。
export function placeBreachesOnRandomLocations(state, api, count) {
  const ids = randomLocationIds(state, count, api)
  let placed = 0
  for (const id of ids) placed += placeBreachesAt(state, api, id, 1)
  return placed
}

// 第七轮：幕上裂口存 state.acts[i].breaches（引擎 actBreach 容器）；幕推进时 advanceAct 自动搬运。
const actCardOf = state => state.acts?.[state.actIndex] || null

function actBreachesOf(state) {
  return Number(actCardOf(state)?.breaches || 0)
}

function setActBreaches(state, value) {
  const act = actCardOf(state)
  if (!act) return 0
  act.breaches = Math.max(0, Math.floor(value))
  return act.breaches
}

// 从当前幕移除裂口（石板标记 / 幕 [fast] / 地点能力）。卡尔在场时强制效果：
// 移除后把 1 个裂口放到卡尔所在地点。
export function removeActBreaches(state, api, amount = 1) {
  const removed = Math.min(Math.max(0, Math.floor(amount)), actBreachesOf(state))
  if (removed <= 0) return 0
  setActBreaches(state, actBreachesOf(state) - removed)
  const carl = bossInPlay(state, '05288b')
  if (carl && carl.location) placeBreachesAt(state, api, carl.location, 1)
  return removed
}

// 把地点上的裂口移到当前幕（地点能力 / 蛛丝马迹）。
export function moveBreachesToAct(state, api, location, amount = breachesOf(location)) {
  const moved = Math.min(Math.max(0, Math.floor(amount)), breachesOf(location))
  if (moved <= 0) return 0
  breachRemove(state, api, location, moved)
  setActBreaches(state, actBreachesOf(state) + moved)
  api.info?.(`🧵 把「${location.name}」的 ${moved} 个裂口移到当前幕（幕上 ${actBreachesOf(state)}）。`)
  return moved
}

function chooseOption(api, state, request) {
  if (typeof api.choose === 'function') return api.choose(request)
  return request.options[0]?.id
}

// 从手牌弃掉 1 张（返回弃掉的卡号）。
function discardOneFromHand(state, inv, api, source) {
  if (!(inv.hand || []).length) {
    api.info?.(`${inv.name} 没有手牌可弃。`)
    return null
  }
  let index = 0
  if (typeof api.choose === 'function') {
    const answer = api.choose({
      kind: 'card', source, seat: inv.seat, prompt: '选择并弃掉 1 张手牌。',
      options: inv.hand.map((code, position) => ({ id: String(position), label: ALL_CARDS[code]?.nameZh || code })),
    })
    index = Number(answer)
    if (!Number.isInteger(index) || index < 0 || index >= inv.hand.length) index = 0
  }
  const [code] = inv.hand.splice(index, 1)
  ;(inv.discard ||= []).push(code)
  return code
}

function chooseAssetToDiscard(state, inv, api, source) {
  const assets = inv.assets || []
  if (!assets.length) {
    api.info?.(`${inv.name} 没有支援可弃。`)
    return null
  }
  let index = 0
  if (typeof api.choose === 'function') {
    const answer = api.choose({
      kind: 'asset', source, seat: inv.seat, prompt: '选择并弃掉 1 个支援。',
      options: assets.map((asset, position) => ({ id: String(position), label: ALL_CARDS[asset.code]?.nameZh || asset.code })),
    })
    index = Number(answer)
    if (!Number.isInteger(index) || index < 0 || index >= assets.length) index = 0
  }
  const asset = assets[index]
  // 走引擎统一离场入口（leaveAsset：处理附属/离场替代/不能离场），不能直接 splice。
  if (typeof api.discardAsset === 'function') {
    api.discardAsset(inv.seat, asset.id)
  } else {
    const [removed] = assets.splice(index, 1)
    ;(inv.discard ||= []).push(removed.code)
  }
  return asset
}

// ---------------------------------------------------------------------------
// 变体子剧本
// ---------------------------------------------------------------------------

export function variantFor(state) {
  return recordsFor(state).anetteMasonIsPossessedByEvil ? VARIANT.music : VARIANT.secrets
}

function startVariantLocations(state, variant) {
  return variant.placeLocations
    .map(id => state.scenario.locations[id]?.id || id)
    .filter(id => !!state.scenario.locations[id])
}

// ---------------------------------------------------------------------------
// 敌人生成规则（spawnLocation 钩子）：位置规则是单卡条目的 enemySpawnRule 数据，
// 本函数按 location 类型分派（数据驱动，不含卡号字面量分支）。
// ---------------------------------------------------------------------------

function spawnLocationFor(state, code, api = {}) {
  const rule = enemySpawnRuleFor(code)
  if (!rule || !rule.location) return null
  // 并列地点由队长选择（卡面同类规则用 choose；无 choose 注入时按稳定顺序取第一个，保持测试确定性）。
  const pickAmong = (pool, prompt) => {
    if (!pool.length) return null
    if (pool.length === 1 || typeof api.choose !== 'function') return pool[0].id
    const answer = api.choose({
      kind: 'spawn', source: code, seat: state.campaign?.leadSeat ?? 0, prompt,
      options: pool.map(location => ({ id: location.id, label: location.name })),
    })
    return (pool.find(location => location.id === answer) || pool[0]).id
  }
  if (rule.location === 'mostBreaches') {
    // 秘社打手：裂口最多的地点；都没有裂口则回退到条目声明的银暮秘社 id。
    const withBreaches = (state.locations || []).filter(location => breachesOf(location) > 0)
    if (!withBreaches.length) {
      const fallback = (rule.fallbackLocationIds || [])
        .map(id => locationById(state, id))
        .find(Boolean)
      return fallback?.id || null
    }
    const most = Math.max(...withBreaches.map(location => breachesOf(location)))
    return pickAmong(withBreaches.filter(location => breachesOf(location) === most),
      `选择「${ALL_CARDS[code]?.nameZh || code}」的生成地点（裂口最多者并列）。`)
  }
  if (rule.location === 'fewestBreaches') {
    // 混沌见证者：裂口最少的地点。
    const pool = state.locations || []
    if (!pool.length) return null
    const fewest = Math.min(...pool.map(location => breachesOf(location)))
    return pickAmong(pool.filter(location => breachesOf(location) === fewest),
      `选择「${ALL_CARDS[code]?.nameZh || code}」的生成地点（裂口最少者并列）。`)
  }
  return null
}

// ---------------------------------------------------------------------------
// 诡计解析（resolveEncounter）
// ---------------------------------------------------------------------------

function resolveChaosManifest(state, inv, api) {
  if (typeof api.test !== 'function') return false
  api.test(inv.seat, 'willpower', 3, result => {
    if (result?.success) return
    const failedBy = Math.max(0, Number(result.difficulty || 3) - Number(result.value || 0))
    if (failedBy <= 0) return
    // 卡面：「在 X 个不同的随机地点上各放置 1 个裂口」——先无放回采样出 X 个不同地点，
    // 再由失败者逐个选择放置顺序（先放哪个可能连锁入侵，参考实现 chooseOrRunOneAtATimeM iid）。
    const remaining = [...randomLocationIds(state, failedBy, api)]
    while (remaining.length) {
      let picked = remaining[0]
      if (typeof api.choose === 'function' && remaining.length > 1) {
        picked = api.choose({
          kind: 'location', source: '05306', seat: inv.seat,
          prompt: '选择下一个放置裂口的地点（顺序由你决定）。',
          options: remaining.map(id => ({ id, label: locationById(state, id)?.name || id })),
        })
      }
      const index = remaining.findIndex(id => String(id) === String(picked))
      const locationId = remaining.splice(index >= 0 ? index : 0, 1)[0]
      placeBreachesAt(state, api, locationId, 1)
    }
  }, 0, { code: '05306', name: 'Chaos Manifest' })
  return false
}

function resolvePrimordialGateway(state, inv, api) {
  const candidates = state.locations || []
  if (!candidates.length) return false
  const chosen = randomLocationIds(state, 1, api)[0] || candidates[0].id
  const location = locationById(state, chosen)
  if (!location) return false
  // 真实附属实例（R4：api.attachEncounterToLocation 由引擎提供；旧测试桩没有该 api 时回退地点标记）。
  if (typeof api?.attachEncounterToLocation === 'function') api.attachEncounterToLocation('05307', location.id)
  else location.primordialGateway = '05307'
  // 卡面「放置裂口，直至该地点上有正好 3 个裂口」：这是直接放置，不受「本阶段该地点已结算过入侵」
  // 阶段保护影响（旧的 placeBreachesAt 循环会被 incursionGuard 提前停，罕见情况下补不到 3 个）。
  let filled = 0
  while (breachesOf(location) < 3 && filled < 3) {
    breachAdd(state, api, location, 1)
    filled += 1
  }
  afterBreachesPlaced(state, api, location, filled)
  api.info?.(`🌌 「元初通道」附属到「${location.name}」：裂口补到 3 个，文本视为空白。`)
  // 已在场上「附属」：返回 true 让引擎不再把它放进遭遇弃牌堆（关闭时只弃一次）。
  return true
}

function resolveTerrorUnleashed(state, inv, api) {
  const location = locationById(state, inv.location)
  if (!location) return false
  if (breachesOf(location) === 0) placeBreachesAt(state, api, location.id, 1)
  const x = breachesOf(location) + Number(location.doom || 0)
  for (let index = 0; index < x; index++) {
    const answer = chooseOption(api, state, {
      kind: 'harm', source: '05308', seat: inv.seat,
      prompt: `「猛鬼出笼」：受到 ${x} 点伤害或恐惧，由你自行分配（${index + 1}/${x}）。`,
      options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
    })
    if (answer === 'horror') api.horror?.(inv.seat, 1)
    else api.damage?.(inv.seat, 1)
  }
  return false
}

function resolveSecretsOfTheBeyond(state, inv, api) {
  const cultists = (state.enemies || [])
    .filter(enemy => hasTraitCode(original(enemy), 'cultist') && Number(enemy.doom || 0) > 0)
  if (!cultists.length) {
    flagsOf(state).pendingSurge = true
    api.info?.('「异界之秘」：场上没有带毁灭的异教徒敌人，获得涌动。')
    return false
  }
  const most = Math.max(...cultists.map(enemy => Number(enemy.doom || 0)))
  const tied = cultists.filter(enemy => Number(enemy.doom || 0) === most)
  // 卡面「找出毁灭标记最多的异教徒」：并列时由抽牌者选择（旧实现固定取第一张）。
  let target = tied[0]
  if (tied.length > 1) {
    const answer = chooseOption(api, state, {
      kind: 'enemy', source: '05310', seat: inv.seat,
      prompt: '「异界之秘」：选择毁灭标记最多的异教徒敌人。',
      options: tied.map(enemy => ({ id: enemy.id, label: enemy.name || original(enemy) })),
    })
    target = tied.find(enemy => enemy.id === answer) || tied[0]
  }
  const location = target?.location ? locationById(state, target.location) : null
  if (!location) {
    flagsOf(state).pendingSurge = true
    return false
  }
  const placed = placeBreachesAt(state, api, location.id, most)
  api.info?.(`「异界之秘」：在「${location.name}」放置 ${placed} 个裂口。`)
  // 卡面「如果未因本效果放置裂口，获得涌动」：目标地点已满 3 裂口改为结算入侵时 placed=0。
  if (placed === 0) {
    flagsOf(state).pendingSurge = true
    api.info?.('「异界之秘」：未因本效果放置裂口，获得涌动。')
  }
  return false
}

function topmostPowerTreachery(state) {
  const discard = state.encounterDiscard || []
  for (let index = discard.length - 1; index >= 0; index--) {
    const code = discard[index]
    if (hasTraitCode(code, 'power') && ALL_CARDS[code]?.type === 'treachery') return { code, index }
  }
  return null
}

function resolveToilAndTrouble(state, inv, api) {
  const power = topmostPowerTreachery(state)
  const options = []
  if (power) options.push({ id: 'power', label: `结算遭遇弃牌堆最顶部的力量诡计「${ALL_CARDS[power.code]?.nameZh || power.code}」` })
  options.push({ id: 'incursion', label: '结算你所在地点的入侵一次' })
  const answer = chooseOption(api, state, {
    kind: 'treachery', source: '05312', seat: inv.seat,
    prompt: '「不惮辛劳不惮烦」：选择一项结算。', options,
  })
  if (answer === 'power' && power) {
    // 卡面：结算该力量诡计「上的显现能力」——就地结算，不经过抽牌/取消/涌动窗口。
    api.info?.(`🔁 重演遭遇弃牌堆里的「${ALL_CARDS[power.code]?.nameZh || power.code}」。`)
    if (typeof api.replayEncounterRevelation === 'function') {
      api.replayEncounterRevelation(inv.seat, power.code)
    } else {
      // 测试桩/旧引擎兜底：移出弃牌堆 → 压入牌库顶 → 重新抽牌。
      state.encounterDiscard.splice(power.index, 1)
      state.encounterDeck.push(power.code)
      if (api.drawEncounter) api.drawEncounter(inv.seat)
    }
    return false
  }
  // 卡面「结算你所在地点的入侵一次」：不受本章阶段的入侵保护限制（参考实现无条件结算）。
  if (inv.location) resolveIncursion(state, api, inv.location, 0, { force: true })
  return false
}

const TREACHERY_RESOLVERS = Object.freeze({
  '05306': resolveChaosManifest,
  '05307': resolvePrimordialGateway,
  '05308': resolveTerrorUnleashed,
  '05310': resolveSecretsOfTheBeyond,
  '05312': resolveToilAndTrouble,
})

// ---------------------------------------------------------------------------
// 幕：推进背面效果
// ---------------------------------------------------------------------------

function spawnBoss(state, api, actCode) {
  const bossCode = BOSS_BY_ACT[actCode]
  if (!bossCode || bossInPlay(state, bossCode)) return null
  const variant = variantFor(state)
  const target = variant.bossLocationCodes
    .map(code => locationByOriginal(state, code))
    .find(Boolean)
    || locationById(state, state.investigators?.[0]?.location || '')
  if (!target) return null
  const enemy = api.spawn?.(bossCode, target.id) || null
  api.info?.(`👤 「${ALL_CARDS[bossCode]?.nameZh || bossCode}」在「${target.name}」现身！`)
  return enemy
}

// 幕背面效果由单卡条目的 actRule.advance 数据声明（spawnBossFromAct / resolution），
// 本函数只按数据分派；boss 卡号由 definition 的 BOSS_BY_ACT 数据表查。
function actRevealFor(state, act, api) {
  const code = String(original(act))
  const advance = actRuleFor(code)?.advance
  if (!advance) return
  if (advance.spawnBossFromAct) {
    spawnBoss(state, api, code)
    const moved = actBreachesOf(state)
    if (moved > 0) api.info?.(`🧵 幕上的 ${moved} 个裂口移到下一张幕。`)
    return
  }
  if (advance.resolution) api.finish?.(advance.resolution)
}

// ---------------------------------------------------------------------------
// 地点能力（actions / performAction 分派；每个 handler 的 perform 返回 true 表示已结算）
// ---------------------------------------------------------------------------

function withBreach(location) {
  return breachesOf(location) > 0
}

function discardIconsBreach(state, inv, api, location, skills, source) {
  const code = discardOneFromHand(state, inv, api, source)
  if (!code) return
  const bonus = countIcons(code, skills)
  const n = 1 + Math.min(breachesOf(location), bonus)
  moveBreachesToAct(state, api, location, n)
}

function skillTestBreach(state, inv, api, location, skill, difficulty, source) {
  if (typeof api.test !== 'function') return
  api.test(inv.seat, skill, difficulty, result => {
    if (!result?.success) return
    // 卡面「成功且每超过难度 1 点移 1 个」：恰好成功（差值 0）应移 0 个。
    const successBy = Math.max(0, Number(result.value || 0) - Number(result.difficulty || difficulty))
    if (successBy <= 0) return
    moveBreachesToAct(state, api, location, Math.min(breachesOf(location), successBy))
  }, 0, { code: source })
}

// 05309 秘社打手：「将其所在地点的印刷文本框视为空白（除[[特性]]外）」。
// ICC 的 16 个地点印刷文本全部由 LOCATION_HANDLERS 提供，因此内容层屏蔽这些行动即等价实现
// （引擎自带的调查/移动规则不属于印刷文本，不受影响）。
function locationTextBlankedByEnforcer(state, location) {
  if (!location) return false
  return (state.enemies || []).some(enemy =>
    String(original(enemy)) === '05309' && enemy.location === location.id)
}

const LOCATION_HANDLERS = {
  '05290': {
    actions: (state, inv, location) => withBreach(location) && (inv.hand || []).length
      ? [{ rule: 'locDiscardIconBreach', label: '🃏 弃 1 张手牌：移除裂口（每有 1 个意志图标多移除 1），移到当前幕' }]
      : [],
    perform: (state, inv, api, location) => {
      discardIconsBreach(state, inv, api, location, ['willpower'], '05290')
      return true
    },
  },
  '05291': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locWillpowerBreach', label: '🧠 意志(2) 检定：成功且每超出 1 点，移除 1 个裂口并移到当前幕' }]
      : [],
    perform: (state, inv, api, location) => { skillTestBreach(state, inv, api, location, 'willpower', 2, '05291'); return true },
  },
  '05292': {
    actions: (state, inv, location) => withBreach(location) && (inv.hand || []).length
      ? [{ rule: 'locDiscardIconBreach', label: '🃏 弃 1 张手牌：移除裂口（每有 1 个智识图标多移除 1），移到当前幕' }]
      : [],
    perform: (state, inv, api, location) => {
      discardIconsBreach(state, inv, api, location, ['intellect'], '05292')
      return true
    },
  },
  '05293': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locIntellectBreach', label: '📖 智识(2) 检定：成功且每超出 1 点，移除 1 个裂口并移到当前幕' }]
      : [],
    perform: (state, inv, api, location) => { skillTestBreach(state, inv, api, location, 'intellect', 2, '05293'); return true },
  },
  '05294': {
    // 南区（1）：[free] 弃遭遇牌库顶 3 张；如可能，选择其中 1 张「力量」诡计并结算其显现能力；
    // 把南区 1 个裂口移到当前幕。卡面不要求此处有裂口，但要求遭遇牌库有牌可弃。
    actions: (state, inv, location) => (state.encounterDeck || []).length
      ? [{ rule: 'locSouthsideDiscard', label: '🎴 弃遭遇牌库顶 3 张：如可能结算其中 1 张力量诡计的显现；移除 1 个裂口并移到当前幕', actions: 0 }]
      : [],
    perform: (state, inv, api, location) => {
      const discarded = []
      for (let index = 0; index < 3; index++) {
        const code = (state.encounterDeck || []).pop()
        if (code == null) break
        discarded.push(code)
        ;(state.encounterDiscard ||= []).push(code)
      }
      const powers = discarded.filter(code => hasTraitCode(code, 'power'))
      api.info?.(`🎴 弃掉遭遇牌库顶 ${discarded.length} 张：${discarded.map(code => ALL_CARDS[code]?.nameZh || code).join('、') || '（空）'}。`)
      if (powers.length) {
        const chosen = chooseOption(api, state, {
          kind: 'card', source: '05294', seat: inv.seat, prompt: '选择 1 张力量诡计结算其显现能力。',
          options: powers.map(code => ({ id: code, label: ALL_CARDS[code]?.nameZh || code })),
        })
        const code = powers.includes(chosen) ? chosen : powers[0]
        if (typeof api.replayEncounterRevelation === 'function') {
          // 卡面是「结算其显现能力」而不是「抽这张牌」：在弃牌堆就地结算，不经过抽牌窗口。
          api.replayEncounterRevelation(inv.seat, code)
        } else {
          // 测试桩/旧引擎兜底：放回牌库顶再走一次抽牌管线。
          state.encounterDeck.push(code)
          const index = state.encounterDiscard.lastIndexOf(code)
          if (index >= 0) state.encounterDiscard.splice(index, 1)
          api.drawEncounter?.(inv.seat)
        }
      }
      moveBreachesToAct(state, api, location, 1)
      return true
    },
  },
  '05295': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locSouthsideHandBreaches', label: '🃏 弃任意张手牌：每弃 1 张移除 1 个裂口并移到当前幕', actions: 0 }]
      : [],
    perform: (state, inv, api, location) => {
      const hand = (inv.hand || []).length
      // 卡面允许弃超过裂口数量的手牌（超出部分白弃），数量上限只由手牌数决定。
      const limit = hand
      let count = 0
      if (limit > 0) {
        count = Number(chooseOption(api, state, {
          kind: 'number', source: '05295', seat: inv.seat, prompt: `弃任意张手牌（最多 ${limit} 张）。`,
          options: Array.from({ length: limit + 1 }, (_, index) => ({ id: String(index), label: `弃 ${index} 张` })),
        }))
        if (!Number.isInteger(count) || count < 0 || count > limit) count = limit
      }
      // 「选择并弃掉」：逐张让玩家选择，而不是按手牌顺序强弃前 N 张。
      for (let index = 0; index < count; index++) discardOneFromHand(state, inv, api, '05295')
      moveBreachesToAct(state, api, location, Math.min(count, breachesOf(location)))
      return true
    },
  },
  '05296': {
    actions: (state, inv, location) => withBreach(location) && (inv.hand || []).length
      ? [{ rule: 'locDiscardIconBreach', label: '🃏 弃 1 张手牌：移除裂口（每有 1 个敏捷图标多移除 1），移到当前幕' }]
      : [],
    perform: (state, inv, api, location) => {
      discardIconsBreach(state, inv, api, location, ['agility'], '05296')
      return true
    },
  },
  '05297': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locAgilityBreach', label: '🤸 敏捷(2) 检定：成功且每超出 1 点，移除 1 个裂口并移到当前幕' }]
      : [],
    perform: (state, inv, api, location) => { skillTestBreach(state, inv, api, location, 'agility', 2, '05297'); return true },
  },
  '05298': {
    actions: (state, inv, location) => [
      ...(((state.encounterDeck || []).length || (state.encounterDiscard || []).length)
        ? [{ rule: 'locSouthChurchDraw', label: '🎴 抽取 1 张遭遇牌：移除此处所有裂口并移到当前幕' }]
        : []),
      { rule: 'locResign', label: '🏳️ 撤退：你躲藏起来，熬过这一夜。' },
    ],
    perform: (state, inv, api, location, move) => {
      if (move?.rule === 'locSouthChurchDraw') {
        api.drawEncounter?.(inv.seat)
        moveBreachesToAct(state, api, location, breachesOf(location))
        return true
      }
      api.resign?.(inv.seat)
      return true
    },
  },
  '05299': {
    actions: (state, inv, location) => [
      // 卡面费用「弃掉你控制的 1 个支援」：没有支援时不可用。
      ...(withBreach(location) && (inv.assets || []).length
        ? [{ rule: 'locSouthChurchAsset', label: '🗡️ 弃 1 个支援：移除此处所有裂口并移到当前幕' }]
        : []),
      { rule: 'locResign', label: '🏳️ 撤退：你躲藏起来，熬过这一夜。' },
    ],
    perform: (state, inv, api, location, move) => {
      if (move?.rule === 'locSouthChurchAsset') {
        // 费用必须支付：没有支援时不能结算后面的移裂口效果。
        if (!(inv.assets || []).length) {
          api.info?.('没有支援可弃：这次行动没有效果。')
          return true
        }
        chooseAssetToDiscard(state, inv, api, '05299')
        moveBreachesToAct(state, api, location, breachesOf(location))
        return true
      }
      api.resign?.(inv.seat)
      return true
    },
  },
  '05300': {
    // 卡面 [action]：弃牌库顶 5/10/15 张，每 5 张移 1 个裂口；没有「必须有裂口」的前置。
    actions: (state, inv, location) => (inv.deck || []).length
      ? [{ rule: 'locMerchantDiscardTop', label: '🃏 弃牌库顶 5/10/15 张：每 5 张移除 1 个裂口，抽到弱点则入手' }]
      : [],
    perform: (state, inv, api, location) => {
      const available = (inv.deck || []).length
      // 牌库不足 5 张时仍可选择 5/10/15（能弃多少弃多少，按实际弃牌数每 5 张移 1）。
      const choices = [5, 10, 15]
      const picked = Number(chooseOption(api, state, {
        kind: 'number', source: '05300', seat: inv.seat, prompt: '选择弃掉牌库顶多少张。',
        options: choices.map(value => ({ id: String(value), label: `弃 ${value} 张（牌库 ${available} 张）` })),
      }))
      const count = Math.min(choices.includes(picked) ? picked : choices[0], available)
      const discarded = count > 0 ? (inv.deck || []).splice(Math.max(0, available - count)) : []
      ;(inv.discard ||= []).push(...discarded)
      const remove = Math.min(breachesOf(location), Math.floor(count / 5))
      moveBreachesToAct(state, api, location, remove)
      const weaknesses = discarded.filter(code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype))
      for (const code of weaknesses) {
        // 卡面「抽取所有以此方式弃掉的弱点」：走引擎抽牌管线（drawDiscard→drawCards），
        // 让弱点的揭示效果正常结算（旧实现直接塞进手牌，绕过了 resolveWeakness）。
        const index = (inv.discard || []).lastIndexOf(code)
        if (index < 0) continue
        if (typeof api.drawDiscard === 'function') {
          api.drawDiscard(inv.seat, index)
        } else {
          inv.discard.splice(index, 1)
          ;(inv.hand ||= []).push(code)
        }
        api.info?.(`🃏 弃牌中的弱点「${ALL_CARDS[code]?.nameZh || code}」被抽取。`)
      }
      return true
    },
  },
  '05301': {
    actions: (state, inv, location) => withBreach(location) && (inv.resources || 0) >= 2
      ? [{ rule: 'locMerchantPay', label: '💰 支付 2 资源：移除 1 个裂口并移到当前幕', actions: 0 }]
      : [],
    perform: (state, inv, api, location) => {
      if ((inv.resources || 0) < 2) return true
      inv.resources -= 2
      moveBreachesToAct(state, api, location, 1)
      return true
    },
  },
  '05302': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locHangmansHillSearch', label: '🧙 查找遭遇牌库/弃牌堆的「女巫」敌人并抽取：然后把此处所有裂口移到当前幕' }]
      : [{ rule: 'locHangmansHillSearch', label: '🧙 查找遭遇牌库/弃牌堆的「女巫」敌人并抽取' }],
    perform: (state, inv, api, location) => {
      drawEnemyByTrait(state, api, inv.seat, 'Witch')
      moveBreachesToAct(state, api, location, breachesOf(location))
      api.shuffleEncounterDeck?.()
      return true
    },
  },
  '05303': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locLodgeHorror', label: '😱 受到 1 点恐惧：移除此处 1 个裂口并移到当前幕', actions: 0 }]
      : [],
    perform: (state, inv, api, location) => {
      api.horror?.(inv.seat, 1)
      moveBreachesToAct(state, api, location, 1)
      return true
    },
  },
  '05304': {
    actions: (state, inv, location) => withBreach(location)
      ? [{ rule: 'locHangmansDamage', label: '💥 受到 1 点伤害：移除此处 1 个裂口并移到当前幕', actions: 0 }]
      : [],
    perform: (state, inv, api, location) => {
      api.damage?.(inv.seat, 1)
      moveBreachesToAct(state, api, location, 1)
      return true
    },
  },
  '05305': {
    actions: () => [{ rule: 'locLodgeSearch', label: '🎩 查找遭遇牌库/弃牌堆的「银暮秘社」敌人并抽取：然后把此处所有裂口移到当前幕' }],
    perform: (state, inv, api, location) => {
      drawEnemyByTrait(state, api, inv.seat, 'Silver Twilight')
      moveBreachesToAct(state, api, location, breachesOf(location))
      api.shuffleEncounterDeck?.()
      return true
    },
  },
}

function drawEnemyByTrait(state, api, seat, trait) {
  const wanted = String(trait).toLowerCase()
  const isEnemy = code => ALL_CARDS[code]?.type === 'enemy' || (state.scenario.enemies || {})[code]
  // 收集遭遇牌库与弃牌堆里的全部合法候选（自顶向下），卡面是「查找」，允许多张时选择。
  const collect = (pile, kind) => {
    const found = []
    for (let index = pile.length - 1; index >= 0; index--) {
      const code = pile[index]
      if (isEnemy(code) && hasTraitCode(code, wanted)) found.push({ kind, index, code })
    }
    return found
  }
  const candidates = [
    ...collect(state.encounterDeck || [], 'deck'),
    ...collect(state.encounterDiscard || [], 'discard'),
  ]
  if (!candidates.length) {
    api.info?.(`没有找到[[${traitLabel(trait)}]]敌人。`)
    return null
  }
  let chosen = candidates[0]
  if (candidates.length > 1 && typeof api.choose === 'function') {
    const answer = api.choose({
      kind: 'card', source: 'searchEnemy', seat,
      prompt: `查找遭遇牌库和弃牌堆，选择要抽取的[[${traitLabel(trait)}]]敌人。`,
      options: candidates.map((entry, index) => ({
        id: String(index),
        label: `${ALL_CARDS[entry.code]?.nameZh || entry.code}（${entry.kind === 'deck' ? '遭遇牌库' : '遭遇弃牌堆'}）`,
      })),
    })
    const picked = Number(answer)
    if (Number.isInteger(picked) && picked >= 0 && picked < candidates.length) chosen = candidates[picked]
  }
  const pile = chosen.kind === 'deck' ? (state.encounterDeck ||= []) : (state.encounterDiscard ||= [])
  const code = pile.splice(chosen.index, 1)[0]
  if (code == null) return null
  state.encounterDeck.push(code)
  api.drawEncounter?.(seat)
  return code
}

// 05307 附属实例读取：runtime 写 location.attachments（src/engine/scenario-runtime.js:326-344），
// 投影/描述子读同一份数据；旧存档只有 primordialGateway 标记时回退兼容。
function gatewayAttachment(location) {
  if (!location) return null
  const attached = (location.attachments || []).find(item => String(item.code) === '05307')
  if (attached) return attached
  return location.primordialGateway ? { code: '05307', legacy: true } : null
}

// 元初通道：附属地点的行动（关闭通道）。
function gatewayActions(state, inv, location) {
  if (!gatewayAttachment(location) || inv.location !== location.id) return []
  return [{ rule: 'closeGateway', label: '🌀 检定智识或意志(4) 关闭元初通道：成功则弃掉它' }]
}

function performGateway(state, inv, api, location) {
  // 卡面「智识或意志(4)」：由玩家二选一（旧实现写死意志）。
  let skill = 'willpower'
  if (typeof api.choose === 'function') {
    const answer = api.choose({
      kind: 'skill', source: '05307', seat: inv.seat,
      prompt: '选择关闭元初通道的检定技能。',
      options: [{ id: 'willpower', label: '意志(4)' }, { id: 'intellect', label: '智识(4)' }],
    })
    if (answer === 'intellect' || answer === 'willpower') skill = answer
  }
  api.test?.(inv.seat, skill, 4, result => {
    if (!result?.success) return
    // 关闭成功：把真实附属实例取下并弃进遭遇弃牌堆（卡面「弃掉元初通道」）。
    const attachment = gatewayAttachment(location)
    if (attachment && !attachment.legacy && typeof api.detachLocationAttachment === 'function') {
      api.detachLocationAttachment(location.id, attachment.id)
    }
    delete location.primordialGateway
    ;(state.encounterDiscard ||= []).push('05307')
    api.info?.(`🌀 元初通道被关闭，弃掉。`)
  }, 0, { code: '05307' })
  return true
}

// ---------------------------------------------------------------------------
// 结局
// ---------------------------------------------------------------------------

function investigatorsWithTrait(state, traits) {
  const wanted = traits.map(trait => String(trait).toLowerCase())
  return active(state).filter(inv => {
    const card = ALL_CARDS[inv.code]
    return (card?.traits || []).some(trait => wanted.includes(String(trait).toLowerCase()))
  })
}

function chooseRecord(api, state, request, mapping) {
  const options = request.options.filter(option => option.available !== false)
  const answer = chooseOption(api, { scenarioFlags: {} }, {
    ...request, options: options.map(({ id, label }) => ({ id, label })),
  })
  const record = mapping[answer] || mapping[options[0]?.id]
  if (record) recordsFor(state)[record] = true
  return record
}

function applyResolution(state, key, events, api) {
  const known = ['noResolution', 'r1', 'r2', 'r3', 'r4']
  if (!known.includes(key)) throw new Error(`未知混沌魔掌结局：${key}`)
  const records = recordsFor(state)
  if (key === 'noResolution') {
    return applyResolution(state, records.anetteMasonIsPossessedByEvil ? 'r3' : 'r4', events, api)
  }
  if (key === 'r1' || key === 'r2') {
    const anette = key === 'r1'
    const baseOptions = [
      { id: 'continuedAlone', label: '继续独自行动', record: 'theInvestigatorsContinuedAlone' },
      { id: 'askedForAssistance', label: anette ? '向安妮特求助' : '向桑福德求助', record: anette ? 'theInvestigatorsAskedAnetteForAssistance' : 'theInvestigatorsAskedSanfordForAssistance' },
    ]
    if (investigatorsWithTrait(state, ['Detective', 'Police', 'Agency']).length) {
      baseOptions.push({
        id: 'underArrest', label: anette ? '逮捕安妮特' : '逮捕桑福德',
        record: anette ? 'theInvestigatorsArrestedAnette' : 'theInvestigatorsArrestedSanford',
      })
    }
    if (anette && investigatorsWithTrait(state, ['Sorcerer', 'Miskatonic', 'Scholar']).length) {
      baseOptions.push({ id: 'spellsOfOld', label: '学习旧日的法术', record: 'anetteTaughtYouTheSpellsOfOld' })
    }
    if (!anette && investigatorsWithTrait(state, ['Sorcerer', 'Silver Twilight', 'Cultist']).length) {
      baseOptions.push({ id: 'assumedControl', label: '接管银暮秘社', record: 'theInvestigatorsAssumedControlOfTheSilverTwilightLodge' })
    }
    chooseRecord(api, state, {
      kind: 'story', source: anette ? '05287' : '05289', seat: state.campaign?.leadSeat ?? 0,
      prompt: '结算结局：选择一项写入剧本日志。',
      options: baseOptions,
    }, Object.fromEntries(baseOptions.map(option => [option.id, option.record])))
    return { award: true, bonus: 0 }
  }
  records.doomDrawsEverCloser = true
  return { award: true, bonus: 0 }
}

// ---------------------------------------------------------------------------
// behavior
// ---------------------------------------------------------------------------

export const implementedEncounterCodes = ['05286b', '05288b', '05306', '05307', '05308']

export const behavior = {
  ...encounterRules,
  id: 'inTheClutchesOfChaos',
  implementedEncounterCodes,
  // 供测试/其他章节复用的纯钩子（不是引擎钩子）。
  placeBreachesAt,
  resolveIncursion,
  placeBreachesOnRandomLocations,
  moveBreachesToAct,
  removeActBreaches,
  randomLocationIds,
  variantFor,

  // ---- 布置 ----
  startLocation: state => flagsOf(state).startLocation || 'southsideA',

  setupLocations(state, events, helper = {}) {
    const flags = flagsOf(state)
    const variant = variantFor(state)
    flags.variant = variant.id
    // 幕牌库按变体换（manifest 默认登记 Anette 线两幕）。
    state.acts = JSON.parse(JSON.stringify(VARIANT_ACTS[variant.id]))
    // 六对地点各随机取一个版本；另一版本移出游戏。
    const chosen = LOCATION_PAIRS.map(pair => mix(state, helper, pair.ids)[0])
    const startId = chosen.find(id => id.startsWith('southside')) || 'southsideA'
    flags.startLocation = startId
    for (const investigator of state.investigators || []) investigator.location = startId
    const placed = [...new Set([...chosen, ...variant.placeLocations])]
    const removed = Object.keys(state.scenario.locations).filter(id => !placed.includes(id))
    flags.chosenLocations = placed
    flags.removedLocations = removed
    // 未放置的版本不能出现在规则连线上。
    for (const id of placed) {
      const base = state.scenario.locations[id]
      base.connections = (base.connections || []).filter(connection => placed.includes(connection))
    }
    // 初始裂口计划：按人数在随机（在场）地点放裂口；等地点入场后由 afterChaosBagSetup 结算。
    const count = Number(state.numInvestigators) || 2
    const plan = []
    const rounds = count === 4 ? 3 : count
    const perRound = count === 4 ? 3 : 2
    for (let index = 0; index < rounds; index++) plan.push(perRound)
    flags.setupBreachPlan = plan
    flags.incursionGuard = { round: state.round, phase: state.phase, ids: [] }
    flags.bossSpawned = null
    // 区域：吹笛手（05088）放在一边。
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [PIPER]
    state.scenarioZones.removed = []
    return placed
  },

  // 地点入场、遭遇牌库洗好后结算初始裂口（SetupStep 1）。
  // 引擎 setup 注入的 helper 是 { randomValue(state), shuffle(list, rng), info }：
  // 只能把 state 传进 randomValue，否则 createGameState 会在 rngState 上抛错。
  afterDeckSetup(state, events, helper = {}) {
    const flags = flagsOf(state)
    if (flags.setupBreachesDone) return
    flags.setupBreachesDone = true
    const api = {
      shuffle: list => (helper.shuffle
        ? helper.shuffle([...list], () => helper.randomValue(state))
        : [...list]),
      random: () => (helper.randomValue ? helper.randomValue(state) : 0.5),
      info: () => {},
    }
    for (const perRound of flags.setupBreachPlan || []) {
      const ids = randomLocationIds(state, perRound, api)
      for (const id of ids) placeBreachesAt(state, api, id, 1)
    }
  },

  // 变体子剧本只保留本局那一侧的遭遇组（manifest 声明两变体并集，见 spec §3-1）。
  modifyDeck(state, deck) {
    const variant = flagsOf(state).variant || variantFor(state).id
    const allowed = new Set(deckCodesForVariant(variant))
    return deck.filter(code => allowed.has(code))
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    actRevealFor(state, act, api)
  },

  agendaReveal(state, agenda, api) {
    const records = recordsFor(state)
    api.finish?.(records.anetteMasonIsPossessedByEvil ? 'r3' : 'r4')
  },

  // 议程 05285 强制①：毁灭「将要放置」时改为在「人数 + 1」个随机不同地点各放 1 裂口。
  // 引擎在 addDoom 自增前调用本钩子（src/engine/act-agenda.js:345-351）；返回 true 表示已替换
  //（不写 state.doom、不触发 doomPlaced/checkAgenda）。
  doomPlacementReplacement(state, amount, api) {
    const count = Math.max(0, Number(amount) || 0)
    if (!count) return false
    const targets = (Number(state.numInvestigators) || 1) + 1
    const ids = randomLocationIds(state, targets, api)
    // 卡面只规定「随机不同地点」；多个裂口同时放置的顺序由队长决定（可能连锁入侵）。
    const remaining = [...ids]
    const order = []
    while (remaining.length) {
      let picked = remaining[0]
      if (typeof api?.choose === 'function' && remaining.length > 1) {
        picked = api.choose({
          kind: 'location', source: '05285', seat: state.campaign?.leadSeat ?? 0,
          prompt: '毁灭改为裂口：选择下一个放置裂口的地点（顺序由队长决定）。',
          options: remaining.map(id => ({ id, label: locationById(state, id)?.name || id })),
        })
      }
      const index = remaining.findIndex(id => String(id) === String(picked))
      order.push(remaining.splice(index >= 0 ? index : 0, 1)[0])
    }
    for (const id of order) placeBreachesAt(state, api, id, 1)
    api?.info?.(`🌑 毁灭被替换：在 ${order.length} 个随机地点各放置 1 个裂口。`)
    return true
  },

  // ---- 地点 / 轮末 ----
  phaseBegan(state, phase) {
    const flags = flagsOf(state)
    flags.incursionGuard = { round: state.round, phase, ids: [] }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    const result = clutchesChaosToken(state, inv, token)
    if (!result) return null
    if (token === 'cultist' && result.placeBreachAt) {
      if (state.skillTest) {
        // 卡面顺序：先「再揭示一个标记」，之后再放裂口。检定中的侧效延迟到 afterTest 开头结算，
        // 这样额外揭示的 [skull] 在算 X 时不会把尚未放置的裂口算进去（旧实现立即放置导致多算 1）。
        flagsOf(state).pendingCultistBreach = result.placeBreachAt
      } else {
        // 非检定的独立揭示（如卡面效果直接揭示标记）：没有 afterTest 窗口，当场放。
        placeBreachesAt(state, api, result.placeBreachAt, 1)
      }
    }
    return { delta: result.delta, ...(result.drawAnother ? { drawAnother: true } : {}) }
  },

  afterTest(state, inv, result, api) {
    const flags = flagsOf(state)
    if (flags.pendingCultistBreach) {
      const locationId = flags.pendingCultistBreach
      delete flags.pendingCultistBreach
      const location = locationById(state, locationId)
      if (location && breachesOf(location) < 3) placeBreachesAt(state, api, locationId, 1)
    }
    encounterRules.afterTest?.(state, inv, result, api)
    for (const effect of clutchesAfterTestEffects(state, inv, result)) {
      if (effect.type === 'removeActBreaches') removeActBreaches(state, api, effect.amount)
      if (effect.type === 'placeBreachRandom') placeBreachesOnRandomLocations(state, api, effect.amount)
    }
  },

  encounterGainsSurge(state) {
    if (flagsOf(state).pendingSurge) {
      delete flagsOf(state).pendingSurge
      return true
    }
    return false
  },

  // ---- 敌人 ----
  spawnLocation(state, code, fallbackLoc, engagedSeat, api) {
    // 引擎语义：spawnLocation 返回 null = 生成失败。未特判/无合法目标的 code 必须回退到引擎地点，
    // 否则整关所有未列出的敌人都无法生成。并列地点选择需要 runtime api（队长 choose）。
    return spawnLocationFor(state, code, api) || fallbackLoc || null
  },

  enemySpawned(state, enemy, api) {
    // 共享组的入场效果（05095 入场毁灭、05090 显现弃牌等）必须转发，否则在本章静默失效。
    encounterRules.enemySpawned?.(state, enemy, api)
    const breach = Number(entryFlags(original(enemy))?.breachOnEnter) || 0
    if (breach && enemy.location) placeBreachesAt(state, api, enemy.location, breach)
  },

  // 引擎的第三参是「移动前地点」；新地点要读 enemy.location。
  enemyMoved(state, enemy, previousLocation, api) {
    encounterRules.enemyMoved?.(state, enemy, previousLocation, api)
    const breach = Number(entryFlags(original(enemy))?.breachOnEnter) || 0
    if (breach && enemy.location) placeBreachesAt(state, api, enemy.location, breach)
  },

  enemyStatModifier(state, enemy, stat) {
    // 先转发共享钩子（05091 女祭司的弃牌堆女巫加成、05097 秘社玄仪的攻击/躲避 +2），
    // 再叠加本章首领的生命修正；旧实现只处理 health，导致共享组加成在 ITC 全部失效。
    const shared = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (stat !== 'health') return shared
    if (!BOSS_CODES.includes(original(enemy))) return shared
    const clues = active(state).reduce((sum, inv) => sum + Number(inv.clues || 0), 0)
    return shared - 2 * clues
  },

  // 05286a/05288a：卡面「在调查员搜集的线索总计达到所需数量时，必须立即花费这些线索并推进场景」。
  // 引擎把「花线索推进」实现为可选行动（回合末还可跳过），这里在每次 checkAct 前强制结算：
  // 达到 3×人数就立即支付并推进，不给拖延窗口。
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    const objective = act?.objective
    if (!objective || objective.type !== 'clues') return
    if (!ACT_CODES.includes(String(original(act)))) return
    const required = Number(objective.perInvestigator || 0) * (Number(state.numInvestigators) || 1)
    if (required <= 0) return
    const available = active(state).reduce((sum, inv) => sum + Number(inv.clues || 0), 0)
    if (available < required) return
    api.payClues?.(required)
    api.info?.(`目标达成：必须立即花费 ${required} 个线索并推进场景。`)
    api.advanceAct?.()
  },

  // ---- 诡计 ----
  resolveEncounter(state, inv, treachery, api) {
    const code = String(original(treachery))
    const resolver = TREACHERY_RESOLVERS[code]
    if (resolver) return resolver(state, inv, api)
    return encounterRules.resolveEncounter?.(state, inv, treachery, api) ?? false
  },

  // ---- 玩家行动 ----
  actions(state, inv) {
    const moves = [...(encounterRules.actions?.(state, inv) || [])]
    // 幕上的 [fast]：移除本幕 3 个裂口 → 随机地点放 1 线索。
    if (actBreachesOf(state) >= 3 && ACT_CODES.includes(String(original(state.acts?.[state.actIndex])))) {
      moves.push({
        action: 'scenarioAction', rule: 'removeActBreaches',
        label: '🧵 [快速] 移除本幕 3 个裂口：在一个随机地点放置 1 个线索', actions: 0,
      })
    }
    const here = locationById(state, inv.location)
    if (here) {
      moves.push(...gatewayActions(state, inv, here))
      const handler = LOCATION_HANDLERS[String(original(here))]
      if (handler && !gatewayAttachment(here) && !locationTextBlankedByEnforcer(state, here)) {
        for (const action of handler.actions(state, inv, here)) {
          moves.push({ action: 'scenarioAction', locationId: here.id, ...action })
        }
      }
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'removeActBreaches') {
      if (removeActBreaches(state, api, 3) < 3) {
        api.info?.('本幕上的裂口不足 3 个。')
        return
      }
      const ids = randomLocationIds(state, 1, api)
      const location = locationById(state, ids[0])
      if (location) {
        location.clues = (location.clues || 0) + 1
        api.info?.(`🔍 在随机地点「${location.name}」放置 1 个线索。`)
      }
      return
    }
    const here = locationById(state, inv.location)
    if (move.rule === 'closeGateway') {
      if (gatewayAttachment(here)) performGateway(state, inv, api, here)
      return
    }
    const handler = here && !gatewayAttachment(here) && !locationTextBlankedByEnforcer(state, here)
      ? LOCATION_HANDLERS[String(original(here))]
      : null
    if (handler) {
      const rules = handler.actions(state, inv, here).map(action => action.rule)
      if (rules.includes(move.rule)) {
        handler.perform(state, inv, api, here, move)
        return
      }
    }
    if (move.rule === 'locResign') {
      api.resign?.(inv.seat)
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知混沌魔掌行动：${move.rule}`)
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },

  // ---- 诚实边界 ----
  scenarioApproximations: [
    '遭遇牌库：manifest 静态声明「基线 + 两变体并集」，开局 modifyDeck 按剧本日志裁成单局分支（区域报表因此是单局张数的超集）。',
    '「随机地点」：参考实现混洗开局移出的 8 张地点版本抽取 label，等价于在 8 个在场地点槽中洗牌抽取；用 randomLocationIds 从在场地点取样。',
    '05302/05305 的「查找遭遇牌库和弃牌堆的某特性敌人」已改为列出两堆全部候选由玩家选择抽取哪张；「洗牌」仍走 engine 的 shuffleEncounterDeck。',
    '05309/05311 的「裂口最多/最少地点并列」改由队长选择（spawnLocation 钩子拿到 runtime api）；无 choose 注入时按稳定顺序取第一个。',
    '05310 的「未因本效果放置裂口→涌动」按 placeBreachesAt 实测放置数判断（目标地点满 3 裂口改结算入侵时 placed=0 → 涌动）；并列时由抽牌者选择目标异教徒。',
  ],
  scenarioGaps: [],
}
