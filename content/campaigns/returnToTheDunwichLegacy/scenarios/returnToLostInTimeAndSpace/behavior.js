// 重返迷失时空 · 章节行为：彼端领域+Yog 入场、按仪式记录替换幕 2a、密谋 3a 用版本二。
import { BASE_BEHAVIORS } from '../../shared.js'
import { REALMS_BEYOND, ACT_V2_CODE, AGENDA_V2_CODE } from './definition.js'

const base = BASE_BEHAVIORS.lostInTimeAndSpace
const original = card => card?.originalCode || card?.code

export const behavior = {
  ...base,
  id: 'returnToLostInTimeAndSpace',
  setupLocations(state, events, ctx = {}) {
    const placed = base.setupLocations(state, events, ctx)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = ['02321', '02322', '51056']
    state.scenarioZones.removed ||= []
    state.scenarioZones.underLocations ||= {}
    state.scenarioZones.sacrificed ||= []
    // 仪式已完成 → 幕 2a 用超越领域(版本二)；否则保留基础 02317。
    if (state.campaign.records.theRitualWasCompleted === true) {
      const v2 = state.scenario.stageCards?.[ACT_V2_CODE]
      if (v2) state.acts[1] = structuredClone(v2)
    }
    // 51054 突破(版本二) 一律替换基础 02314。
    const agendaV2 = state.scenario.stageCards?.[AGENDA_V2_CODE]
    if (agendaV2) state.agendas[2] = structuredClone(agendaV2)
    return [...placed, REALMS_BEYOND]
  },
  setupEnemies(state, events, api) {
    api.spawnEnemy(state, '02323', REALMS_BEYOND, null)
  },
  actTwoIsVersionTwo(state) {
    return original(state.acts?.[1]) === ACT_V2_CODE
  },
  retRealmsBeyond(state) { return state.locations.some(loc => loc.id === REALMS_BEYOND) },
}

export { original }
