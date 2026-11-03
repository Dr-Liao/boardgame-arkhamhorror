// 07249 月之室（The Moon Room）· 地点 · 雾中之光 第六章
//
// 印刷要点：
//   · [action] 如果月之室未淹没：撤退。你穿上一件闲置的潜水服，一头扎进了反射月光的池中。
//     如果你控制黑色或红色钥匙，将你控制的这些钥匙都放在当前场景上。
//   · 强制 - 月之室揭示后：提升其淹没等级。
//
// 引擎读点：
//   · locationRule.onReveal → api.mechanics.water.change(location.id, 1)（flood.js，封顶 2）。
//   · abilities action 描述子 → parleyMovesFor → doEntityAbility（1 行动；actionKind:'resign'）。
//     criteria 用 _shared.js 的 floodLevel（flood.js 的同源读点）：仅当未淹没（0）时可用。
//   · 钥匙 transfer 到 `act:<当前幕 id>`（content resolutions.js 结算时读当前幕钥匙）。
//     描述子 resolve 的 api 是 abilityApi（keys/water 在顶层）；onReveal 的 api 是 scenarioRuntime。
//   · scenarioFlags.resignedInMoonRoom：content resolutions.js 的 R1 分支按它记录
//     PossessesADivingSuit；07238b 按它决定 R1/R2。该字段已存在于内容层读点、非新造状态，
//     这里经 ctx.api.setScenarioFlag 追加座位（同一 resolve 内在 resign 前写入，避免剧本提前结束）。
import { floodLevel, keysAt } from '../../_shared.js'

const RESIGN_KEYS = ['black', 'red']

function recordMoonRoomResign(state, api, seat) {
  const seats = [...(state.scenarioFlags?.resignedInMoonRoom || [])]
  if (!seats.includes(seat)) seats.push(seat)
  api.setScenarioFlag('resignedInMoonRoom', seats)
}

export default {
  code: '07249', scope: 'location', implemented: true,
  locationRule: {
    onReveal(state, location, api) {
      api.mechanics.water.change(location.id, 1)
    },
  },
  abilities: [{
    kind: 'action', actionKind: 'resign',
    label: '撤退：穿上潜水服跳进映月池（仅月之室未淹没时）',
    criteria: ({ state, source }) => floodLevel(state, source.id) === 0,
    resolve: ({ state, inv, api }) => {
      const act = state.acts?.[state.actIndex]
      const held = keysAt(state, `investigator:${inv.seat}`)
      for (const color of RESIGN_KEYS) {
        if (!act || !held.includes(color)) continue
        api.keys.transfer(color, `investigator:${inv.seat}`, `act:${act.id}`, { reveal: true })
      }
      recordMoonRoomResign(state, api, inv.seat)
      api.scenario.resign(inv.seat)
    },
  }],
}
