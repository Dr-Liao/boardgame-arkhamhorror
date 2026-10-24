// 每章的混乱标记表来自 Haskell Scenario/Scenarios/TheForgottenAge/*.hs 的
// getChaosTokenValue，四档难度按「简单/普通」与「困难/专家」两组取值。
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { isPoisonThreat } from '../../../src/cards/card-rules.js'
import { encounterRules } from './encounter-rules.js'

const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const here = (state, inv) => state.locations.find(location => location.id === inv.location)
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const traitsOf = (card, trait) => (card?.traits || []).some(value => String(value).toLowerCase() === trait.toLowerCase())
// 中毒判定走条目读点（04102 的 poisonThreat），不在内容层写死卡号。
const isPoisoned = inv => (inv?.threat || []).some(card => isPoisonThreat(card?.originalCode || card?.code))
  || inv?.poisoned === true
const fx = (delta, extra = {}) => ({ delta, ...extra })
const nearest = (state, from, filter) => {
  if (!from) return null
  const seen = new Set([from]), queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    const candidates = state.enemies.filter(enemy => enemy.location === id && filter(enemy))
    if (candidates.length) return candidates[0]
    for (const next of state.locations.find(entry => entry.id === id)?.connections || []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return null
}
const distance = (state, from, to) => {
  if (from === to) return 0
  const seen = new Set([from]), queue = [[from, 0]]
  while (queue.length) {
    const [id, steps] = queue.shift()
    for (const next of state.locations.find(entry => entry.id === id)?.connections || []) {
      if (next === to) return steps + 1
      if (seen.has(next)) continue
      seen.add(next)
      queue.push([next, steps + 1])
    }
  }
  return Number.POSITIVE_INFINITY
}
const cultists = state => state.enemies.filter(enemy => traitsOf(enemy, 'Cultist'))
const doomLocations = state => state.locations.filter(location => (location.doom || 0) > 0)
// 场上毁灭标记总数（地点 + 敌人 + 支援/剧情资产），04113 困难面 [skull] 用。
const doomInPlay = state => (Number(state.doom) || 0) + [
  ...(state.locations || []), ...(state.enemies || []),
  ...(state.storyAssets || []), ...(state.investigators || []).flatMap(inv => [...(inv.assets || []), ...(inv.threat || [])]),
].reduce((sum, card) => sum + (card.doom || 0), 0)

export function tfaChaosToken(id, state, inv, token, api) {
  if (!['skull', 'cultist', 'tablet', 'elderthing'].includes(token)) return null
  // 久远腹地上下两半共用同一张剧本卡与同一条标记表。
  if (id === 'heartOfTheEldersPart1' || id === 'heartOfTheEldersPart2') id = 'heartOfTheElders'
  const hard = hardSide(state)
  if (id === 'theUntamedWilds') {
    if (token === 'skull') {
      const vengeance = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
      return fx(-(vengeance + Number(hard)))
    }
    if (token === 'cultist') {
      const count = state.locations.length
      return fx(-(hard ? count : Math.min(5, count)))
    }
    if (token === 'tablet') {
      const count = (state.explorationDeck || []).length
      return fx(-(hard ? Math.max(3, count) : Math.min(5, count)))
    }
    return isPoisoned(inv) ? fx(0, { autoFail: true }) : fx(hard ? -3 : -2)
  }
  if (id === 'theDoomOfEztli') {
    if (token === 'skull') {
      const doomed = (here(state, inv)?.doom || 0) > 0
      return fx(doomed ? (hard ? -4 : -3) : (hard ? -2 : -1))
    }
    if (token === 'cultist' || token === 'tablet') {
      const count = hard
        ? doomLocations(state).reduce((sum, location) => sum + (location.doom || 0), 0)
        : doomLocations(state).length
      return fx(-count)
    }
    return fx(0, { drawAnother: true, placeDoomOnFail: true })
  }
  if (id === 'threadsOfFate') {
    if (token === 'skull') {
      const easy = cultists(state).reduce((max, enemy) => Math.max(max, enemy.doom || 0), 0)
      return fx(-(hard ? doomInPlay(state) : easy))
    }
    if (token === 'cultist') return fx(hard ? -2 : -2, { notSucceedByOne: 'damage' })
    if (token === 'tablet') return fx(hard ? -2 : -2, { notSucceedByOne: 'doomNearestCultist' })
    return fx(hard ? -3 : -2, { loseClueOnFail: true })
  }
  if (id === 'theBoundaryBeyond') {
    if (token === 'skull') {
      const ancient = traitsOf(here(state, inv), 'Ancient')
      return fx(-(hard ? 2 + (ancient ? 2 : 0) : 1 + (ancient ? 2 : 0)))
    }
    if (token === 'cultist') return fx(0, { drawAnother: true, doomOnFail: 'cultist' })
    if (token === 'tablet') return fx(0, { drawAnother: true, serpentAttackOnFail: true })
    return fx(-4, { clueOnNearestAncientOnFail: true })
  }
  if (id === 'heartOfTheElders') {
    if (token === 'skull') {
      const cave = traitsOf(here(state, inv), 'Cave')
      return fx(-(hard ? 2 + (cave ? 2 : 0) : 1 + (cave ? 2 : 0)))
    }
    if (token === 'cultist') return fx(hard ? -3 : -2, { doomOnFail: 'location' })
    if (token === 'tablet') return isPoisoned(inv) ? fx(0, { autoFail: true }) : fx(hard ? -3 : -2)
    return fx(hard ? -4 : -3, { horrorOnFail: 1 })
  }
  if (id === 'theCityOfArchives') {
    if (token === 'skull') {
      const many = (inv.hand || []).length >= 5
      if (many) return hard ? fx(0, { autoFail: true }) : fx(-3)
      return fx(hard ? -2 : -1)
    }
    if (token === 'cultist' || token === 'elderthing') return fx(-2, { placeClueOnFail: true })
    return fx(-3, { discardRandomOnFail: 1 })
  }
  if (id === 'theDepthsOfYoth') {
    if (token === 'skull') return fx(-currentDepth(state))
    if (token === 'cultist') return fx(0, { drawAnother: true, healSerpentOnFail: true })
    if (token === 'tablet') return fx(0, { drawAnother: true, clueOnLocationOnFail: true })
    // 旧神标记：胜利区（含 04287/04288 视同胜利区）至少 3 点复仇时自动失败。
    const vengeance = encounterRules.inPlayVengeance(state)
    return vengeance >= 3 ? fx(0, { autoFail: true }) : fx(hard ? -4 : -2)
  }
  if (id === 'shatteredAeons') {
    if (token === 'skull') {
      const relic = state.relicOfAges
      const carrier = relic?.seat != null ? state.investigators[relic.seat]?.location : null
      const bearing = !!relic && (carrier === inv.location || relic.location === inv.location)
      return fx(bearing ? (hard ? -5 : -4) : (hard ? -3 : -2))
    }
    if (token === 'cultist') return fx(hard ? -3 : -2, { notSucceedByOne: 'doomNearestCultist' })
    if (token === 'tablet') return isPoisoned(inv) ? fx(0, { autoFail: true }) : fx(hard ? -3 : -2)
    return fx(hard ? -3 : -2, { hexIntoExplorationOnFail: true })
  }
  if (id === 'turnBackTime') {
    if (token === 'skull') {
      const total = doomLocations(state).reduce((sum, location) => sum + (location.doom || 0), 0)
      return fx(-(hard ? total : doomLocations(state).length))
    }
    if (token === 'cultist' || token === 'tablet') return fx(0)
    return fx(hard ? -6 : -4, { doomOnFail: 'location' })
  }
  return null
}

export function currentDepth(state) {
  return Math.max(1, Number(state.scenarioFlags?.depthLevel || 1))
}

export function tfaChaosAfterTest(id, state, inv, result, api) {
  if (id === 'heartOfTheEldersPart1' || id === 'heartOfTheEldersPart2') id = 'heartOfTheElders'
  const tokens = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
  const has = token => tokens.includes(token)
  const hard = hardSide(state)
  const failed = !result.success
  const margin = result.success ? (result.value - result.difficulty) : 0
  const notSucceedByOne = result.success && margin < 1
  const placeDoom = target => {
    if (!target) return
    target.doom = (target.doom || 0) + 1
    api.info?.(`🌑 「${target.name}」上放置 1 点毁灭。`)
  }
  const location = here(state, inv)

  if (id === 'theUntamedWilds') {
    if (failed && has('elderthing') && hard) api.poison(inv.seat)
    return
  }
  if (id === 'theDoomOfEztli') {
    // 困难/专家面：旧神标记不要求失败也放毁灭（简单/普通只在失败时）。
    if (has('elderthing') && location && (hard || failed)) placeDoom(location)
    return
  }
  if (id === 'threadsOfFate') {
    // 困难/专家：cultist 要求「成功超过难度至少 2 点」，否则受到 1 点直接伤害；
    // tablet 同理，改为在每个异教徒敌人上各放 1 毁灭。
    const hardCultist = failed || margin < 2
    if (hard ? hardCultist : (failed || notSucceedByOne)) {
      if (has('cultist')) {
        if (hard) api.directDamage?.(inv.seat, 1)
        else api.damage(inv.seat, 1)
      }
      if (has('tablet')) {
        const targets = cultists(state)
        if (hard) for (const enemy of targets) placeDoom(enemy)
        else placeDoom(nearest(state, inv.location, enemy => traitsOf(enemy, 'Cultist')))
      }
    }
    if (failed && has('elderthing') && inv.clues > 0) {
      // 「失去 1 个线索」：真正失去，不再放回当前地点让人捡回来。
      inv.clues -= 1
      api.info?.(`🔍 ${inv.name} 失去了 1 个线索。`)
    }
    return
  }
  if (id === 'theBoundaryBeyond') {
    const hard = hardSide(state)
    const pickOne = (list, prompt, kind = 'target') => {
      if (!list.length) return null
      if (list.length === 1 || typeof api?.choose !== 'function') return list[0]
      const answer = api.choose({
        kind, source: 'theBoundaryBeyond', seat: inv.seat, prompt,
        options: list.map((item, index) => ({ id: String(item.id ?? index), label: item.name || String(item) })),
      })
      return list.find((item, index) => String(item.id ?? index) === String(answer)) || list[0]
    }
    // [cultist]：失败时在一个异教徒敌人上放 1 毁灭（困难/专家改为每个）。
    if (failed && has('cultist')) {
      const targets = cultists(state)
      if (hard) for (const enemy of targets) placeDoom(enemy)
      else {
        const chosen = pickOne(targets, '选择要放置 1 个毁灭标记的异教徒敌人。', 'enemy')
        if (chosen) placeDoom(chosen)
      }
    }
    // [tablet]：失败时你所在地点的一个蛇族敌人攻击你（困难/专家改为每个）。
    if (failed && has('tablet')) {
      const serpents = state.enemies.filter(entry => entry.location === inv.location && traitsOf(entry, 'Serpent'))
      const attackers = hard ? serpents : [pickOne(serpents, '选择攻击你的蛇族敌人。', 'enemy')].filter(Boolean)
      for (const enemy of attackers) api.attack(enemy, inv)
    }
    // [elderthing]：在最近的古代地点放 1 线索；简单/普通只在失败时，困难/专家总是。
    if (has('elderthing') && (hard || failed)) {
      const ancient = state.locations.filter(entry => traitsOf(entry, 'Ancient'))
      if (!ancient.length) return
      const scored = ancient.map(entry => ({ entry, steps: distance(state, inv.location, entry.id) }))
        .sort((left, right) => left.steps - right.steps)
      const nearest = scored.filter(item => item.steps === scored[0].steps)
      const chosen = pickOne(nearest.map(item => item.entry), '选择要放置 1 个线索的古代地点。', 'location') || scored[0].entry
      chosen.clues = (chosen.clues || 0) + 1
    }
    return
  }
  if (id === 'heartOfTheElders') {
    if (failed && has('cultist') && location) placeDoom(location)
    if (failed && has('elderthing')) api.horror(inv.seat, 1)
    // 困难/专家：未中毒且检定失败时，把放在一边的一张「中毒」放入威胁区域。
    if (failed && hard && has('tablet') && !isPoisoned(inv)) {
      api.poison(inv.seat)
      const setAside = state.scenarioZones?.setAside
      const index = Array.isArray(setAside) ? setAside.indexOf('04102') : -1
      if (index >= 0) setAside.splice(index, 1)
    }
    return
  }
  if (id === 'theCityOfArchives') {
    const hard = hardSide(state)
    // [cultist]/[elderthing]：普通面失败时、困难面无论成败都要把 1 个线索放到所在地点。
    if (has('cultist') || has('elderthing')) {
      if ((failed || hard) && (inv.clues || 0) > 0) {
        inv.clues -= 1
        if (location) location.clues = (location.clues || 0) + 1
      }
    }
    // [tablet]：普通面失败弃 1 张；困难面每低于难度 1 点弃 1 张。
    if (has('tablet') && failed) {
      const count = hard ? Math.max(1, (Number(result.difficulty) || 0) - (Number(result.value) || 0)) : 1
      for (let index = 0; index < count; index++) api.discardRandom(inv.seat, 1)
    }
    return
  }
  if (id === 'theDepthsOfYoth') {
    if (!failed) return
    if (has('cultist')) {
      for (const enemy of state.enemies.filter(entry => (entry.location === inv.location
        || (location?.connections || []).includes(entry.location)) && traitsOf(entry, 'Serpent'))) {
        enemy.damageTaken = Math.max(0, (enemy.damageTaken || 0) - 2)
      }
    }
    if (has('tablet') && location) location.clues = (location.clues || 0) + 1
    return
  }
  if (id === 'shatteredAeons') {
    if ((failed || notSucceedByOne) && has('cultist')) {
      const targets = state.enemies.filter(enemy => traitsOf(enemy, 'Cultist'))
      if (hard) for (const enemy of targets) placeDoom(enemy)
      else placeDoom(nearest(state, inv.location, enemy => traitsOf(enemy, 'Cultist')))
    }
    // [elderthing]：失败时把遭遇弃牌堆顶的第一张巫术诡计洗回探索牌库；
    // 困难/专家的卡面没有失败条件，成功也要洗回。
    if ((failed || hard) && has('elderthing')) {
      const index = state.encounterDiscard.findIndex(code =>
        (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'hex'))
      if (index >= 0) {
        const [code] = state.encounterDiscard.splice(index, 1)
        state.explorationDeck ||= []
        // 随机插入（洗回），不是放到牌库顶。
        const at = Math.floor((api?.random?.() ?? 0.5) * (state.explorationDeck.length + 1))
        state.explorationDeck.splice(at, 0, code)
      }
    }
    return
  }
  if (id === 'turnBackTime') {
    // 困难/专家面：旧神标记不要求失败也放毁灭。
    if (has('elderthing') && location && (hard || failed)) placeDoom(location)
  }
}

export const TFA_CHAOS_SCENARIOS = Object.freeze([
  'theUntamedWilds', 'theDoomOfEztli', 'threadsOfFate', 'theBoundaryBeyond',
  'heartOfTheEldersPart1', 'heartOfTheEldersPart2', 'theCityOfArchives',
  'theDepthsOfYoth', 'shatteredAeons', 'turnBackTime',
])

export const activeInvestigators = active
