// 重返疯狂列车 · 章节行为：车厢池/车头池扩大、议程牌库替换、车头揭示放机修工。
import { BASE_BEHAVIORS, shuffleWith } from '../../shared.js'
import { CAR_POOL, ENGINE_POOL, AGENDA_ORDER } from './definition.js'

const base = BASE_BEHAVIORS.theEssexCountyExpress
const original = card => card?.originalCode || card?.code

export const behavior = {
  ...base,
  id: 'returnToTheEssexCountyExpress',
  setupLocations(state, events, ctx = {}) {
    const placed = base.setupLocations(state, events, ctx)
    const rng = () => (ctx.randomValue ? ctx.randomValue(state) : 0.5)
    const zones = state.scenarioZones
    const slots = zones.train
    const cars = shuffleWith(CAR_POOL, rng).slice(0, 6)
    const engine = ENGINE_POOL[Math.floor(rng() * ENGINE_POOL.length)]
    const used = [...cars, engine]
    ;used.forEach((code, index) => {
      const def = state.scenario.locations[`location${code}`]
      state.locationVariants[slots[index]] = {
        ...structuredClone(def), id: slots[index],
        connections: slots.filter((_, other) => Math.abs(index - other) === 1),
        blankDuringSetup: index === 0,
      }
    })
    zones.removed = [...CAR_POOL, ...ENGINE_POOL].filter(code => !used.includes(code))
    zones.setAside = [...(zones.setAside || []).filter(code => code !== '02178'), ...Array(4).fill('02178'), '51031']
    // 议程顺序按重返牌库覆盖：51026 → 51027 → 02161–02164。
    const byCode = Object.fromEntries((state.agendas || []).map(agenda => [original(agenda), agenda]))
    const ordered = AGENDA_ORDER.map(code => byCode[code]).filter(Boolean)
    if (ordered.length === AGENDA_ORDER.length) state.agendas = ordered
    return placed
  },
  locationRevealed(state, location, api) {
    base.locationRevealed?.(state, location, api)
    // 51028 车头：揭示后把放在一边的火车机修工放置入场。
    if ((location.originalCode || location.code) === '51028') api.storyAsset?.('51031', location.id)
  },
  // 51026 烟雾缭绕推进时生成背面敌人列车主宰（卡背 51026b）。
  agendaAdvancing(state, agenda, api) {
    base.agendaAdvancing?.(state, agenda, api)
    if (original(agenda) !== '51026') return
    const leftmost = (state.scenarioZones?.train || []).find(id => state.locations.some(location => location.id === id))
    if (!leftmost) return
    api.spawnEnemy(state, '51026b', leftmost, null)
  },
  retTrainSlots(state) { return [...(state.scenarioZones?.train || [])] },
}

export const retHelpers = { shuffleWith }
