// Shared encounter sets used by multiple chapters. These handlers receive the
// engine adapter and participate in its replayable choices and skill tests.
import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import {
  cluesFromSurvivorsFor, encounterResolveCampaignsFor, encounterResolveFor, enemyRuleFor, enemyScriptFor, enemySpawnRuleFor, scenarioPlayableFor, threatEffectFor, assetRuleFor, treacheryRuleFor,
} from '../../../src/cards/card-rules.js'
import { registeredEntry } from '../../../src/engine/ability.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
const textActive = (state, enemy) => !enemy.textBlanked || enemy.textBlanked.round !== state.round || enemy.textBlanked.phase !== state.phase
const original = card => card?.originalCode || card?.code
// 第 76 轮：威胁区的「盟友文本空白」等限制由 threatEffect 标志声明。
const hasThreatFlag = (inv, flag) => (inv?.threat || []).some(item => threatEffectFor(original(item))?.[flag] === true)

export const encounterRules = {
  canPlayScenarioCard(state, inv, code) {
    return scenarioPlayableFor(code) && state.campaign.investigators[inv.seat]?.deck.includes(code)
  },
  assetEntered(state, inv, asset) {
    const survivors = cluesFromSurvivorsFor(asset.code)
    if (survivors.length) asset.clues = survivors
      .filter(key => state.campaign.records[`${key}SurvivedTheDunwichLegacy`]).length
  },
  spawnLocation(state, code, origin, seat, api) {
    let candidates = null
    const distance = target => {
      const queue = [[origin, 0]], seen = new Set([origin])
      for (const [id, n] of queue) {
        if (id === target) return n
        for (const next of state.locations.find(loc => loc.id === id)?.connections || [])
          if (!seen.has(next)) { seen.add(next); queue.push([next, n + 1]) }
      }
      return Infinity
    }
    const spawnRule = enemySpawnRuleFor(code)
    if (spawnRule?.spawnMode === 'mostClues') { const most = Math.max(...state.locations.map(loc => loc.clues)); candidates = state.locations.filter(loc => loc.clues === most) }
    if (spawnRule?.spawnMode === 'farthest') { const farthest = Math.max(...state.locations.map(loc => distance(loc.id))); candidates = state.locations.filter(loc => distance(loc.id) === farthest) }
    if (spawnRule?.spawnMode === 'empty') candidates = state.locations.filter(loc => !state.enemies.some(enemy => enemy.location === loc.id)
      && !state.investigators.some(inv => !inv.defeated && !inv.resigned && inv.location === loc.id))
    if (spawnRule?.spawnMode === 'nextTrain') return state.scenarioZones.train?.[state.scenarioZones.train.indexOf(origin) + 1] || origin
    if (spawnRule?.spawnMode === 'original') candidates = state.locations.filter(loc => loc.originalCode === spawnRule.spawnFrom)
    if (spawnRule?.spawnMode === 'nearestAltered') {
      const altered = state.locations.filter(loc => loc.traits?.includes('Altered'))
      const nearest = Math.min(...altered.map(loc => distance(loc.id)))
      candidates = altered.filter(loc => distance(loc.id) === nearest)
    }
    if (spawnRule?.spawnMode === 'extradimensional') candidates = state.locations.filter(loc => loc.traits?.includes('Extradimensional'))
    if (candidates == null) return origin
    if (!candidates.length) return null
    if (candidates.length === 1) return candidates[0].id
    return api.choose({ kind: 'spawn', source: code, seat: seat ?? state.campaign.leadSeat,
      prompt: '选择符合生成条件的地点。', options: candidates.map(loc => ({ id: loc.id, label: loc.name })) })
  },
  statModifier(state, inv) {
    // 剧情资产的 +1 修正由 entries/<code>.js 的 modifiers 声明（02061/02080/02140/02217/02218）；
    // 内容层只保留「夜鹰所在地点全属性 -1」这条跨实体规则。
    return -state.enemies.filter(enemy => registeredEntry(original(enemy))?.flags?.nightgaunt && enemy.location === inv.location && textActive(state, enemy)).length
  },
  assetLeftPlay(state, inv, asset) {
    if (!['02138', '02139'].includes(asset.code) || hasThreatFlag(inv, 'blanksAllies')) return
    asset.removedFromGame = true
    state.scenarioZones.removed.push(asset.code)
    changeChaosBag(state, 'tablet', 1, { permanent: true })
  },
  cardDrawn(state, inv, code, api) {
    // Wizard of Yog-Sothoth: "When the engaged investigator draws a [[Hex]] or
    // [[Pact]] card: Wizard of Yog-Sothoth attacks that investigator."
    if (ALL_CARDS[code]?.traits?.some(trait => ['Hex', 'Pact'].includes(trait))) {
      for (const wizard of state.enemies.filter(enemy => enemyScriptFor(original(enemy))?.wizard
        && enemy.engagedSeat === inv.seat && textActive(state, enemy))) api.attack(wizard, inv)
    }
  },
  canGainResources(state, inv) { return !state.enemies.some(enemy => enemyRuleFor(original(enemy))?.blocksResourceGain && enemy.engagedSeat === inv.seat && textActive(state, enemy)) },
  // 关卡 behavior 会无条件调用这两个钩子（历史接口）；具体单卡反应已迁到
  // entries/02061、02080 的线索/击败窗口描述子，这里保留空实现。
  cluesGained() {},
  enemyDefeated() { return false },
  enemyAttackStarted(state, enemy, inv, api) {
    enemyScriptFor(original(enemy))?.onAttackStarted?.(state, enemy, inv, api)
  },
  enemyAttackResolved(state, enemy, inv, api) {
    enemyScriptFor(original(enemy))?.onAttackResolved?.(state, enemy, inv, api)
  },
  enemySpawned(state, enemy, api) {
    // 第 60 轮：生成时的「进入地点」强制也在条目 enemyScript.onSpawn（02329）。
    enemyScriptFor(original(enemy))?.onSpawn?.(state, enemy, api)
  },
  canPlayCard(_state, inv, card) {
    return !(card.type === 'asset' && card.traits?.includes('Ally') && hasThreatFlag(inv, 'cannotPlayAllies'))
  },
  locationEntered(state, inv, loc, api, companions = []) {
    for (const enemy of state.enemies.filter(item => item.location === loc?.id && !companions.includes(item.id))) {
      for (const code of enemy.attachedTreacheries || []) if (treacheryRuleFor(code)?.attachedHorror) api.horror(inv.seat, 1)
    }
  },
  enemyMoved(state, enemy, _from, api, skipSeat = null) {
    // 第 57 轮：星际旅行者的「进入地点」强制在敌人条目的 enemyScript.onMove。
    enemyScriptFor(original(enemy))?.onMove?.(state, enemy, api)
    for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned && item.seat !== skipSeat && item.location === enemy.location)) {
      for (const code of enemy.attachedTreacheries || []) if (treacheryRuleFor(code)?.attachedHorror) api.horror(inv.seat, 1)
    }
  },
  beforeHarm(state, _inv, harm) {
    return { ...harm, direct: harm.direct || !!state.scenarioFlags.lightOfAforgomon?.length }
  },
  publicAttachments(state) {
    const result = { act: [], agenda: [], locations: {} }
    for (const item of state.scenarioFlags?.lightOfAforgomon || [])
      if (item.index === state[item.type === 'act' ? 'actIndex' : 'agendaIndex']) result[item.type].push('02085')
    return result
  },
  actLeftPlay(state) { discardAforgomon(state, 'act', state.actIndex) },
  agendaLeftPlay(state) { discardAforgomon(state, 'agenda', state.agendaIndex) },
  encounterDrawn(state, inv, code, api) {
    if (api && ALL_CARDS[code]?.traits?.some(trait => ['Hex', 'Pact'].includes(trait)))
      for (const enemy of state.enemies.filter(item => enemyScriptFor(original(item))?.wizard && item.engagedSeat === inv.seat && textActive(state, item))) api.attack(enemy, inv)
    if (code !== '02101') return
    const key = `terrorFromBeyond:${state.round}:${state.phase}`
    state.scenarioFlags[key] = (state.scenarioFlags[key] || 0) + 1
  },
  resolveEncounter(state, inv, card, api) {
    const code = card.originalCode || card.code
    if (!registeredEntry(code)?.implemented) throw new Error(`遭遇效果尚未迁移：${code}`)
    // 第 7 批：每张诡计的显现规则在 src/cards/encounter-abilities.js 自己的条目里，
    // 这里只保留战役入口（同号卡在多个战役出现时用 encounterResolveCampaigns 限定）。
    const entryResolve = encounterResolveFor(code)
    if (entryResolve && encounterResolveCampaignsFor(code).includes('dunwich')) {
      return entryResolve(state, inv, card, api, {
        location: state.locations.find(item => item.id === inv.location),
      })
    }
    return false
  },
  deckEmptied(state, inv, api) {
    if (inv.deck.length || inv.defeated || inv.resigned) return
    const index = inv.threat.findIndex(t => registeredEntry(original(t))?.flags?.deckEmptiedRemove)
    if (index < 0) return
    const threat = inv.threat[index]
    inv.threat.splice(index, 1)
    state.encounterDiscard.push(threat.code)
    api.damage(inv.seat, 10)
  },
  afterTest(state, inv, result) {
    if (!result.success || result.value - result.difficulty < 1) return
    for (const threat of inv.threat.filter(t => registeredEntry(original(t))?.flags?.afterTestDiscard)) {
      inv.threat.splice(inv.threat.indexOf(threat), 1)
      state.encounterDiscard.push(threat.code)
    }
  },
}

function discardAforgomon(state, type, index) {
  const attached = state.scenarioFlags.lightOfAforgomon || []
  const leaving = attached.filter(item => item.type === type && item.index === index)
  state.scenarioFlags.lightOfAforgomon = attached.filter(item => !leaving.includes(item))
  state.encounterDiscard.push(...leaving.map(() => '02085'))
}
