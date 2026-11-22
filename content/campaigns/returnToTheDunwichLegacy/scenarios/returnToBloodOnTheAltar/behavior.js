// 重返血色祭坛 · 章节行为：村庄三选一、卡牌压在村庄下、受雇枪手。
// 其余钩子（隐藏密室推进、献祭、结局记录）沿用基础章。
import { BASE_BEHAVIORS, shuffleWith } from '../../shared.js'
import { VILLAGE_SLOTS, UNDER_LOCATION_CODES, HIRED_GUN_CODE } from './definition.js'

const base = BASE_BEHAVIORS.bloodOnTheAltar
const original = card => card?.originalCode || card?.code
const scholars = [['02040', 'drHenryArmitage'], ['02061', 'professorWarrenRice'], ['02080', 'drFrancisMorgan']]

function pick(rng, list) { return list[Math.floor(rng() * list.length)] }

export const behavior = {
  ...base,
  id: 'returnToBloodOnTheAltar',
  setupLocations(state, events, ctx = {}) {
    const rng = () => (ctx.randomValue ? ctx.randomValue(state) : 0.5)
    const records = state.campaign.records
    state.scenarioZones = { setAside: [...(state.scenario.setAsideEncounterCards || []), '02215', '02216', '02217', '02218', '02219',
      HIRED_GUN_CODE, HIRED_GUN_CODE], removed: [], underLocations: {}, sacrificed: [] }
    state.scenarioFlags = {}
    const zones = state.scenarioZones
    const chosen = VILLAGE_SLOTS.map(slot => {
      const code = pick(rng, slot.codes)
      state.locationVariants[slot.id] = { ...structuredClone(state.scenario.locations[`location${code}`]), id: slot.id }
      zones.removed.push(...slot.codes.filter(other => other !== code))
      return slot.id
    })
    const shuffled = shuffleWith(chosen, rng)
    const dropped = shuffled.shift()
    const droppedCode = original(state.locationVariants[dropped])
    if (droppedCode) zones.removed.push(droppedCode)
    zones.sacrifices = shuffleWith(['02217', '02218',
      ...scholars.filter(([, key]) => records[`${key}WasKidnapped`]).map(([code]) => code)], rng)
    if (records.theInvestigatorsWereDelayedOnTheirWayToDunwich) state.doom = (state.doom || 0) + 1
    zones.villageSlots = [...shuffled]
    return ['location51033', ...shuffled]
  },
  setupEnemies(state, events, api) {
    // 若欧巴尼恩帮怀恨在心：由领队选择 1 个「未连接公共空地」的地点生成 1 名受雇枪手，
    // 另一名受雇枪手洗入遭遇牌库（卡背 51032 说明）。
    if (!state.campaign.records.oBannionGangHasABoneToPickWithTheInvestigators) return
    const candidates = (state.scenarioZones?.villageSlots || []).filter(id => {
      const location = state.locations.find(item => item.id === id)
      return location && !location.connections.includes('location51033')
    })
    if (!candidates.length || !api?.choose) return
    const chosen = api.choose({ kind: 'location', source: '51032', seat: state.campaign.leadSeat,
      prompt: '选择生成受雇枪手的地点（未连接公共空地）。',
      options: candidates.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })) })
    const locationId = candidates.includes(chosen) ? chosen : candidates[0]
    api.spawnEnemy(state, HIRED_GUN_CODE, locationId, null)
    state.scenarioZones.setAside = (state.scenarioZones.setAside || []).filter(code => code !== HIRED_GUN_CODE)
  },
  modifyDeck(state, deck) {
    const next = base.modifyDeck(state, deck)
    if (state.campaign.records.oBannionGangHasABoneToPickWithTheInvestigators) next.push(HIRED_GUN_CODE)
    return next
  },
  afterDeckSetup(state, events, api) {
    const zones = state.scenarioZones
    const naomisCrew = new Set(['02097', '02098', '02099'])
    const cards = []
    let guard = 0
    while (cards.length < 3 && state.encounterDeck.length && guard++ < 60) {
      const code = state.encounterDeck.pop()
      if (naomisCrew.has(code)) { state.encounterDeck.unshift(code); continue }
      cards.push(code)
    }
    cards.push(UNDER_LOCATION_CODES[0], UNDER_LOCATION_CODES[1])
    const mixed = shuffleWith(cards, () => api.randomValue(state))
    const slots = zones.villageSlots || []
    slots.forEach((id, index) => { if (mixed[index]) zones.underLocations[id] = mixed[index] })
  },
  retVillageSlots(state) { return [...(state.scenarioZones?.villageSlots || [])] },
}

export { shuffleWith }
