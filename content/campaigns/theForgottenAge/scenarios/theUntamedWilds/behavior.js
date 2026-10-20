import { changeChaosBag } from '../../../../../src/engine/chaos-bag.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules } from '../../encounter-rules.js'
import { tfaChaosToken, tfaChaosAfterTest } from '../../tfa-chaos.js'
import { syncSymbolConnections } from '../../card-data.js'
import { EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES, RUINS_LOCATIONS } from './definition.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const recordsFor = state => (state.campaign.records ||= {})
const original = card => card?.originalCode || card?.code
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const traits = card => (ALL_CARDS[original(card)]?.traits || card?.traits || [])
const hasTrait = (card, trait) => traits(card).includes(trait)
const isPoisoned = inv => (inv?.threat || []).some(card => card.code === '04102') || inv?.poisoned === true
const AGENTS_OF_YIG = ['04083', '04084', '04085']

// 本章逐条实现的敌人/诡计原卡号（供迁移审计核对，不实现的不列）。
export const implementedEncounterCodes = [
  '01166', // 远古恶魔：核心遭遇卡，由共享解析器处理
  '04052', '04076', '04077', '04078', '04079', '04080', '04081', '04082',
  '04083', '04084', '04085', '04086', '04087', '04101', '04102',
]

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
  id: 'theUntamedWilds',
  implementedEncounterCodes,
  roundEndActIndex: 0,

  setupPlan,

  setupLocations(state, events, helper = {}) {
    const plan = setupPlan(state, helper)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      '04051', '04052', '04053', '04074', '04075', '04102', '04102', '04102', '04102',
      ...AGENTS_OF_YIG,
    ]
    state.scenarioZones.removed = []
    state.scenarioZones.explorationLocations = [...plan.locations]
    state.explorationDeck = [...plan.explorationDeck]
    state.explorationDiscard = []
    state.scenarioFlags ||= {}
    state.scenarioFlags.ichtacaSpawned = false
    return ['expeditionCamp']
  },

  setupEnemies() {
    // 开场只有营地；伊塔卡、亚历山卓与三处遗迹都在一边。
  },

  canExplore(state, inv) {
    return encounterRules.canExplore(state, inv)
  },

  // 索桥：探索前必须检定敏捷；失败则取消本次探索并结束回合。
  beforeExplore(state, inv, api) {
    const location = here(state, inv)
    const code = original(location)
    if (code === '04071') {
      let failed = false
      api.test(inv.seat, 'agility', 2, result => {
        if (result.success) return
        failed = true
        api.damage(inv.seat, 2)
        api.loseActions(inv.seat, 99)
        api.endTurn(inv.seat)
      })
      if (failed) {
        const canyon = state.locations.find(entry => original(entry) === '04070')
        if (canyon) api.moveInvestigator(inv.seat, canyon.id)
        else {
          const index = (state.explorationDeck || []).findIndex(entry => entry === 'riverCanyon')
          if (index >= 0) {
            state.explorationDeck.splice(index, 1)
            api.place('riverCanyon')
            api.shuffleExploration?.()
            api.moveInvestigator(inv.seat, 'riverCanyon')
          }
        }
        return false
      }
    }
    if (code === '04073') {
      const hasCompass = api.checkSupplies(inv.seat, 'compass')
      if (!hasCompass) {
        if ((inv.resources || 0) < 3) return false
        inv.resources -= 3
        api.info?.(`曲折小道：${inv.name} 没有指南针，额外花费 3 资源。`)
      }
    }
    return true
  },

  afterExplore(state, inv, context) {
    syncSymbolConnections(state)
    const api = context?.runtime
    const location = here(state, inv)
    const code = original(location)
    // 04072 万蛇据点：「在你调查或探索后，如果你已中毒：受到 1 点伤害」。
    // 探索成功（翻到连接地点）也要结算，所以放在提前 return 之前。
    if (code === '04072' && isPoisoned(inv) && api) api.damage(inv.seat, 1)
    if (context?.kind === 'location') {
      state.explorationDiscard ||= []
      inv.tfaExploredThisTurn = true
      return
    }
    // 探索失败：抽到的是诡计/敌人。
    if (code === '04069' && api) api.damage(inv.seat, 1)
  },

  locationEntered(state, inv, location, api) {
    if (original(location) === '04075' && isPoisoned(inv)) {
      inv.actionsLeft = 0
      inv.turnEnded = true
      api?.info?.(`🕳️ ${inv.name} 已中毒：进入漆黑洞穴后立即失去所有行动并结束回合。`)
    }
  },

  // ---- 场景 3 的正面持续效果（P2：04048 / 04049）----
  // 04048 搜索遗迹：埃兹特里的守卫者（04086）不能攻击，也不能被攻击；
  // 「林中暗箭」（04087）的效果被忽略（引擎在诡计结算前读这个钩子）。
  enemyCannotAttack(state, enemy) {
    return state.scenarioFlags?.actThree === 'search' && original(enemy) === '04086'
  },

  enemyCannotBeAttacked(state, enemy) {
    return state.scenarioFlags?.actThree === 'search' && original(enemy) === '04086'
  },

  ignoreTreachery(state, code) {
    return state.scenarioFlags?.actThree === 'search' && original({ code }) === '04087'
  },

  // 04049 守备森严的遗迹：守卫者 +1 战斗 +1 躲避。
  // 04072 万蛇据点：此处的每个蛇族敌人 +1 攻击值。
  enemyStatModifier(state, enemy, stat) {
    const value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (state.scenarioFlags?.actThree === 'guarded' && original(enemy) === '04086'
      && (stat === 'fight' || stat === 'evade')) return value + 1
    if (stat === 'fight' && hasTrait(enemy, 'Serpent')) {
      const location = state.locations.find(entry => entry.id === enemy.location)
      if (original(location) === '04072') return value + 1
    }
    return value
  },

  // 04074 毒牙神庙：胜利区每有一点复仇点数，帷幕 +1。
  locationShroudModifier(state, location) {
    const base = encounterRules.locationShroudModifier?.(state, location) || 0
    if (original(location) !== '04074') return base
    const vengeance = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
    return base + vengeance
  },

  // 04049：「林中暗箭」获得涌动。
  encounterGainsSurge(state, code, api) {
    if (state.scenarioFlags?.actThree === 'guarded' && original({ code }) === '04087') return true
    return encounterRules.encounterGainsSurge?.(state, code, api)
  },

  afterTest(state, inv, result, api) {
    tfaChaosAfterTest('theUntamedWilds', state, inv, result, api)
    const investigating = result?.source?.label === '调查'
    const location = here(state, inv)
    const code = original(location)
    if (!result.success && investigating && code === '04069') api.damage(inv.seat, 1)
    if (code === '04072' && isPoisoned(inv) && (result.source?.label === '调查')) api.damage(inv.seat, 1)
    // 04053 埃兹特里的遗迹：在遗迹调查失败后抽 1 张遭遇卡。
    if (!result.success && investigating && code === '04053') api.drawEncounter(inv.seat)
  },

  resolveChaosToken(state, inv, token, api) {
    return tfaChaosToken('theUntamedWilds', state, inv, token, api)
  },

  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    const code = original(location)
    if (code === '04050') {
      moves.push({ action: 'scenarioAction', rule: 'resignCamp', label: '⛺ 撤退：荒野实在太危险了！' })
      // 卡面：只有带有地图才能用「检查补给」看探索牌库顶 3 张；没有地图不显示按钮。
      const supplies = state.campaign?.supplies?.[inv.seat] || inv.supplies || []
      if (supplies.includes('map')) {
        moves.push({ action: 'scenarioAction', rule: 'mapSupplies', label: '🗺️ 检查补给：用地图查看探索牌库顶 3 张' })
      }
    }
    if (code === '04070' && !state.scenarioFlags?.riverCanyonHealed) {
      moves.push({ action: 'scenarioAction', rule: 'healRiverCanyon', label: '💧 治愈所在调查员 1 点伤害（有水壶再额外 2 点）' })
    }
    const ichtaca = state.enemies.find(enemy => original(enemy) === '04052' && enemy.location === inv.location)
    if (ichtaca) moves.push({
      action: 'scenarioAction', rule: 'parleyIchtaca', enemyId: ichtaca.id,
      label: '🗣️ 谈判：检定智识(4)说服伊塔卡',
    })
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'resignCamp') {
      api.resign(inv.seat)
      return
    }
    if (move.rule === 'mapSupplies') {
      if (!api.checkSupplies(inv.seat, 'map')) {
        api.info?.('检查补给：队伍中没有地图，这次行动没有效果。')
        return
      }
      const top = (state.explorationDeck || []).slice(-3).reverse()
      if (!top.length) return
      const bottom = api.choose({
        kind: 'deck', source: '04050', seat: inv.seat,
        prompt: '选择 1 张放在探索牌库底部（其余 2 张按原顺序放回顶）。',
        options: top.map((code, index) => ({
          id: String(index), label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
        })),
      })
      const picked = top[Number(bottom)] || top[0]
      const rest = top.filter(entry => entry !== picked)
      // 其余 2 张也要「按任意顺序」放回牌库顶：再问一次谁在最上面。
      const firstAnswer = rest.length === 2
        ? api.choose({
          kind: 'deck', source: '04050', seat: inv.seat,
          prompt: '选择其余 2 张中先放回牌库顶的那张（另一张在它下面）。',
          options: rest.map((code, index) => ({
            id: String(index), label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
          })),
        })
        : '0'
      const first = rest[Number(firstAnswer)] || rest[0]
      const ordered = rest.length === 2 ? [first, rest.find(entry => entry !== first)] : rest
      state.explorationDeck = [
        ...(state.explorationDeck || []).slice(0, Math.max(0, state.explorationDeck.length - 3)),
        ...[...ordered].reverse(),
        picked,
      ]
      api.info?.('地图：一张牌放在探索牌库底部，其余两张按你选择的顺序回到顶部。')
      return
    }
    if (move.rule === 'healRiverCanyon') {
      state.scenarioFlags ||= {}
      state.scenarioFlags.riverCanyonHealed = true
      api.healDamage(inv.seat, 1)
      if (api.checkSupplies(inv.seat, 'canteen')) api.healDamage(inv.seat, 2)
      return
    }
    if (move.rule === 'parleyIchtaca') {
      const enemy = state.enemies.find(entry => entry.id === move.enemyId)
      if (!enemy) return
      api.test(inv.seat, 'intellect', 4, result => {
        if (result.success) {
          enemy.clues = (enemy.clues || 0) + 1
          return
        }
        if (!enemy.exhausted) api.attack(enemy, inv)
      })
      return
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知荒莽密林行动：${move.rule}`)
  },

  actReveal(state, act, api) {
    const code = original(act)
    const records = recordsFor(state)
    if (code === '04046') {
      const lead = state.investigators[state.campaign.leadSeat] || active(state)[0]
      const spawnAt = lead?.location || 'expeditionCamp'
      if (!state.scenarioFlags?.ichtacaSpawned) {
        state.scenarioFlags.ichtacaSpawned = true
        api.spawn('04052', spawnAt)
      }
      state.encounterDeck = [...state.encounterDeck]
      api.shuffleDiscard()
      return
    }
    if (code === '04047') {
      const byClues = state.scenarioFlags.actTwoAdvancedWith !== 'defeat'
      const ichtaca = state.enemies.find(enemy => original(enemy) === '04052')
      if (byClues) {
        if (ichtaca) {
          const index = state.enemies.indexOf(ichtaca)
          state.enemies.splice(index, 1)
          state.victoryDisplay.push({ id: ichtaca.id, code: '04052', originalCode: '04052', victory: 1 })
        }
        records.ichtacaHasConfidenceInYou = true
        records.theInvestigatorsHaveEarnedIchtacasTrust = true
        changeChaosBag(state, 'cultist', 1, { permanent: true })
        state.scenarioFlags.ichtacaLeadsTheWay = true
        state.acts = [state.acts[0], state.acts[1],
          structuredClone(state.scenario.acts.find(card => original(card) === '04048'))]
        // 04048 搜索遗迹（正面持续效果）：守卫者不能攻击也不能被攻击；
        // 忽略每个「林中暗箭」诡计的效果（P2：由引擎钩子读取）。
        state.scenarioFlags.actThree = 'search'
      } else {
        if (ichtaca) {
          const index = state.enemies.indexOf(ichtaca)
          if (index >= 0) state.enemies.splice(index, 1)
        }
        records.theInvestigatorsFoughtWithIchtaca = true
        records.ichtacaIsWaryOfTheInvestigators = true
        changeChaosBag(state, 'tablet', 1, { permanent: true })
        const volunteers = active(state)
        const target = volunteers.length === 1 ? volunteers[0] : api.choose({
          kind: 'investigator', source: '04047', seat: state.campaign.leadSeat,
          prompt: '选择一位调查员控制亚历山卓·维拉。',
          options: volunteers.map(inv => ({ id: String(inv.seat), label: inv.name })),
        })
        const seat = Number(target)
        const owner = state.investigators[Number.isInteger(seat) ? seat : volunteers[0].seat]
        if (owner) api.giveAsset(owner.seat, '04051')
        state.acts = [state.acts[0], state.acts[1],
          structuredClone(state.scenario.acts.find(card => original(card) === '04049'))]
        // 04049 守备森严的遗迹（正面持续效果）：守卫者 +1 战斗 +1 躲避；
        // 「林中暗箭」获得涌动（P2：enemyStatModifier('fight'/'evade') 与 encounterGainsSurge）。
        state.scenarioFlags.actThree = 'guarded'
      }
      for (const id of RUINS_LOCATIONS) {
        if (state.locations.some(location => location.id === id)) continue
        state.explorationDeck.push(id)
      }
      state.explorationDeck = mix(state, api, state.explorationDeck)
      return
    }
    if (code === '04048') { api.finish('r1'); return }
    if (code === '04049') { api.finish('r2'); return }
    throw new Error(`未知荒莽密林场景：${code}`)
  },

  agendaReveal(state, agenda, api) {
    const code = original(agenda)
    if (code === '04044') {
      for (const card of AGENTS_OF_YIG) {
        const index = (state.scenarioZones?.setAside || []).indexOf(card)
        if (index >= 0) state.scenarioZones.setAside.splice(index, 1)
        state.encounterDeck.push(card)
      }
      api.shuffleDiscard()
      for (const inv of active(state)) {
        api.test(inv.seat, 'willpower', 3, result => {
          if (result.success) return
          if (isPoisoned(inv)) {
            api.damage(inv.seat, 1)
            api.horror(inv.seat, 1)
          } else api.poison(inv.seat)
        })
      }
      return
    }
    if (code === '04045') {
      for (const inv of active(state)) {
        if (!isPoisoned(inv)) {
          const list = state.campaign.investigators
          const entry = Array.isArray(list) ? list[inv.seat] : list?.[inv.seat]
          if (entry) {
            entry.removedCards ||= []
            entry.deck?.push?.('04102')
          }
          inv.threat.push({ id: `poisoned-${inv.seat}`, code: '04102', originalCode: '04102', permanent: true })
        }
        api.defeat(inv, null)
      }
      return
    }
    throw new Error(`未知荒莽密林密谋：${code}`)
  },

  checkObjectives(state, api) {
    const act = state.acts[state.actIndex]
    const code = original(act)
    if (code !== '04047') return
    const ichtaca = state.enemies.find(enemy => original(enemy) === '04052')
    if (!ichtaca) {
      if (state.scenarioFlags?.ichtacaSpawned) {
        state.scenarioFlags.actTwoAdvancedWith = 'defeat'
        api.advanceAct()
      }
      return
    }
    if ((ichtaca.clues || 0) >= state.numInvestigators) {
      state.scenarioFlags.actTwoAdvancedWith = 'clues'
      api.advanceAct()
    }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    const act = state.acts[state.actIndex]
    if (original(act) !== '04046') return
    const required = 3 * state.numInvestigators
    const eligible = active(state).filter(inv => !hasTrait(here(state, inv), 'Campsite'))
    const available = eligible.reduce((sum, inv) => sum + (inv.clues || 0), 0)
    if (available < required) return
    const answer = api.choose({
      kind: 'act', source: '04046', seat: state.campaign.leadSeat, canSkip: true,
      prompt: `非营地的调查员共有 ${available} 个线索，可以共同花费 ${required} 个推进场景。`,
      options: [{ id: 'advance', label: `支付 ${required} 个线索并推进` }],
    })
    if (answer !== 'advance') return
    let remaining = required
    for (const inv of eligible) {
      if (!remaining) break
      const pay = Math.min(remaining, inv.clues || 0)
      if (!pay) continue
      inv.clues -= pay
      remaining -= pay
    }
    state.clues = active(state).reduce((sum, inv) => sum + (inv.clues || 0), 0)
    api.advanceAct()
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
  },

  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2'].includes(key)) throw new Error('未知荒莽密林结局')
    const records = recordsFor(state)
    if (key === 'noResolution') {
      records.theInvestigatorsWereForcedToWaitForAdditionalSupplies = true
      if (state.actIndex < 2) {
        records.ichtacaObservedYourProgressWithKeenInterest = true
        records.alejandroFollowedTheInvestigatorsIntoTheRuins = true
        api.giveAsset?.(state.campaign.leadSeat, '04051')
      }
      if (state.scenarioFlags?.tfaFoughtWithIchtaca) {
        records.ichtacaIsWaryOfTheInvestigators = true
        records.alejandroFollowedTheInvestigatorsIntoTheRuins = true
      }
      if (state.scenarioFlags?.ichtacaLeadsTheWay) {
        records.theInvestigatorsHaveEarnedIchtacasTrust = true
        records.alejandroChoseToRemainAtCamp = true
      }
      return { award: true, bonus: 0 }
    }
    if (key === 'r1') {
      records.theInvestigatorsClearedAPathToTheEztliRuins = true
      records.alejandroChoseToRemainAtCamp = true
      records.theInvestigatorsHaveEarnedIchtacasTrust = true
      return { award: true, bonus: 0 }
    }
    records.theInvestigatorsClearedAPathToTheEztliRuins = true
    records.alejandroFollowedTheInvestigatorsIntoTheRuins = true
    records.ichtacaIsWaryOfTheInvestigators = true
    return { award: true, bonus: 0 }
  },
}
