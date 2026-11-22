// 重返往事回声 · 章节行为。
//
// 基础章节的楼层随机、探求者生成、幕/议程与结局记录直接复用基础 behavior；这里只覆盖：
//   1. 布置：基础每层「留 2 移 1」的同一规则也作用于新增的地下室（52030–52032），
//      同时放下第三张宁静的走廊（52029）与两张誓约看守人（52033）；
//   2. 52028 背面追加规则：调查员推进到场景 2 或场景 3 后，在无人历史协会地点
//      生成一张放在一边的誓约看守人。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/echoesOfThePast/behavior.js'
import { HISTORICAL_ROOMS, KEEPER_CODE, QUIET_HALLS_BASEMENT } from './definition.js'
import { returnToIntroduction } from '../../story.js'

const original = card => card?.originalCode || card?.code
const HISTORICAL_CODES = new Set(HISTORICAL_ROOMS)
const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)

export const behavior = {
  ...baseBehavior,
  id: 'returnToEchoesOfThePast',
  introduction: returnToIntroduction('echoesOfThePast'),

  setupPlan(state) {
    const kept = state.scenarioFlags?.echoesFloors || state.scenario.floorPools
    const floors = Object.values(kept).flat()
    return {
      // quietHallsBasement（52029）是第三张宁静的走廊，开局必定入场。
      locations: ['entryHall', 'quietHallsSecond', 'quietHallsThird', QUIET_HALLS_BASEMENT, ...floors],
      setAside: [
        '03139', '03140', '03141', '03142', '03143', '03144', '03144', '03144',
        KEEPER_CODE, KEEPER_CODE,
      ],
      removed: state.scenarioZones?.removed || [],
    }
  },

  setupLocations(state, _events, api) {
    state.scenarioFlags = { firstRoundBonus: !!state.campaign.records.youFledTheDinnerParty }
    state.scenarioZones.removed = []
    state.scenarioZones.setAside = [...this.setupPlan(state).setAside]
    state.scenarioFlags.echoesFloors = {}
    for (const [floor, ids] of Object.entries(state.scenario.floorPools)) {
      const shuffled = api.shuffle([...ids], () => api.randomValue(state))
      state.scenarioFlags.echoesFloors[floor] = shuffled.slice(0, 2)
      state.scenarioZones.removed.push(state.scenario.locations[shuffled[2]].originalCode)
    }
    // 52028 背面：两张誓约看守人放在一边，等待幕推进时生成。
    state.scenarioFlags.keepersSetAside = 2
    const third = state.scenarioFlags.echoesFloors.third
    const candidates = state.numInvestigators < 4
      ? third : [...state.scenarioFlags.echoesFloors.second, ...third]
    state.scenarioFlags.seekerLocations = api.shuffle([...candidates], () => api.randomValue(state))
    if ((state.campaign.records.vipsInterviewed || []).includes('03079')) {
      state.scenario.locations.entryHall.cluesFixed = state.numInvestigators
    }
    if (state.scenarioFlags.firstRoundBonus) {
      for (const inv of active(state)) inv.actionsLeft++
    }
    return this.setupPlan(state).locations
  },

  // 52028 背面追加规则：推进到场景 2 或 3 后，在无人历史协会地点生成一张誓约看守人。
  actLeftPlay(state, act, api) {
    const nextIndex = state.actIndex + 1
    if (nextIndex !== 1 && nextIndex !== 2) return
    if (!(state.scenarioFlags.keepersSetAside > 0)) return
    const occupied = new Set(active(state).map(inv => inv.location))
    const empty = state.locations
      .filter(location => HISTORICAL_CODES.has(original(location)) && !occupied.has(location.id))
      .map(location => location.id)
    if (!empty.length) {
      api.info?.('没有空的历史协会地点，誓约看守人留在一边。')
      return
    }
    state.scenarioFlags.keepersSetAside -= 1
    api.spawn?.(KEEPER_CODE, empty[0])
    api.info?.('誓约看守人在一处无人的历史协会地点现身。')
  },

  // 52033：当前场景编号大于当前密谋编号时获得猎手（入场与每轮敌人阶段结束时同步）。
  enemySpawned(state, enemy, api) {
    baseBehavior.enemySpawned?.(state, enemy, api)
    syncKeeperHunter(state, enemy)
  },

  // 52033：敌军阶段结束时，把同[[特性]]地点上每位调查员的各 1 个线索移到誓约看守人上。
  enemyPhaseEnd(state, api) {
    for (const enemy of state.enemies.filter(item => original(item) === KEEPER_CODE)) {
      syncKeeperHunter(state, enemy)
      const keeperLocation = state.locations.find(location => location.id === enemy.location)
      const keeperTraits = new Set((keeperLocation?.traits || []).map(trait => String(trait).toLowerCase()))
      if (!keeperTraits.size) continue
      for (const inv of active(state)) {
        const location = state.locations.find(item => item.id === inv.location)
        const shared = (location?.traits || []).some(trait => keeperTraits.has(String(trait).toLowerCase()))
        if (!shared || (inv.clues || 0) < 1) continue
        api.moveClueToEnemy?.(enemy, { from: 'investigator', seat: inv.seat })
      }
    }
  },
}

// 场景编号 > 密谋编号 → 猎手；否则不获得。
function syncKeeperHunter(state, enemy) {
  if (original(enemy) !== KEEPER_CODE) return
  const actNumber = (state.actIndex ?? 0) + 1
  const agendaNumber = (state.agendaIndex ?? 0) + 1
  enemy.hunter = actNumber > agendaNumber
}
