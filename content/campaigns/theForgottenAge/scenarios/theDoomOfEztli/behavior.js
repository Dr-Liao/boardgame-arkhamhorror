import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor } from '../../../../../src/cards/card-rules.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import {
  ANCIENT_HALL, BURIAL_PIT, CHAMBER_OF_TIME, ENTRYWAY, EXPLORATION_LOCATIONS,
  EXPLORATION_TREACHERIES, GRAND_CHAMBER, HARBINGER, RELIC_OF_AGES, SECRET_PASSAGE,
  UNDERGROUND_RUINS,
} from './definition.js'

// 本章 enemies/treacheries 中，印刷效果已经实现的原卡号（迁移审计用）。
// 共享遭遇组的效果统一写在 ../encounter-rules.js（implementedEnemies /
// implementedTreacheries），这里只列出在本章牌堆里能真正跑通印刷文本的卡号；
// 近似实现与完全未实现的卡号见交付说明的 gap 列表。
export const implementedEncounterCodes = [
  '01167', '01168', // 地窖寒风 / 朦胧之雾：核心遭遇卡，由共享解析器处理
  '04062', // 瓦卢西亚的预示者：本文件实现资源累积与「遁去身影」
  '04083', '04084', // 伊格的使徒：共享规则（攻击值修正 / 反击·猎手·减伤）
  '04088', '04089', '04090', '04091', '04092', '04093', '04094', // 致命陷阱 / 时间洪流 / 被遗忘的遗迹
  '04100', '04101', '04102', // 伊格的毒液 / 毒素
]

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
// 引擎的探索牌库放的是**地点 id**（`state.scenario.locations[code]`），
// 而放在一边/清单里记的是印刷卡号，两者分开。
const CHAMBER_ID = 'chamberOfTime'
const ENTRYWAY_ID = 'entryway'
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const byCode = (state, code) => state.locations.find(location => original(location) === code)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traits(card)
  .some(value => String(value).toLowerCase() === String(trait).toLowerCase())

function mix(state, helper, list) {
  if (helper?.shuffle && helper?.randomValue) return helper.shuffle([...list], () => helper.randomValue(state))
  return [...list]
}

function shuffleWith(list, random) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function takeFromSetAside(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

// 卡面「将 1 个线索翻至毁灭标记面」：地点上 1 个线索变成 1 点毁灭。
function flipClueToDoom(state, location, api) {
  if (!location || (location.clues || 0) <= 0) return false
  location.clues -= 1
  location.doom = (location.doom || 0) + 1
  api?.info?.(`🌑 「${location.name}」的 1 个线索被翻成毁灭标记（毁灭 ${location.doom}）。`)
  return true
}

// 古代遗物：`state.relicOfAges` 是引擎原语的数据面；`state.storyAssets` 是它当前
// 附属/展示的位置。两者一起移动，才能同时被 api.relicOfAges* 与界面看到。
function relicAssetOf(state) {
  return (state.storyAssets || []).find(asset => original(asset) === RELIC_OF_AGES)
}

function chamberEntersPlay(state, api) {
  const chamber = byCode(state, CHAMBER_OF_TIME)
  if (!chamber) return false
  const flags = (state.scenarioFlags ||= {})
  if (flags.chamberPrepared) return false
  flags.chamberPrepared = true
  takeFromSetAside(state, RELIC_OF_AGES)
  takeFromSetAside(state, CHAMBER_OF_TIME)
  api?.storyAsset?.(RELIC_OF_AGES, chamber.id)
  api?.moveRelicOfAges?.({ location: chamber.id })
  chamber.doom = (chamber.doom || 0) + 1
  api?.info?.('🏺 「古代遗物」附属到「时间石室」上，并在时间石室放置 1 点毁灭。')
  return true
}

function takeControlOfRelic(state, api) {
  const chamber = byCode(state, CHAMBER_OF_TIME)
  const candidates = chamber ? active(state).filter(inv => inv.location === chamber.id) : []
  if (!candidates.length) {
    api?.info?.('时间石室里没有调查员，古代遗物仍留在原地。')
    return null
  }
  const answer = candidates.length === 1 ? String(candidates[0].seat) : api.choose({
    kind: 'investigator', source: '04058', seat: state.campaign.leadSeat ?? 0,
    prompt: '选择位于时间石室、控制「古代遗物」的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  })
  const seat = Number(answer)
  const owner = candidates.find(inv => inv.seat === seat) || candidates[0]
  const asset = relicAssetOf(state)
  if (asset) state.storyAssets.splice(state.storyAssets.indexOf(asset), 1)
  if (!(owner.assets || []).some(item => original(item) === RELIC_OF_AGES)) {
    api.giveAsset?.(owner.seat, RELIC_OF_AGES)
  }
  api.moveRelicOfAges?.({ seat: owner.seat })
  api.info?.(`🏺 ${owner.name} 控制了「古代遗物」。`)
  return owner
}

// 卡面：时间石室在左端、遗迹入口在右端，其余地点按毁灭标记数从低到高排成一条线；
// 之后忽略所有印刷连接，每个地点只与左右相邻的地点相连。
function formLocationLine(state, api) {
  const entryway = byCode(state, ENTRYWAY)
  const chamber = byCode(state, CHAMBER_OF_TIME)
  const others = state.locations
    .filter(location => location.id !== entryway?.id && location.id !== chamber?.id)
    .sort((left, right) => (left.doom || 0) - (right.doom || 0)
      || String(original(left)).localeCompare(String(original(right))))
  const order = [chamber, ...others, entryway].filter(Boolean)
  const flags = (state.scenarioFlags ||= {})
  flags.locationLine = order.map(location => location.id)
  flags.locationsInLine = true
  for (const [index, location] of order.entries()) {
    location.connections = [order[index - 1]?.id, order[index + 1]?.id].filter(Boolean)
    location.linePosition = index + 1
  }
  // 地图也排成一条线（presentation 数据）：否则只是连线变了，卡牌还是按旧网格摆。
  state.scenario.layout ||= {}
  state.scenario.layout.locations = Object.fromEntries(order.map((location, index) => [
    location.id, { x: index - (order.length - 1) / 2, y: 0 },
  ]))
  api?.info?.(`🧱 遗迹排成一条线：${order.map(location => location.name).join(' → ')}。`)
  return order
}

function burialPitChoices(state, inv, location, api) {
  for (let index = 0; index < 2; index++) {
    const answer = api.choose({
      kind: 'harm', source: BURIAL_PIT, seat: inv.seat,
      prompt: `坑葬墓室（${index + 1}/2）：抽 1 张遭遇牌，或在坑葬墓室放置 1 点毁灭。`,
      options: [
        { id: 'draw', label: '从遭遇牌库顶抽 1 张' },
        { id: 'doom', label: '在坑葬墓室放置 1 点毁灭' },
      ],
    })
    if (answer === 'draw') api.drawEncounter(inv.seat)
    else location.doom = (location.doom || 0) + 1
  }
}

// Haskell getTotalVengeanceEntries：胜利区卡牌 + 已揭示且无线索的地点的复仇点数；
// 地下遗迹有敌人时即使还有线索也照算（InVictoryDisplayForCountingVengeance）。
export function vengeanceEntries(state) {
  const entries = []
  for (const card of state.victoryDisplay || []) {
    const amount = card.vengeance || 0
    if (amount > 0) entries.push({ source: card.code, amount })
  }
  for (const location of state.locations) {
    const amount = location.vengeance || 0
    if (!amount) continue
    const occupiedRuins = original(location) === UNDERGROUND_RUINS
      && state.enemies.some(enemy => enemy.location === location.id)
    const scoredAtEnd = location.revealed !== false && (location.clues || 0) === 0
    if (occupiedRuins || scoredAtEnd) entries.push({ source: original(location), amount })
  }
  return entries
}

export function totalVengeance(state) {
  return vengeanceEntries(state).reduce((sum, entry) => sum + entry.amount, 0)
}

// Haskell recordVengeance：把胜利区里的复仇点数记入伊格之怒。
export function recordVengeance(state) {
  const records = recordsFor(state)
  records.yigsFury = Math.max(0, Number(records.yigsFury || 0) + totalVengeance(state))
  return records.yigsFury
}

function harbingerOf(state) {
  return state.enemies.find(enemy => original(enemy) === HARBINGER) || null
}

// 卡面背面：生成在毁灭标记最多的地点（并列时由队长选择）。
function spawnHarbingerAtDoom(state, api) {
  const flags = (state.scenarioFlags ||= {})
  if (!state.locations.length) return null
  const most = Math.max(...state.locations.map(location => location.doom || 0))
  const candidates = state.locations.filter(location => (location.doom || 0) === most)
  const answer = candidates.length === 1 ? candidates[0].id : api.choose({
    kind: 'location', source: '04055', seat: state.campaign.leadSeat ?? 0,
    prompt: '选择毁灭标记最多、预示者生成的地点。',
    options: candidates.map(location => ({ id: location.id, label: `${location.name}（毁灭 ${location.doom || 0}）` })),
  })
  const locationId = (candidates.find(location => location.id === answer) || candidates[0]).id
  takeFromSetAside(state, HARBINGER)
  flags.harbingerSpawned = true
  const enemy = api.spawn(HARBINGER, locationId)
  const spawned = enemy || harbingerOf(state)
  if (spawned) {
    // 之前遁去时保留的伤害标记。
    if (!spawned.damageTaken && flags.harbingerDamage) spawned.damageTaken = flags.harbingerDamage
    spawned.resources = spawned.resources || 0
    spawned.tfaRetaliateWhileExhausted = true
  }
  return spawned
}

function hasAnySupply(state, api, name) {
  if (typeof api.hasSupply !== 'function') return false
  return active(state).some(inv => api.hasSupply(inv.seat, name))
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
  id: 'theDoomOfEztli',

  setupPlan,
  vengeanceEntries,
  totalVengeance,
  implementedEncounterCodes,

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      RELIC_OF_AGES, HARBINGER, '04102', '04102', '04102', '04102', CHAMBER_OF_TIME,
    ]
    state.scenarioZones.removed = []
    state.scenarioZones.explorationLocations = [...plan.locations]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.scenarioFlags ||= {}
    // 古代遗物初始在一边（尚无位置），时间石室入场时才附属上去。
    state.relicOfAges = { code: RELIC_OF_AGES, location: null, seat: null }
    Object.assign(state.scenarioFlags, {
      chamberPrepared: false,
      harbingerSpawned: false,
      harbingerDamage: 0,
      locationsInLine: false,
      // 结局 4 的重演次数存在战役记录里（跨关保留），布置时读回来。
      resolution4Count: Number(state.campaign?.records?.resolution4Count || 0),
    })
    return [ENTRYWAY_ID]
  },

  setupEnemies() {
    // 开场只有遗迹入口；预示者、古代遗物、时间石室都在一边。
  },

  // 两张密谋都印刷「+1[per_investigator] 毁灭阀值」。
  afterChaosBagSetup(state) {
    const flags = (state.scenarioFlags ||= {})
    if (flags.agendaThresholdsApplied) return
    flags.agendaThresholdsApplied = true
    for (const agenda of state.agendas || []) {
      if (['04055', '04056'].includes(String(original(agenda)))) {
        agenda.doomThreshold = Number(agenda.doomThreshold || 0) + state.numInvestigators
      }
    }
    // 结局 4「重演本场冒险」：遗迹入口按重演次数放毁灭（地点此时已经入场）。
    const replays = Number(flags.resolution4Count || 0)
    const entryway = state.locations.find(location => location.id === ENTRYWAY_ID)
    if (replays > 0 && entryway) entryway.doom = (entryway.doom || 0) + replays
  },

  canExplore(state, inv) {
    // 04057/04058 才印着「探索」行动；幕 3（04059 逃出遗迹）不能再探索。
    const act = String(original(state.acts?.[state.actIndex]) || '')
    if (act && act !== '04057' && act !== '04058') return false
    return encounterRules.canExplore(state, inv)
  },

  afterExplore(state, inv, context) {
    // 排成一条线之后忽略印刷符号连线（卡面明确要求）。
    if (!state.scenarioFlags?.locationsInLine) syncSymbolConnections(state)
    const api = context?.runtime
    const code = String(context?.code || '')
    if (context?.kind === 'location') {
      inv.tfaExploredThisTurn = true
      if (code === BURIAL_PIT) {
        const pit = byCode(state, BURIAL_PIT)
        if (pit && api) burialPitChoices(state, inv, pit, api)
      }
      if (code === CHAMBER_OF_TIME && api) chamberEntersPlay(state, api)
      return
    }
    // 探索翻到诡计/敌人时交给共享遭遇规则结算，这里不回写状态。
  },

  locationRevealed(state, location, api) {
    if (original(location) === CHAMBER_OF_TIME) chamberEntersPlay(state, api)
  },

  // 04064 华美石室：调查未超过难度 2 点时，先把 1 个线索翻成毁灭，再结算其他效果。
  investigateResult(state, inv, location, result, api) {
    if (original(location) !== GRAND_CHAMBER) return
    if (result.success && (result.value - result.difficulty) >= 2) return
    if ((location.clues || 0) <= 0) return
    location.clues -= 1
    location.doom = (location.doom || 0) + 1
    api.info?.(`🪨 华美石室：检定未超过难度 2 点，1 个线索翻至毁灭面（在发现线索之前）。`)
  },

  locationEntered(state, inv, location, api) {
    if (original(location) !== SECRET_PASSAGE) return
    // 卡面：你或任何一位在秘密通道的调查员带有绳索，就能忽略此效果。
    const present = state.investigators.filter(entry =>
      !entry.defeated && !entry.resigned && entry.location === location.id)
    const hasRope = typeof api.checkSupplies === 'function'
      && present.some(entry => api.checkSupplies(entry.seat, 'rope'))
    if (hasRope) {
      api.info?.('🪢 有绳索，秘密通道的强制效果被忽略。')
      return
    }
    const answer = api.choose({
      kind: 'harm', source: SECRET_PASSAGE, seat: inv.seat,
      prompt: '秘密通道：受到 1 点伤害和 1 点恐惧，或在秘密通道上放置 1 点毁灭。',
      options: [
        { id: 'harm', label: '受到 1 点伤害和 1 点恐惧' },
        { id: 'doom', label: '在秘密通道放置 1 点毁灭' },
      ],
    })
    if (answer === 'doom') location.doom = (location.doom || 0) + 1
    else {
      api.damage(inv.seat, 1)
      api.horror(inv.seat, 1)
    }
  },

  // 华美石室：调查未成功或未超过难度至少 2 点时，先把 1 个线索翻成毁灭。
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    tfaChaosAfterTest('theDoomOfEztli', state, inv, result, api)
    const source = result?.source || {}
    if (String(source.code) !== GRAND_CHAMBER || source.label !== '调查') return
    const margin = Number(result.value ?? 0) - Number(result.difficulty ?? 0)
    if (result.success && margin >= 2) return
    flipClueToDoom(state, byCode(state, GRAND_CHAMBER), api)
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('theDoomOfEztli', state, inv, token, api)
  },

  // 古代石厅：轮末把 1 个线索翻成毁灭；在该地点的调查员可以花 3 资源取消。
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    const hall = byCode(state, ANCIENT_HALL)
    if (!hall || (hall.clues || 0) <= 0) return
    const payers = active(state).filter(inv => inv.location === hall.id && (inv.resources || 0) >= 3)
    let cancelled = false
    if (payers.length) {
      const answer = api.choose({
        kind: 'harm', source: ANCIENT_HALL, seat: payers[0].seat, canSkip: true,
        prompt: '古代石厅：是否花费 3 资源取消「把 1 个线索翻成毁灭标记」？',
        options: [
          ...payers.map(inv => ({ id: String(inv.seat), label: `${inv.name} 花费 3 资源` })),
          { id: 'skip', label: '不花费（翻面）' },
        ],
      })
      const payer = payers.find(inv => String(inv.seat) === String(answer))
      if (payer) {
        payer.resources -= 3
        cancelled = true
        api.info?.(`💰 ${payer.name} 花费 3 资源取消了古代石厅的强制效果。`)
      }
    }
    if (!cancelled) flipClueToDoom(state, hall, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  // 地下遗迹：其中的敌人离场后在其上放 1 点毁灭。
  enemyDefeated(state, enemy, api) {
    const ruins = byCode(state, UNDERGROUND_RUINS)
    if (ruins && enemy?.location === ruins.id) {
      ruins.doom = (ruins.doom || 0) + 1
      api?.info?.(`🌑 有敌人离开「地下遗迹」：在其上放置 1 点毁灭（毁灭 ${ruins.doom}）。`)
    }
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },

  enemyDiscarded(state, enemy, api) {
    const ruins = byCode(state, UNDERGROUND_RUINS)
    if (ruins && enemy?.location === ruins.id) ruins.doom = (ruins.doom || 0) + 1
    return encounterRules.enemyDiscarded?.(state, enemy, api) || false
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    if (original(enemy) !== HARBINGER) return
    enemy.resources = enemy.resources || 0
    enemy.tfaRetaliateWhileExhausted = true
    if (!enemy.damageTaken && state.scenarioFlags?.harbingerDamage) {
      enemy.damageTaken = state.scenarioFlags.harbingerDamage
    }
  },

  // 卡面：成功攻击或躲避后放 1 资源，满 2[per_investigator] 时遁去身影。
  // P2：统一由 encounter-rules 的共享钩子结算，跨章一致。
  enemyAttackedSuccessfully(state, inv, enemy, api) {
    return encounterRules.enemyAttackedSuccessfully?.(state, inv, enemy, api)
  },

  afterEvade(state, inv, enemy, result, api) {
    return encounterRules.afterEvade?.(state, inv, enemy, result, api)
  },

  // 逃出遗迹正面：胜利区有 3 点以上复仇时，每个蛇族敌人 +1 躲避值。
  enemyStatModifier(state, enemy, stat) {
    let value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (stat === 'evade' && original(state.acts[state.actIndex]) === '04059'
      && encounterRules.inPlayVengeance(state) >= 3 && hasTrait(enemy, 'Serpent')) value += 1
    return value
  },

  actions(state, inv) {
    const moves = []
    if (original(here(state, inv)) !== ENTRYWAY) return moves
    moves.push({ action: 'scenarioAction', rule: 'resignEntryway', label: '🚪 撤退：你暂时……逃出来了' })
    // 卡面：只有带火把才能用这个行动；没有火把不显示按钮。
    const supplies = state.campaign?.supplies?.[inv.seat] || inv.supplies || []
    if (supplies.includes('torches')) {
      moves.push({ action: 'scenarioAction', rule: 'searchWithTorches', label: '🔥 检查补给：用火把查看探索牌库顶 2 张' })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'resignEntryway') {
      api.resign(inv.seat)
      return
    }
    if (move.rule === 'searchWithTorches') {
      if (!api.checkSupplies?.(inv.seat, 'torches')) {
        api.info?.('检查补给：你们没有火把，这次行动没有效果。')
        return
      }
      const deck = state.explorationDeck || []
      const top = deck.slice(-2).reverse()
      if (!top.length) {
        api.info?.('探索牌库是空的。')
        return
      }
      const kept = []
      const looked = top.map(code => ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code)
      api.info?.(`🔥 火把照亮了「${looked.join('」「')}」。`)
      for (const code of top) {
        const card = ALL_CARDS[code]
        const isTreachery = card?.type === 'treachery'
          || Object.values(state.scenario.treacheries || {}).some(entry => original(entry) === code)
        if (isTreachery) {
          state.encounterDiscard.push(code)
          api.info?.(`🗑️ 查看了「${card?.nameZh || card?.name || code}」并弃掉它。`)
        } else kept.push(code)
      }
      const rest = deck.slice(0, Math.max(0, deck.length - 2))
      state.explorationDeck = shuffleWith([...rest, ...kept], () => api.random())
      api.info?.('🔥 火把照亮了前路：探索牌库已重新洗混。')
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知埃兹特里覆灭行动：${move.rule}`)
  },

  actReveal(state, act, api) {
    actRuleFor(String(original(act)))?.onReveal?.(state, act, api)
  },

  agendaReveal(state, agenda, api) {
    agendaRuleFor(String(original(agenda)))?.onReveal?.(state, agenda, api)
  },

  checkObjectives(state, api) {
    const act = state.acts[state.actIndex]
    if (String(original(act)) !== '04059') return
    // 逃出遗迹：所有未被击败的调查员都撤退后推进。
    const undefeated = state.investigators.filter(inv => !inv.defeated)
    if (undefeated.length && undefeated.every(inv => inv.resigned)) api.advanceAct()
  },

  // 最后一位调查员撤退时引擎会直接判「无结局」；逃出遗迹要靠推进场景来判定结局 1/3。
  allResigned(state, api) {
    const act = state.acts[state.actIndex]
    if (String(original(act)) === '04059') api.advanceAct()
  },

  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },
}

function applyRelicToDeck(state, api) {
  const records = recordsFor(state)
  // 引擎里 campaign.investigators 是按座位索引的对象，测试里可能是数组。
  // 「已经拥有」只看战役牌组：场上的剧情资产在结算时会离开游戏。
  const already = Object.values(state.campaign.investigators || {})
    .some(record => (record?.deck || []).includes(RELIC_OF_AGES))
  if (already) return null
  const candidates = state.investigators.filter(inv => state.campaign.investigators?.[inv.seat])
  const usable = candidates.filter(inv => (state.campaign.investigators[inv.seat].status || 'active') === 'active')
  const pool = usable.length ? usable : candidates
  const preferred = state.relicOfAges?.seat
  // Haskell 用 allInvestigators（含已撤退者）：结局 1 正是「带着遗物撤退」。
  let owner = pool.find(inv => inv.seat === preferred)
  // 没有控制者时由队长选择由谁把遗物带回牌库（多人时不再自动挑领队）。
  if (!owner && pool.length > 1 && typeof api?.choose === 'function') {
    const answer = api.choose({
      kind: 'investigator', source: '04059', seat: state.campaign.leadSeat ?? 0,
      prompt: '选择一位调查员：古代遗物将加入他/她的牌库。',
      options: pool.map(inv => ({ id: String(inv.seat), label: inv.name })),
    })
    owner = pool.find(inv => String(inv.seat) === String(answer))
  }
  owner ||= pool.find(inv => inv.seat === (state.campaign.leadSeat ?? 0)) || pool[0]
  if (!owner) return null
  campaignCardChange(state.campaign, owner.seat, RELIC_OF_AGES, 'add', state.scenario.id)
  records.theInvestigatorsRecoveredTheRelicOfAges = true
  return owner.seat
}

// Haskell：记录 TheHarbingerIsStillAlive = 预示者上的伤害数（在场或放在一边都算）。
function recordHarbingerDamage(state) {
  const inPlay = harbingerOf(state)
  const damage = inPlay ? (inPlay.damageTaken || 0) : Number(state.scenarioFlags?.harbingerDamage || 0)
  recordsFor(state).theHarbingerIsStillAlive = damage
  return damage
}

// 伊格之怒 ≥ 4 时，被击败的调查员在结算中死亡；否则复仇 +3（Haskell ScenarioResolution）。
function applyDefeatedInvestigators(state, api) {
  const defeated = state.investigators.filter(inv => inv.defeated && !inv.resigned)
  if (!defeated.length) return []
  const records = recordsFor(state)
  const killed = []
  if (Number(records.yigsFury || 0) >= 4) {
    for (const inv of defeated) {
      const record = state.campaign.investigators?.[inv.seat]
      if (!record) continue
      // Haskell `kill attrs`：这些调查员在战役记录里死亡（不再只是创伤）。
      record.status = 'killed'
      killed.push(inv.seat)
      api?.info?.(`☠️ 伊格之怒已达 4 点：${inv.name} 没能离开遗迹。`)
    }
    // 全员被击败：战役到此为止（不再有下一关）。
    if (!state.investigators.some(inv => !inv.defeated && !inv.resigned)) state.campaign.failed = true
  } else {
    records.yigsFury = Number(records.yigsFury || 0) + 3
  }
  // 全员被击败（无论伊格之怒多少）都意味着没有人能继续战役。
  if (!state.investigators.some(inv => !inv.defeated && !inv.resigned)) state.campaign.failed = true
  return killed
}

function applyResolution(state, key, events, api, defeatedApplied = false) {
  const known = ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5']
  if (!known.includes(key)) throw new Error('未知埃兹特里覆灭结局')
  const records = recordsFor(state)
  state.scenarioFlags ||= {}
  if (key === 'noResolution') {
    // 卡面：无人被击败 → 结局 3；有人被击败时先按伊格之怒处理
    // （<4 加 3 点后走结局 2；≥4 杀死被击败者，若全员被击败则战役失败），
    // 再走结局 2。被击败者的处理放在最终分支里执行一次，避免递归重复结算。
    const defeated = state.investigators.filter(inv => inv.defeated && !inv.resigned)
    return applyResolution(state, defeated.length ? 'r2' : 'r3', events, api)
  }
  if (!defeatedApplied) applyDefeatedInvestigators(state, api)
  if (key === 'r1') {
    applyRelicToDeck(state, api)
    records.theInvestigatorsRecoveredTheRelicOfAges = true
    recordHarbingerDamage(state)
    recordVengeance(state)
    return { award: true, bonus: 0 }
  }
  if (key === 'r2') {
    records.alejandroRecoveredTheRelicOfAges = true
    recordHarbingerDamage(state)
    recordVengeance(state)
    return { award: true, bonus: 0 }
  }
  if (key === 'r5') {
    applyRelicToDeck(state, api)
    records.theInvestigatorsRecoveredTheRelicOfAges = true
    recordHarbingerDamage(state)
    recordVengeance(state)
    // addVengeance "ruinsDestroyed" 10
    records.yigsFury = Number(records.yigsFury || 0) + 10
    return { award: true, bonus: 0 }
  }
  if (key === 'r4') {
    // 结局 4：重演本场冒险。重演次数写进战役记录（跨关保留），下一次布置会在遗迹入口
    // 放置同样数量的毁灭；引擎的 restartScenario 会把同一剧本原地重开。
    records.resolution4Count = Number(records.resolution4Count || 0) + 1
    state.scenarioFlags.resolution4Count = records.resolution4Count
    const restarted = typeof api?.restartScenario === 'function' ? api.restartScenario() : false
    return { award: false, bonus: 0, restarted }
  }
  if (key !== 'r3') throw new Error(`未知埃兹特里覆灭结局：${key}`)
  // 结局 3：队长选择回到其中（结局 4）或摧毁此处（结局 5）。
  const answer = typeof api?.choose === 'function' ? api.choose({
    kind: 'story', source: '04059', seat: state.campaign.leadSeat ?? 0,
    prompt: '遗迹归于沉寂：你们要回到遗迹深处，还是把这里彻底摧毁？',
    options: [
      { id: 'goBackInside', label: '回到遗迹深处（结局 4）' },
      { id: 'destroy', label: '摧毁此处（结局 5）' },
    ],
  }) : 'destroy'
  state.scenarioFlags.finalChoice = answer === 'goBackInside' ? 'goBackInside' : 'destroy'
  if (answer === 'goBackInside') return applyResolution(state, 'r4', events, api, true)
  return applyResolution(state, 'r5', events, api, true)
}
