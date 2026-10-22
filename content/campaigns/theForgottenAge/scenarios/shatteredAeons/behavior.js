import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import { actRuleFor, agendaRuleFor, entryFlags, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import {
  ALEJANDRO, ALTERNATE_ACTS, ANCIENT_EVILS, ANOTHER_WAY, BETWEEN_WORLDS,
  BETWEEN_WORLDS_LOCATION, CREEPING_DARKNESS, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
  FORMLESS_SPAWN, ICHTACA, MEND_THE_SHATTER, NEXUS, PARADISE_LOST, POISONED, POCKET,
  RELIC_AGES_UNLEASH, RELIC_REPOSSESS_THE_PAST, RELIC_VARIANTS, SET_ASIDE_LOCATIONS,
  SHATTERED_AGES_TREACHERY, SHATTERED_LOCATIONS, TEMPORAL_DEVOURER, TIMELOCK,
  WRACKED_BY_TIME, YIGS_MERCY,
} from './definition.js'

// 本章已逐条结算印刷效果的敌人/诡计原卡号（迁移审计用）。共享遭遇组的效果写在
// ../encounter-rules.js（implementedEnemies / implementedTreacheries），这里列出在本章
// 牌堆里能真正跑通印刷文本的卡号；近似实现与未实现的见交付说明的 gap 列表。
export const implementedEncounterCodes = [
  '01166', // 远古恶魔：显现时在当前密谋上放置 1 点毁灭
  '04083', '04084', '04085', // 伊格的使徒：共享规则
  '04062', // 瓦卢西亚的预示者：共享钩子
  '04090', '04091', // 时间洪流：共享规则
  '04095', '04096', '04097', // 纳克特兄弟会：共享规则
  '04325', '04326', // 伊塔卡 / 亚历山卓·维拉：谈判 + 剧情卡
  '04337', // 无形之子：生成于联结点、庞大、不可移动、攻防按联结点毁灭
  '04338', // 时间吞噬者：最远的破碎/异次元地点、猎手、进入后放 1 线索
  '04339', // 破碎的时代
  '04340', // 异界之间
  '04341', // 时空撕裂
  '04342', // 黑暗隐伏
]

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const flagsFor = state => (state.scenarioFlags ||= {})
const zonesFor = state => (state.scenarioZones ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const byCode = (state, code) => state.locations.find(location => original(location) === code)
const byId = (state, id) => state.locations.find(location => location.id === id)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traits(card)
  .some(value => String(value).toLowerCase() === String(trait).toLowerCase())
const setAsideList = state => {
  const zones = zonesFor(state)
  zones.setAside ||= []
  return zones.setAside
}
const setAsideLocations = state => {
  const zones = zonesFor(state)
  zones.setAsideLocations ||= []
  return zones.setAsideLocations
}

function removeFromSetAside(state, code) {
  const list = setAsideList(state)
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

function removeSetAsideLocation(state, id) {
  const list = setAsideLocations(state)
  const index = list.indexOf(id)
  if (index >= 0) list.splice(index, 1)
}

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  if (typeof helper?.random === 'function') {
    const copy = [...list]
    for (let index = copy.length - 1; index > 0; index--) {
      const target = Math.floor(helper.random() * (index + 1))
      ;[copy[index], copy[target]] = [copy[target], copy[index]]
    }
    return copy
  }
  return [...list]
}

function shuffleInPlace(state, api) {
  const rng = typeof api?.random === 'function' ? api.random : () => 0
  const copy = [...(state.explorationDeck || [])]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(rng() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  state.explorationDeck = copy
  return copy
}

function shuffleList(list, api) {
  if (!Array.isArray(list)) return list
  const rng = typeof api?.random === 'function' ? api.random : () => 0
  for (let index = list.length - 1; index > 0; index--) {
    const target = Math.floor(rng() * (index + 1))
    ;[list[index], list[target]] = [list[target], list[index]]
  }
  return list
}

function placeDoom(location, amount = 1) {
  if (!location) return 0
  location.doom = (location.doom || 0) + amount
  return location.doom
}

function flipClueToDoom(location, api) {
  if (!location || !(location.clues > 0)) return false
  location.clues -= 1
  placeDoom(location)
  api?.info?.(`🌑 「${location.name}」的 1 个线索被翻至毁灭标记面。`)
  return true
}

function distance(state, from, to) {
  if (!from || !to) return Number.POSITIVE_INFINITY
  if (from === to) return 0
  const seen = new Set([from])
  const queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of byId(state, id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}

function addToVictory(state, card, extra = {}) {
  state.victoryDisplay ||= []
  const code = original(card)
  if (state.victoryDisplay.some(entry => entry.id === card.id)) return
  state.victoryDisplay.push({ id: card.id, code, originalCode: code,
    victory: card.victory || 0, vengeance: card.vengeance || 0, ...extra })
}

// 04325b/04326b：让已在场的某类敌人立刻变成 passive（不主动交战），并解除已有交战。
function markTraitPassive(state, trait) {
  for (const enemy of state.enemies.filter(entry => hasTrait(entry, trait))) {
    enemy.grantedAloof = true
    enemy.aloof = true
    if (enemy.engagedSeat != null) {
      const holder = state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
      enemy.engagedSeat = null
    }
  }
}

function doomAtNexus(state) {
  const nexus = byId(state, NEXUS)
  if (!nexus) return 0
  let total = nexus.doom || 0
  for (const enemy of state.enemies.filter(entry => entry.location === nexus.id)) total += enemy.doom || 0
  for (const attachment of nexus.attachments || []) total += attachment.doom || 0
  for (const inv of state.investigators.filter(entry => entry.location === nexus.id)) {
    for (const threat of inv.threat || []) total += threat.doom || 0
    for (const asset of inv.assets || []) total += asset.doom || 0
  }
  return total
}

// 「古代遗物」的三个版本：时光涌流（04343，本关放在一边）、重拾往昔（04303，→ 结局 5）、
// 以及从埃兹特里带出来的 04061。
function relicVersion(state) {
  return flagsFor(state).relicCode || state.relicOfAges?.code || '04061'
}

function relicControlledBy(state) {
  const relic = state.relicOfAges
  if (!relic || relic.seat == null) return null
  const inv = state.investigators[relic.seat]
  if (!inv || inv.defeated || inv.resigned) return null
  return inv
}

// 兜底：relicOfAges.seat 可能还没写上（例如把 04343/04061 当资产打出），
// 这时以「哪位调查员场上有遗物资产」作为控制者（P2：04320 的卡面条件）。
function relicHolderFromAssets(state) {
  for (const inv of state.investigators) {
    if (!inv || inv.defeated || inv.resigned) continue
    if ((inv.assets || []).some(asset => RELIC_VARIANTS.includes(original(asset)))) return inv
  }
  return null
}

// 卡面「控制古代遗物」：遗物在场上且被一位在场调查员控制。
function relicInPlay(state) {
  const relic = state.relicOfAges
  if (relic?.seat != null && relicControlledBy(state)) return true
  if (relic && relic.seat == null && relic.location && byId(state, relic.location)) return true
  return !!relicHolderFromAssets(state)
}

function relicInAnyDeck(state) {
  return state.investigators.some(inv => [...(inv.deck || []), ...(inv.discard || [])]
    .some(code => RELIC_VARIANTS.includes(code)))
}

function relicAttachedToSocket(state) {
  const relic = state.relicOfAges
  if (!relic || relic.seat != null || !relic.location) return null
  const location = byId(state, relic.location)
  if (!location) return null
  return (location.clues || 0) === 0 ? location : null
}

function takeControlOfRelic(state, inv, api) {
  const location = relicAttachedToSocket(state)
  if (!location) return null
  const code = state.relicOfAges?.code || relicVersion(state)
  if (api.moveRelicOfAges) api.moveRelicOfAges({ code, seat: inv.seat })
  else state.relicOfAges = { code, location: inv.location, seat: inv.seat }
  if (!(inv.assets || []).some(asset => original(asset) === code)) api.giveAsset?.(inv.seat, code)
  flagsFor(state).relicWasControlled = true
  api.info?.(`🏺 ${inv.name} 控制了「古代遗物」（${ALL_CARDS[code]?.subnameZh || code}）。`)
  return code
}

function replaceActFour(state, code, api) {
  const template = ALTERNATE_ACTS[code]
  if (!template) return false
  state.acts[3] = structuredClone(template)
  removeFromSetAside(state, code)
  removeFromSetAside(state, MEND_THE_SHATTER)
  api?.info?.(`📜 场景 4a 被替换为「${template.name}」。`)
  return true
}

const ACT_TYPES = {
  relic: '04320',
}

function currentActCode(state) {
  return original(state.acts?.[state.actIndex])
}

function isShattered(card) {
  return hasTrait(card, 'Shattered')
}

function isOtherworld(card) {
  return hasTrait(card, 'Otherworld')
}

function isExtradimensional(card) {
  return hasTrait(card, 'Extradimensional')
}

// 「进入游戏后」的地点强制效果（拉莱耶海岸等）。同一个地点只结算一次。
function locationEntersPlay(state, location, api) {
  if (!location || location.entersPlayResolved) return false
  location.entersPlayResolved = true
  if (original(location) === '04328') {
    placeDoom(location)
    api?.info?.('🌊 拉莱耶海岸入场：在其上放置 1 个毁灭标记。')
    return true
  }
  if (original(location) === '04331') {
    // 纽约遗址：把队长牌库顶的 1-2 张牌正面朝下放在这里，视为飞天水螅（P2：真的生成敌人）。
    const lead = state.investigators[state.campaign.leadSeat] || active(state)[0]
    if (!lead) return true
    const count = state.numInvestigators >= 3 ? 2 : 1
    // 引擎把牌库顶端记在数组末尾（drawCards 用 pop）。
    const moved = (lead.deck || []).splice(Math.max(0, (lead.deck || []).length - count), count)
    location.polyps = (location.polyps || 0) + moved.length
    const polyps = []
    for (const cardCode of moved) {
      const polyp = api?.spawnStoryEnemy?.('flyingPolyp', location.id, {
        name: '飞天水螅', fight: 2, health: 2, evade: 2, damage: 1, traits: ['Monster'],
      }, { underlyingCard: cardCode })
      if (polyp) polyps.push(polyp)
    }
    if (polyps.length) {
      api?.info?.(`🗽 纽约遗址入场：${lead.name} 牌库顶的 ${polyps.length} 张牌化作飞天水螅（2 攻击 / 2 生命 / 2 躲避 / 1 伤害，[[怪物]]）。`)
    } else {
      // 没有「现场生成敌人」的运行时（旧测试桩）时，退化成「牌被移出游戏」的旧行为。
      state.removedFromGame ||= []
      state.removedFromGame.push(...moved)
      api?.info?.(`🗽 纽约遗址入场：${moved.length} 张牌被正面朝下放在此处（视为飞天水螅）。`)
    }
    return true
  }
  return false
}

function sealedSymbolCount(state, symbol) {
  let count = (state.chaosBag || []).filter(token => token === symbol).length
  for (const entry of state.chaos?.sealed || []) if (entry.token === symbol) count += 1
  for (const inv of state.investigators) {
    for (const asset of inv.assets || []) {
      for (const sealed of asset.sealed || []) if (sealed === symbol) count += 1
    }
  }
  return count;
}

// 第 116 轮：幕/密谋条目通过这个 hooks 对象编排本章实现（洗牌、放在一边、胜利区、常量），
// 条目只决定「什么时候做什么」，实现只有一份。
function aeonsHooks(state, api) {
  return {
    flags: () => flagsFor(state),
    records: () => recordsFor(state),
    active: () => active(state),
    byId: id => byId(state, id),
    removeFromSetAside: code => removeFromSetAside(state, code),
    removeSetAsideLocation: id => removeSetAsideLocation(state, id),
    shuffleInPlace: () => shuffleInPlace(state, api),
    addToVictory: (card, extra) => addToVictory(state, card, extra),
    relicControlledBy: () => relicControlledBy(state),
    shatteredLocations: () => [...SHATTERED_LOCATIONS],
    pocket: () => POCKET,
    nexus: () => NEXUS,
    formlessSpawn: () => FORMLESS_SPAWN,
    ichtaca: () => ICHTACA,
    alejandro: () => ALEJANDRO,
    relicAgesUnleash: () => RELIC_AGES_UNLEASH,
  }
}

function createBetweenWorldsLocation(state, api) {
  const zones = zonesFor(state)
  zones.locationSeq = (zones.locationSeq || 0) + 1
  const location = {
    ...structuredClone(BETWEEN_WORLDS_LOCATION),
    id: `betweenWorlds-${zones.locationSeq}`,
    revealed: true,
    clues: 1,
    doom: 0,
    attachments: [],
    connections: [],
  }
  state.locations.push(location)
  const nexus = byId(state, NEXUS)
  if (nexus) {
    location.connections = [nexus.id]
    nexus.connections = [...new Set([...(nexus.connections || []), location.id])]
  }
  api?.info?.('🌌 「异界之间」作为一个异界地点进入游戏，并与恩凯联结点相互连接。')
  return location
}

export function setupPlan(state, helper = {}) {
  const locations = [...EXPLORATION_LOCATIONS]
  const treacheries = Object.values(EXPLORATION_TREACHERIES)
  return {
    explorationDeck: mix(state, helper, [...locations, ...treacheries]),
    locations,
    treacheries,
  }
}

export const behavior = {
  ...encounterRules,
  id: 'shatteredAeons',
  implementedEncounterCodes,

  setupPlan,

  // 04320 伊斯人的遗物：把遗物当资产打出/取得时写入「谁控制着它」。
  // 之前只有 takeControlOfRelic（要求遗物已附属在无线索地点）会写 seat，
  // 「查找遗物」分支拿到手牌后永远打不出控制，场景 3a 卡死（P2）。
  assetEntered(state, inv, asset, api) {
    const code = original(asset)
    if (!RELIC_VARIANTS.includes(code)) return
    api?.moveRelicOfAges?.({ code, seat: inv.seat })
    flagsFor(state).relicWasControlled = true
    api?.info?.(`🏺 ${inv.name} 控制了古代遗物（${ALL_CARDS[code]?.nameZh || code}）。`)
  },

  // 04320 背面：遗物因任何原因离场时，清掉控制标记并让 checkObjectives 把场景
  // 重置到 3a（含「支援实例离场」这条以前检测不到的路径）。
  assetLeftPlay(state, inv, asset, api) {
    const code = original(asset)
    if (!RELIC_VARIANTS.includes(code)) return
    if (state.relicOfAges?.seat !== inv.seat) return
    state.relicOfAges = { code, location: null, seat: null }
    api?.info?.('🏺 古代遗物离场，场景即将重置到 3a。')
  },

  // 隐匿之城（04329）的强制（P2 引擎钩子 doomPlaced）：
  // 「在 1 个或多个毁灭标记被放置到位于隐匿之城的异教徒敌人后：在该敌人上放置额外 1 个毁灭标记。」
  // 这里直接改 doom，避免再次触发本钩子造成递归。
  doomPlaced(state, payload, api) {
    if (payload?.agenda || !payload?.target) return
    const enemy = payload.target
    if (!state.enemies.includes(enemy)) return
    const city = state.locations.find(location => original(location) === '04329')
    if (!city || enemy.location !== city.id) return
    const cultist = (enemy.traits || []).some(trait => String(trait).toLowerCase() === 'cultist')
    if (!cultist) return
    enemy.doom = (enemy.doom || 0) + 1
    api.info?.(`🌑 隐匿之城：异教徒「${enemy.name}」额外获得 1 个毁灭标记（当前 ${enemy.doom}）。`)
  },

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    const flags = flagsFor(state)
    const zones = zonesFor(state)
    zones.setAside = [
      RELIC_AGES_UNLEASH,
      ICHTACA, ALEJANDRO, FORMLESS_SPAWN,
      // 4a 幕的两个替代版本（Haskell 的 setAside Acts.paradiseLost / Acts.timelock）。
      PARADISE_LOST, TIMELOCK,
      ...Array(4).fill(POISONED),
    ]
    zones.removed = []
    zones.setAsideLocations = [...SET_ASIDE_LOCATIONS]
    zones.explorationLocations = [...plan.locations]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    Object.assign(flags, {
      relicCode: state.relicOfAges?.code
        || (recordsFor(state).theRelicIsMissing ? RELIC_AGES_UNLEASH : '04061'),
      relicUnderneath: [],
      relicWasControlled: false,
      relicGuard: false,
      foundHexFromDiscard: [],
      noParleyIchtaca: false,
      noParleyAlejandro: false,
      serpentPassive: false,
      cultistPassive: false,
      pnakotusUsed: false,
      valusiaUsed: false,
      valusiaShroudZero: false,
      yigsFuryCards: 0,
      advanceToSnappedThreads: false,
    })
    return [NEXUS]
  },

  setupEnemies() {
    // 开场只有恩凯联结点；伊塔卡、亚历山卓与无形之子都在一边。
  },

  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    const flags = flagsFor(state)
    const say = text => api?.info?.(text)
    // 剧情导入的分支文本由 src/campaign/story.js 按剧本日志生成；这里只结算它的机制。
    if (!records.theBraziersAreLit && !flags.startingHandReduced) {
      // 卡面：导入 2（火盆未点燃）→ 每位调查员 StartingHand -2。开局手牌已在
      // prepareInvestigator 里抽好，这里把 2 张手牌放回牌库底以对齐数量。
      // 用 startingHandReduced 防止重复结算（重开/重复调用都只减一次）。
      for (const inv of state.investigators || []) {
        const returned = (inv.hand || []).splice(0, 2)
        if (!returned.length) continue
        inv.deck ||= []
        inv.deck.unshift(...returned)
      }
      flags.startingHandReduced = true
      say('🕯️ 火盆未点燃：每位调查员起始手牌 -2。')
    }
    if (records.theInvestigatorsFoundTheMissingRelic) {
      say('🏺 遗物在你们手中：石门上的凹痕随着它的嗡鸣亮起。')
    } else if (records.theRelicIsMissing) {
      flags.relicCode = RELIC_AGES_UNLEASH
      say('🏺 遗物已丢失：只能使用放在一边的古代遗物（时光涌流）。')
    }
    // 古代遗物只有一份：按剧本日志决定用哪个版本，把其余版本的卡从牌库/手牌/弃牌/
    // 支援里拿掉（此前可能同时持有 04061 与 04343 两份遗物）。
    const keepRelic = records.theInvestigatorsFoundTheMissingRelic ? '04061' : RELIC_AGES_UNLEASH
    const purged = []
    for (const inv of state.investigators || []) {
      for (const pile of ['hand', 'deck', 'discard']) {
        inv[pile] = (inv[pile] || []).filter(code => {
          const drop = RELIC_VARIANTS.includes(code) && code !== keepRelic
          if (drop) purged.push(code)
          return !drop
        })
      }
      inv.assets = (inv.assets || []).filter(asset => {
        const code = asset?.originalCode || asset?.code
        const drop = RELIC_VARIANTS.includes(code) && code !== keepRelic
        if (drop) purged.push(code)
        return !drop
      })
    }
    if (purged.length) say(`🏺 只保留一份古代遗物（${keepRelic === '04061' ? '你们找回的那份' : '时光涌流'}）。`)
    // 检查剧本日志：伊格之怒每满 10 次，队长牌库顶的 1 张牌移出游戏并进入胜利区
    // （Haskell：take (yigsFury `div` 10) leadDeck → RemovePlayerCardFromGame + VengeanceCard）。
    const fury = Number(records.yigsFury || 0)
    const count = Math.floor(fury / 10)
    if (count > 0) {
      const lead = state.investigators[state.campaign.leadSeat] || active(state)[0]
      const deck = lead?.deck || []
      const cards = deck.splice(Math.max(0, deck.length - count), count)
      state.removedFromGame ||= []
      state.removedFromGame.push(...cards)
      state.victoryDisplay ||= []
      for (const code of cards) {
        state.victoryDisplay.push({
          id: `yigsFury:${code}:${state.victoryDisplay.length}`, code,
          originalCode: code, victory: 0, vengeance: 1,
        })
      }
      flags.yigsFuryCards = cards.length
      if (cards.length) say(`🐍 伊格之怒 ${fury} 点：队长的 ${cards.length} 张牌被移出游戏并带着复仇进入胜利区。`)
    }
  },

  canExplore(state, inv) {
    return encounterRules.canExplore(state, inv)
  },

  // 记录移动来源，供联结点/时间之窗的强制效果判断方向。
  beforeMove(state, inv) {
    inv.tfaFromLocation = inv.location
  },

  afterExplore(state, inv, context) {
    syncSymbolConnections(state)
    const api = context?.runtime
    inv.tfaExploredThisTurn = true
    if (context?.kind === 'location') {
      locationEntersPlay(state, byId(state, context.code), api)
      return
    }
    // 古代遗物（时光涌流）：探索时结算诡计后，不弃掉它，改为洗回探索牌库。
    const flags = flagsFor(state)
    const code = context?.code
    if (String(relicVersion(state)) !== RELIC_AGES_UNLEASH) return
    if (!relicInPlay(state)) return
    if (!ALL_CARDS[code] || ALL_CARDS[code].type !== 'treachery') return
    const index = (state.encounterDiscard || []).lastIndexOf(code)
    if (index < 0) return
    state.encounterDiscard.splice(index, 1)
    state.explorationDeck ||= []
    // 卡面是「洗回」：随机插入，而不是放到牌库顶（否则下次立刻又抽到同一张）。
    const at = Math.floor((api?.random?.() ?? 0.5) * (state.explorationDeck.length + 1))
    state.explorationDeck.splice(at, 0, code)
    flags.relicShuffledTreacheries = Number(flags.relicShuffledTreacheries || 0) + 1
    api?.info?.(`🏺 古代遗物：遭遇牌「${ALL_CARDS[code].nameZh || code}」被洗回探索牌库。`)
  },

  locationEntered(state, inv, location, api) {
    if (!location) return
    if (original(location) === POCKET) flagsFor(state).pocketInDeck = false
    locationEntersPlay(state, location, api)
    const flags = flagsFor(state)
    // 「探索」行动通过该地点的能力移动时，不结算联结点/时间之窗的强制效果。
    if (flags.ignoreNodeHazard) return
    const from = byId(state, inv.tfaFromLocation)
    // 第 116 轮：联结点/时间之窗的强制效果由地点条目的 nodeHazard 数据声明。
    const hazardOf = (self, other) => {
      const hazard = locationRuleFor(original(self))?.nodeHazard
      return hazard && other && hasTrait(other, hazard.withTrait) ? hazard : null
    }
    const entering = hazardOf(location, from)
    const leaving = entering ? null : hazardOf(from, location)
    const hazard = entering || leaving
    if (!hazard) return
    const source = entering ? from : location
    const clues = source?.clues || 0
    if (clues <= 0) return
    api?.[hazard.harm]?.(inv.seat, clues)
    api?.info?.(`${hazard.icon} 「${source.name}」的 ${clues} 个线索化作${hazard.label}。`)
  },

  locationShroudModifier() {
    // 第 116 轮：04328（拉莱耶海岸）与 04335（瓦卢西亚）的隐藏值修正已改成条目的
    // locationShroud 修饰符（引擎的 entityModifierTotal 会一起结算）。
    return 0
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    const flags = flagsFor(state)
    const actCode = currentActCode(state)
    // 第 116 轮：04324/04327/04330/04334/04335 的场景行动在地点条目的 locationRule.actions。
    locationRuleFor(original(location))?.actions?.({ state, inv, location, moves })
    // 04342 黑暗隐伏：[action][action] 检定意志(3)或检查补给（火把）弃掉 1 张。
    {
      const nexus = byId(state, NEXUS)
      const creep = (nexus?.attachments || []).filter(entry => original(entry) === CREEPING_DARKNESS)
      if (nexus && inv.location === nexus.id && creep.length) {
        moves.push({
          action: 'scenarioAction', rule: 'endCreepingDarkness', actions: 2,
          label: '🔥 检定意志(3)或检查补给（火把）：弃掉 1 张「黑暗隐伏」',
        })
      }
    }
    if (actCode === ACT_TYPES.relic) {
      if (relicInAnyDeck(state)) moves.push({
        action: 'scenarioAction', rule: 'searchRelic',
        label: '🔍 查找你的牌库和弃牌堆，找出古代遗物并加入手牌',
      })
      if (relicAttachedToSocket(state)?.id === inv.location) moves.push({
        action: 'scenarioAction', rule: 'takeRelic',
        label: '🏺 控制附属在你所在地点的古代遗物',
      })
    }
    if ([MEND_THE_SHATTER, PARADISE_LOST, TIMELOCK].includes(actCode) && isShattered(location)) {
      const remaining = location.clues || 0
      moves.push({
        action: 'scenarioAction', rule: 'attachLocation',
        label: '🧵 检定意志(3)或智识(3)：把此地点附属到古代遗物',
        reason: remaining > 0 ? `需要先取走此地点上的线索（还有 ${remaining} 个）`
          : !relicInPlay(state) ? '需要先让古代遗物在场' : null,
      })
    }
    for (const enemy of state.enemies) {
      const enemyCode = original(enemy)
      if (enemyCode !== ICHTACA && enemyCode !== ALEJANDRO) continue
      if (enemy.location !== inv.location) continue
      if (flags[`parleyUsed:${enemy.id}`]) continue
      if (enemyCode === ICHTACA && flags.noParleyIchtaca) continue
      if (enemyCode === ALEJANDRO && flags.noParleyAlejandro) continue
      moves.push({
        action: 'scenarioAction', rule: 'parleyEnemy', enemyId: enemy.id,
        label: `🗣️ 谈判：检定智识(5) 说服「${enemy.name}」`,
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const flags = flagsFor(state)
    if (move.rule === 'exploreFromNode') {
      // 卡面行动：与普通探索相同，只是通过该能力移动时不结算地点的强制伤害/恐惧。
      // P2：改走引擎的 doExplore，复用 canExplore 之外的完整流程（地点入场、
      // afterExplore、探索标记、胜利区结算），不再自己 pop 牌库。
      if (!(state.explorationDeck || []).length) { api.info?.('探索牌库已经空了。'); return }
      flags.ignoreNodeHazard = true
      inv.tfaFromLocation = inv.location
      try {
        api.explore?.(inv.seat)
      } finally {
        delete flags.ignoreNodeHazard
      }
      return
    }
    if (move.rule === 'yuggothFlip') {
      const location = here(state, inv)
      if (!(location.clues || 0)) {
        api.info?.('犹格斯星上没有线索，不能发动这个行动。')
        return
      }
      const flipped = flipClueToDoom(location, api)
      if (flipped) api.drawCards?.(inv.seat, 1)
      return
    }
    if (move.rule === 'endCreepingDarkness') {
      const nexus = byId(state, NEXUS)
      const creep = (nexus?.attachments || []).filter(entry => original(entry) === CREEPING_DARKNESS)
      if (!nexus || !creep.length) return
      const discardOne = () => {
        const removed = creep[creep.length - 1]
        nexus.attachments = nexus.attachments.filter(entry => entry !== removed)
        for (const enemy of state.enemies.filter(entry => original(entry) === FORMLESS_SPAWN)) {
          const bonus = Math.min(removed.healthBonus || 0, enemy.creepingDarknessHealth || 0)
          enemy.health -= bonus
          enemy.creepingDarknessHealth = (enemy.creepingDarknessHealth || 0) - bonus
        }
        api.info?.('🔥 弃掉了 1 张「黑暗隐伏」，无形之子的生命值相应回退。')
      }
      // 卡面：检定意志(3)，成功则弃；或检查补给，带火把直接弃。
      if (api.hasSupply?.(inv.seat, 'torches') ?? api.checkSupplies?.(inv.seat, 'torches')) {
        discardOne()
        return
      }
      api.test(inv.seat, 'willpower', 3, result => {
        if (result.success) discardOne()
        else api.info?.('检定失败：黑暗隐伏留在场上。')
      })
      return
    }
    if (move.rule === 'pnakotusInsight') {
      const location = here(state, inv)
      flags.pnakotusUsed = true
      const clues = location?.clues || 0
      if (clues > 0) {
        location.clues = 0
        api.gainClues?.(inv.seat, clues)
      }
      api.drawCards?.(inv.seat, clues)
      api.info?.(`📚 纳克特的档案库敞开了：发现 ${clues} 个线索并抽取 ${clues} 张卡牌。`)
      return
    }
    if (move.rule === 'valusiaRenewal') {
      flags.valusiaUsed = true
      flags.valusiaShroudZero = true
      api.healDamage?.(inv.seat, 2)
      api.healHorror?.(inv.seat, 2)
      api.info?.('🐍 瓦卢西亚的荣光治愈了你们的伤口，此地的隐藏值被设为 0。')
      return
    }
    if (move.rule === 'searchRelic') {
      const deck = inv.deck || []
      const discard = inv.discard || []
      let index = deck.findIndex(code => RELIC_VARIANTS.includes(code))
      let pile = 'deck'
      if (index < 0) {
        index = discard.findIndex(code => RELIC_VARIANTS.includes(code))
        pile = 'discard'
      }
      if (index < 0) {
        api.info?.('你的牌库和弃牌堆里没有「古代遗物」。')
        return
      }
      const [code] = (pile === 'deck' ? deck : discard).splice(index, 1)
      inv.hand ||= []
      inv.hand.push(code)
      if (pile === 'deck') shuffleList(inv.deck, api)
      api.info?.(`🔍 ${inv.name} 从${pile === 'deck' ? '牌库' : '弃牌堆'}里找出了「古代遗物」。`)
      return
    }
    if (move.rule === 'takeRelic') {
      const taken = takeControlOfRelic(state, inv, api)
      if (!taken) api.info?.('古代遗物并不在此地，或此地还有线索。')
      return
    }
    if (move.rule === 'attachLocation') {
      const location = here(state, inv)
      if (!location || !isShattered(location) || (location.clues || 0) > 0) return
      const picked = api.choose ? api.choose({
        kind: 'skill', source: MEND_THE_SHATTER, seat: inv.seat,
        prompt: '选择检定意志还是智识。',
        options: [{ id: 'willpower', label: '意志(3)' }, { id: 'intellect', label: '智识(3)' }],
      }) : 'willpower'
      const skill = ['willpower', 'intellect'].includes(picked) ? picked : 'willpower'
      api.test(inv.seat, skill, 3, result => {
        if (!result.success) return
        attachLocationToRelic(state, location, api)
      })
      return
    }
    if (move.rule === 'parleyEnemy') {
      const enemy = state.enemies.find(entry => entry.id === move.enemyId)
      if (!enemy) return
      const symbol = original(enemy) === ICHTACA ? 'cultist' : 'tablet'
      api.test(inv.seat, 'intellect', 5, result => {
        const auto = (result.drawn || []).includes(symbol)
        if (!result.success && !auto) {
          api.info?.(`${inv.name} 未能说服「${enemy.name}」。`)
          if (state.enemies.includes(enemy) && !enemy.exhausted) api.attack(enemy, inv)
          return
        }
        if (auto) api.info?.(`✨ 揭示「${symbol === 'cultist' ? '异教徒' : '石板'}」标记：谈判自动成功。`)
        resolveParleyStory(state, inv, enemy, api)
      }, 0, { label: '谈判', ability: true })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知破碎永世行动：${move.rule}`)
  },

  // ---------------------------------------------------------------------------
  // 遭遇卡（04339–04342 与远古恶魔 01166）
  // ---------------------------------------------------------------------------

  resolveEncounter(state, inv, t, api) {
    const handled = encounterRules.resolveEncounter(state, inv, t, api)
    if (handled) return handled
    const code = original(t)
    if (code === SHATTERED_AGES_TREACHERY) {
      api.test(inv.seat, 'willpower', 4, result => {
        if (result.success) return
        let placed = 0
        for (const entry of state.locations) {
          if (entry.id === NEXUS) continue
          entry.clues = (entry.clues || 0) + 1
          placed += 1
        }
        api.info?.(`⏳ 破碎的时代：${placed} 个地点各获得 1 个线索。`)
      })
      return false
    }
    if (code === BETWEEN_WORLDS) {
      // 显现：把「异界之间」当作异界地点放入场，与联结点相连，并移动到那里。
      const created = createBetweenWorldsLocation(state, api)
      if (!created) return false
      api.moveInvestigator?.(inv.seat, created.id)
      return true
    }
    if (code === WRACKED_BY_TIME) {
      const targets = [inv, ...active(state).filter(other => other.seat !== inv.seat
        && isShattered(here(state, other)))]
      for (const target of targets) {
        api.test(target.seat, 'willpower', 3, result => {
          if (result.success) return
          // 卡面：承受本效果伤害且未被击败的支援会被洗回其所有者的牌库。引擎的
          // api.damage 会先分配支援再分配调查员，因此这里对比伤害前后的差值。
          const before = (target.assets || []).map(asset => ({
            asset, damage: asset.damage || 0, horror: asset.horror || 0,
          }))
          api.damage(target.seat, 2)
          for (const entry of before) {
            if (!(target.assets || []).includes(entry.asset)) continue
            if ((entry.asset.damage || 0) <= entry.damage && (entry.asset.horror || 0) <= entry.horror) continue
            api.shuffleAssetIntoDeck?.(target.seat, entry.asset.id)
          }
        })
      }
      api.info?.('⌛ 时空撕裂：位于破碎地点的调查员都要检定意志(3)。')
      return false
    }
    if (code === CREEPING_DARKNESS) {
      const nexus = byId(state, NEXUS)
      if (!nexus) return false
      nexus.attachments ||= []
      // 每张副本都能附属到恩凯联结点（各自 1 毁灭、各自给无形之子加生命），
      // 不再用「第二张白送一张遭遇」代替。
      const copies = nexus.attachments.filter(entry => original(entry) === CREEPING_DARKNESS).length
      const bonus = state.numInvestigators
      nexus.attachments.push({
        id: `creepingDarkness:${nexus.id}:${copies}`, code: CREEPING_DARKNESS, originalCode: CREEPING_DARKNESS,
        doom: 1, healthBonus: bonus,
      })
      // 无形之子得到 +1[per_investigator] 生命值（进场时结算，离场时按附属张数回退）。
      for (const enemy of state.enemies.filter(entry => original(entry) === FORMLESS_SPAWN)) {
        enemy.health += bonus
        enemy.creepingDarknessHealth = (enemy.creepingDarknessHealth || 0) + bonus
      }
      api.info?.('🌑 黑暗隐伏附属到恩凯联结点，并在其上放置 1 个毁灭标记。无形之子获得 +1[每名调查员] 生命值。')
      return true
    }
    return false
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 异界之间：一轮结束时，此地的调查员各受 1 点伤害和 1 点恐惧；无人则弃掉并
    // 把敌人移到联结点。
    for (const location of state.locations.filter(entry => original(entry) === BETWEEN_WORLDS)) {
      const present = active(state).filter(inv => inv.location === location.id)
      if (present.length) {
        for (const inv of present) {
          api.damage(inv.seat, 1)
          api.horror(inv.seat, 1)
        }
        api.info?.('🌌 异界之间：此地的调查员各受到 1 点伤害和 1 点恐惧。')
        continue
      }
      const nexus = byId(state, NEXUS)
      for (const enemy of state.enemies.filter(entry => entry.location === location.id)) {
        if (nexus) enemy.location = nexus.id
      }
      api.remove(location.id)
      state.encounterDiscard ||= []
      state.encounterDiscard.push(BETWEEN_WORLDS)
      api.info?.('🌌 异界之间无人逗留，地点被弃掉，敌人被移到恩凯联结点。')
    }
  },

  // 「行动：[行动] 检定意志(3)或检查你的补给品」——黑暗隐伏的弃牌行动。
  encounterActions(state, inv) {
    const moves = encounterRules.encounterActions?.(state, inv) || []
    const location = here(state, inv)
    for (const attachment of location?.attachments || []) {
      if (original(attachment) !== CREEPING_DARKNESS) continue
      moves.push({
        action: 'encounterAction', rule: 'endCreepingDarkness', attachmentId: attachment.id,
        actions: 2, locationId: inv.location,
        label: '♻️ 检定意志(3)或检查补给品（火把）弃掉黑暗隐伏',
      })
    }
    return moves
  },

  performEncounterAction(state, inv, move, api) {
    if (move.rule === 'endCreepingDarkness') {
      const location = here(state, inv)
      const attachment = (location?.attachments || []).find(entry => entry.id === move.attachmentId)
      if (!attachment) return false
      const discard = () => {
        location.attachments = (location.attachments || []).filter(entry => entry !== attachment)
        state.encounterDiscard.push(CREEPING_DARKNESS)
        const bonus = attachment.healthBonus || state.numInvestigators
        for (const enemy of state.enemies.filter(entry => original(entry) === FORMLESS_SPAWN)) {
          enemy.health = Math.max(1, enemy.health - bonus)
          enemy.creepingDarknessHealth = Math.max(0, (enemy.creepingDarknessHealth || 0) - bonus)
          if (!enemy.creepingDarknessHealth) delete enemy.creepingDarknessHealth
        }
        api.info?.('🌑 黑暗隐伏被弃掉，无形之子的生命值恢复原状。')
      }
      if (api.hasSupply?.(inv.seat, 'torches') ?? api.checkSupplies?.(inv.seat, 'torches')) {
        discard()
        return true
      }
      api.test(inv.seat, 'willpower', 3, result => { if (result.success) discard() })
      return true
    }
    if (encounterRules.performEncounterAction?.(state, inv, move, api)) return true
    throw new Error(`未知破碎永世遭遇行动：${move.rule}`)
  },

  // ---------------------------------------------------------------------------
  // 敌人
  // ---------------------------------------------------------------------------

  spawnLocation(state, code, loc, engagedSeat, api) {
    if (code === FORMLESS_SPAWN) {
      return byId(state, NEXUS)?.id || loc
    }
    if (code === TEMPORAL_DEVOURER) {
      const from = engagedSeat != null ? state.investigators[engagedSeat]?.location : null
      const candidates = state.locations.filter(entry => isShattered(entry) || isExtradimensional(entry))
      if (!candidates.length) return null
      const scored = candidates.map(entry => ({ entry, steps: distance(state, from, entry.id) }))
        .sort((left, right) => right.steps - left.steps
          || String(left.entry.id).localeCompare(String(right.entry.id)))
      const best = scored[0].steps
      const tied = scored.filter(item => item.steps === best)
      if (tied.length > 1 && typeof api?.choose === 'function') {
        // 并列最远时由抽到它的调查员选择，而不是按 id 排序。
        const answer = api.choose({
          kind: 'location', source: code, seat: engagedSeat ?? state.campaign?.leadSeat ?? 0,
          prompt: '时间吞噬者：选择最远的破碎/异次元地点。',
          options: tied.map(item => ({ id: item.entry.id, label: item.entry.name })),
        })
        const picked = tied.find(item => item.entry.id === answer)
        if (picked) return picked.entry.id
      }
      return scored[0].entry.id
    }
    // 场景 1a 的强制能力：敌人要生成在无人地点、而场上没有无人地点时，从探索牌库
    // 揭示地点直到翻出一处地点，把它放入场并在那里生成。
    if (currentActCode(state) === '04318' && (!loc || !byId(state, loc))) {
      const revealed = revealLocationFromExploration(state, api)
      if (revealed) return revealed
    }
    return loc
  },

  spawnFailed(state, code, engagedSeat, api) {
    // 时间吞噬者：场上没有破碎/异次元地点时获得涌动。
    if (code === TEMPORAL_DEVOURER && engagedSeat != null) {
      api?.info?.('🌀 时间吞噬者无处生成，获得涌动。')
      api?.drawEncounter?.(engagedSeat)
    }
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    const flags = flagsFor(state)
    const code = original(enemy)
    if (code === TEMPORAL_DEVOURER) placeClueAtEnemy(state, enemy, api)
    if (code === FORMLESS_SPAWN) {
      const nexus = byId(state, NEXUS)
      const creepCount = (nexus?.attachments || []).filter(entry => original(entry) === CREEPING_DARKNESS).length
      if (creepCount) {
        // 每张「黑暗隐伏」各给一份 +1[每名调查员] 生命。
        enemy.health += state.numInvestigators * creepCount
        enemy.creepingDarknessHealth = (enemy.creepingDarknessHealth || 0) + state.numInvestigators * creepCount
      }
    }
    // 「我答应你」：蛇族/异教徒敌人不与你交战、也不攻击你（用常驻 aloof 表示）。
    if (flags.cultistPassive && hasTrait(enemy, 'Cultist')) enemy.grantedAloof = true
    if (flags.serpentPassive && hasTrait(enemy, 'Serpent')) enemy.grantedAloof = true
  },

  enemyMoved(state, enemy, previous, api) {
    if (original(enemy) === TEMPORAL_DEVOURER && enemy.location !== previous) {
      placeClueAtEnemy(state, enemy, api)
    }
  },

  // 无形之子不能移动；猎手移动一律跳过。
  hunterMove(state, enemy) {
    return original(enemy) === FORMLESS_SPAWN
  },

  enemyStatModifier(state, enemy, stat) {
    let value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (original(enemy) === FORMLESS_SPAWN && (stat === 'fight' || stat === 'evade')) value += doomAtNexus(state)
    return value
  },

  // ---------------------------------------------------------------------------
  // 混乱标记
  // ---------------------------------------------------------------------------

  resolveChaosToken(state, inv, token, api) {
    const base = tfaChaosToken('shatteredAeons', state, inv, token, api)
    if (!base) return base
    // 姆大陆：你每次技能检定期间揭示的第一个符号标记获得「揭示另一个标记」。
    const atMu = original(here(state, inv)) === '04332'
    if (atMu && ['skull', 'cultist', 'tablet', 'elderthing'].includes(token) && state.skillTest) {
      if (!state.skillTest.muExtraToken) {
        state.skillTest.muExtraToken = true
        return { ...base, drawAnother: true }
      }
    }
    return base
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('shatteredAeons', state, inv, result, api)
    encounterRules.afterTest?.(state, inv, result, api)
    const tokens = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
    const hard = ['hard', 'expert'].includes(state.difficulty)
    // 困难/专家：石板 + 未中毒 + 检定失败 → 把放在一边的一张「中毒」放进威胁区域。
    if (!result.success && hard && tokens.includes('tablet') && !api.isPoisoned?.(inv.seat)) {
      const list = setAsideList(state)
      const index = list.indexOf(POISONED)
      if (index >= 0) list.splice(index, 1)
      api.poison?.(inv.seat)
      api.info?.('☠️ 石板标记：一张「中毒」弱点进入你的威胁区域。')
    }
    // 亚特兰蒂斯：揭示自动失败标记后放 1 个毁灭；满 3 个则移出游戏并击败此地所有人。
    if (tokens.includes('autofail')) {
      const atlantis = byCode(state, '04333')
      if (atlantis) {
        placeDoom(atlantis)
        api.info?.(`🌊 亚特兰蒂斯：放置 1 个毁灭标记（当前 ${atlantis.doom}）。`)
        if ((atlantis.doom || 0) >= 3) {
          for (const target of active(state).filter(entry => entry.location === atlantis.id)) api.defeat(target, null)
          // 卡面是「被击败」（进胜利区、计复仇），不是默默弃掉。
          for (const enemy of state.enemies.filter(entry => entry.location === atlantis.id)) api.defeatEnemy?.(enemy)
          api.remove(atlantis.id)
          api.info?.('🌊 亚特兰蒂斯沉入海底：此地的敌人与调查员全部被击败。')
        }
      }
    }
    // 冷原：在此地揭示旧神标记后受到 1 点恐惧。
    if (tokens.includes('elderthing') && original(here(state, inv)) === '04336') {
      api.horror(inv.seat, 1)
      api.info?.('🏔️ 冷原：你揭示旧神标记，受到 1 点恐惧。')
    }
  },

  // ---------------------------------------------------------------------------
  // 调查员退场：持有古代遗物者退场 → 立即推进到密谋 3b
  // ---------------------------------------------------------------------------

  investigatorEliminated(state, inv, clues, api) {
    const flags = flagsFor(state)
    if (flags.advanceToSnappedThreads) return false
    const relic = state.relicOfAges
    const holdsRelic = (relic?.seat === inv.seat)
      || [...(inv.hand || []), ...(inv.deck || []), ...(inv.discard || [])]
        .some(code => RELIC_VARIANTS.includes(code))
      || (inv.assets || []).some(asset => RELIC_VARIANTS.includes(original(asset)))
    if (!holdsRelic) return false
    flags.advanceToSnappedThreads = true
    // 卡面：立即推进到密谋 3b（断了的线）。
    if ((state.agendaIndex ?? 0) < 2) state.agendaIndex = 2
    flags.advanceToSnappedThreads = false
    api?.info?.(`🌑 ${inv.name} 带着古代遗物退场：立即推进到密谋 3b。`)
    api?.advanceAgenda?.()
    return false
  },

  // ---------------------------------------------------------------------------
  // 幕 / 密谋
  // ---------------------------------------------------------------------------

  // 剧本内的公开标记汇总（牌桌描述/日志都会读到，避免「写了没人读」的标记）。
  describe(state) {
    const flags = flagsFor(state)
    const lines = []
    if (flags.startingHandReduced) lines.push('📉 火盆未点燃：起始手牌已 -2。')
    if (flags.pocketInDeck) lines.push('🕳️ 时间之窗在探索牌库中。')
    const hexCount = (flags.foundHexFromDiscard || []).length
    if (hexCount) lines.push(`🃏 已把 ${hexCount} 张巫术诡计洗入探索牌库。`)
    if (flags.relicShuffledTreacheries) {
      lines.push(`🏺 古代遗物已把 ${flags.relicShuffledTreacheries} 张遭遇牌洗回探索牌库。`)
    }
    const polyps = state.locations.reduce((sum, location) => sum + (location.polyps || 0), 0)
    if (polyps) lines.push(`🦑 纽约遗址上附着 ${polyps} 张飞天水螅。`)
    return lines
  },

  actReveal(state, act, api) {
    const code = original(act)
    // 第 116 轮：04318–04320 的背面效果在幕条目（条目通过 hooks 编排本章实现）。
    const entry = actRuleFor(code)?.onReveal
    if (entry) { entry(state, act, api, aeonsHooks(state, api)); return }
    if (code === MEND_THE_SHATTER) {
      if (String(relicVersion(state)) === RELIC_REPOSSESS_THE_PAST) { api.finish('r5'); return }
      api.finish('r1')
      return
    }
    if (code === PARADISE_LOST) { api.finish('r2'); return }
    if (code === TIMELOCK) { api.finish('r3'); return }
    throw new Error(`未知破碎永世场景：${code}`)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    // 第 116 轮：04315–04317 的背面效果在密谋条目。
    const entry = agendaRuleFor(code)?.onReveal
    if (entry) { entry(state, agenda, api, aeonsHooks(state, api)); return }
    throw new Error(`未知破碎永世密谋：${code}`)
  },

  checkObjectives(state, api) {
    const flags = flagsFor(state)
    if (flags.advanceToSnappedThreads) {
      flags.advanceToSnappedThreads = false
      if ((state.agendaIndex ?? 0) < 2) state.agendaIndex = 2
      api.advanceAgenda()
      return
    }
    // 遗物离场：把它附属的地点洗回探索牌库，并把场景重置到 3a。
    if (flags.relicGuard && flags.relicWasControlled && !relicInPlay(state)) {
      const underneath = flags.relicUnderneath || []
      state.explorationDeck = [...(state.explorationDeck || []), ...underneath.map(entry => entry.id)]
      shuffleInPlace(state, api)
      flags.relicUnderneath = []
      flags.relicWasControlled = false
      flags.relicGuard = false
      state.actIndex = 2
      state.acts[2] = structuredClone(state.scenario.acts.find(act => original(act) === ACT_TYPES.relic))
      api.info?.('🏺 古代遗物离场：其附属地点被洗回探索牌库，场景重置到 3a「伊斯人的遗物」。')
      return
    }
    const actCode = currentActCode(state)
    if (actCode === ACT_TYPES.relic) {
      // 控制者：优先 relicOfAges.seat，其次「场上有遗物资产」的兜底。
      if (relicControlledBy(state) || relicHolderFromAssets(state)) {
        flags.relicWasControlled = true
        api.advanceAct()
      }
      return
    }
    if (actCode === MEND_THE_SHATTER) {
      const needed = state.numInvestigators + 1
      if ((flags.relicUnderneath || []).length >= needed) api.advanceAct()
      return
    }
    if (actCode === PARADISE_LOST || actCode === TIMELOCK) {
      const wanted = actCode === PARADISE_LOST ? 'valusia' : 'pnakotus'
      if ((flags.relicUnderneath || []).some(entry => entry.id === wanted)) api.advanceAct()
    }
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  // ---------------------------------------------------------------------------
  // 结局
  // ---------------------------------------------------------------------------

  resolution(state, key, events, api = {}) {
    if (!['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5'].includes(key)) {
      throw new Error('未知破碎永世结局')
    }
    const records = recordsFor(state)
    const flags = flagsFor(state)
    if (key === 'noResolution' || key === 'r4') {
      records.theFabricOfTimeIsUnwoven = true
      for (const inv of active(state)) {
        inv.defeated = true
        inv.defeatCause = 'mental'
        api.info?.(`💔 ${inv.name} 的时间线彼此冲突，陷入疯狂。`)
      }
      return { award: false, bonus: 0 }
    }
    // 结局 1 与 5：附属到古代遗物上的地点进入胜利区（结局 2/3 不结算这一步）。
    const underneath = flags.relicUnderneath || []
    const addUnderneathToVictory = () => {
      state.victoryDisplay ||= []
      for (const entry of underneath) {
        if (!entry.victory) continue
        if (state.victoryDisplay.some(card => card.id === entry.id)) continue
        state.victoryDisplay.push({ id: entry.id, code: entry.code,
          originalCode: entry.code, victory: entry.victory })
      }
    }
    if (key === 'r1') {
      records.theInvestigatorsMendedTheTearInTheFabricOfTime = true
      addUnderneathToVictory()
      // 卡面是「每位调查员」：已被击败/撤退的也有战役记录，同样受 2/2 创伤（P2）。
      for (const inv of state.investigators) {
        if (!state.campaign?.investigators?.[inv.seat]) continue
        api.addTrauma?.(state, inv.seat, 'physical', 2, events)
        api.addTrauma?.(state, inv.seat, 'mental', 2, events)
      }
      return { award: true, bonus: 5 }
    }
    if (key === 'r2') {
      records.theInvestigatorsSavedTheCivilizationOfTheSerpents = true
      return { award: true, bonus: 0 }
    }
    if (key === 'r3') {
      records.theInvestigatorsSavedTheCivilizationOfTheYithians = true
      return { award: true, bonus: 0 }
    }
    records.theInvestigatorsTurnedBackTime = true
    addUnderneathToVictory()
    return { award: true, bonus: 0 }
  },
}

// -----------------------------------------------------------------------------
// 内部工具
// -----------------------------------------------------------------------------

function placeClueAtEnemy(state, enemy, api) {
  const location = byId(state, enemy.location)
  if (!location) return false
  if (!isShattered(location) && !isExtradimensional(location)) return false
  location.clues = (location.clues || 0) + 1
  api?.info?.(`👣 时间吞噬者进入「${location.name}」：在该地点放置 1 个线索。`)
  return true
}

function attachLocationToRelic(state, location, api) {
  const flags = flagsFor(state)
  const pocket = byId(state, POCKET)
  const companions = active(state).filter(other => other.location === location.id)
  for (const other of companions) {
    if (pocket) api.moveInvestigator?.(other.seat, pocket.id)
    else other.location = POCKET
  }
  // 卡面：该地点的「每位调查员和每个敌人」都被移动到时间之窗——已交战敌人也要走，
  // 它们随调查员一起过去并保持交战（P2：以前只搬未交战的敌人，会留下悬空 location）。
  for (const enemy of state.enemies.filter(entry => entry.location === location.id)) {
    if (pocket) api.moveEnemy?.(enemy, pocket.id)
    else enemy.location = POCKET
    if (enemy.engagedSeat != null) {
      const engaged = state.investigators[enemy.engagedSeat]
      if (engaged && !(engaged.engaged || []).includes(enemy.id)) (engaged.engaged ||= []).push(enemy.id)
    }
  }
  flags.relicUnderneath ||= []
  flags.relicUnderneath.push({
    id: location.id, code: original(location), name: location.name, victory: location.victory || 0,
  })
  api.remove?.(location.id)
  api.info?.(`🧵 「${location.name}」被正面朝下附属到古代遗物（${flags.relicUnderneath.length} 处）。`)
}

function resolveParleyStory(state, inv, enemy, api) {
  const code = original(enemy)
  const flags = flagsFor(state)
  const removeEnemy = () => {
    const index = state.enemies.indexOf(enemy)
    if (index >= 0) state.enemies.splice(index, 1)
    if (enemy.engagedSeat != null) {
      const holder = state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
    }
  }
  if (code === ICHTACA) {
    api.cardReveal?.(YIGS_MERCY, '伊格的宽恕')
    const fury = Number(recordsFor(state).yigsFury || api.yigsFury?.() || 0)
    if (fury >= 16) {
      api.info?.('🐍 伊格之怒已满 16 次：伊塔卡拒绝了你的请求，卡牌翻回正面。')
      return
    }
    const answer = api.choose({
      kind: 'story', source: YIGS_MERCY, seat: inv.seat,
      prompt: '伊塔卡停下了攻击，倾听你的话语。你接受她的条件吗？',
      options: [
        { id: 'reject', label: '“我永远都不会背叛人类！”' },
        { id: 'accept', label: '“我答应你。”' },
      ],
    })
    if (answer === 'accept') {
      removeEnemy()
      // 04325b：接受伊塔卡的条件 → 换成场景 4a「失乐园」，放过蛇族。
      replaceActFour(state, PARADISE_LOST, api)
      flags.noParleyAlejandro = true
      flags.serpentPassive = true
      markTraitPassive(state, 'Serpent')
      api.info?.('🐍 你答应了伊塔卡：场景 4a 换成「失乐园」，蛇族不再与你交战，也不能再与亚历山卓谈判。')
      return
    }
    enemy.exhausted = true
    if (enemy.engagedSeat != null) {
      const holder = state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
    }
    enemy.engagedSeat = null
    flags.noParleyIchtaca = true
    api.info?.('🐍 你拒绝了伊塔卡：本场冒险余下的时间里不能再与她谈判。')
    return
  }
  api.cardReveal?.(ANOTHER_WAY, '另有他法')
  const answer = api.choose({
    kind: 'story', source: ANOTHER_WAY, seat: inv.seat,
    prompt: '亚历山卓向你伸出手。你要接受他的提议吗？',
    options: [
      { id: 'reject', label: '“我永远都不会背叛人类！”' },
      { id: 'accept', label: '“我答应你。”' },
    ],
  })
  if (answer === 'accept') {
    removeEnemy()
    // 04326b：接受亚历山卓的提议 → 换成场景 4a「锁定时间」，放过异教徒。
    replaceActFour(state, TIMELOCK, api)
    flags.noParleyIchtaca = true
    flags.cultistPassive = true
    markTraitPassive(state, 'Cultist')
    api.info?.('👤 你答应了亚历山卓：场景 4a 换成「锁定时间」，异教徒不再与你交战，也不能再与伊塔卡谈判。')
    return
  }
  enemy.exhausted = true
  if (enemy.engagedSeat != null) {
    const holder = state.investigators[enemy.engagedSeat]
    if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
  }
  enemy.engagedSeat = null
  flags.noParleyAlejandro = true
  api.info?.('👤 你拒绝了亚历山卓：本场冒险余下的时间里不能再与他谈判。')
}

// 场景 1a 的强制能力：从探索牌库揭示卡牌直到翻出一个地点，把它放入场。
function revealLocationFromExploration(state, api) {
  const deck = state.explorationDeck || []
  const revealed = []
  while (deck.length) {
    const code = deck.pop()
    if (state.scenario.locations?.[code]) {
      for (const entry of revealed) deck.push(entry)
      api.place?.(code)
      shuffleInPlace(state, api)
      api.info?.(`🧭 场上没有无人地点：从探索牌库放入「${state.scenario.locations[code].name}」。`)
      return code
    }
    revealed.push(code)
  }
  for (const entry of revealed) deck.push(entry)
  api.info?.('🧭 探索牌库已经空了。')
  return null
}
