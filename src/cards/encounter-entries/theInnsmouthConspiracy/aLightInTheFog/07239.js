// 07239 猎鹰岬门房（Falcon Point Gatehouse）· 地点 · 雾中之光 第六章
//
// 印刷要点：
//   · 猎鹰岬门房不能被完全淹没（淹没等级上限为「部分淹没」）。
//   · [action]：撤退。你退回树林，把灯塔和它的秘密都抛在身后。如果你控制黑色或红色钥匙，
//     将你控制的这些钥匙都放在当前场景上。
//
// 引擎读点：
//   · locationRule.floodBounds {min:0,max:1}（默认上限 2 → 1）→ src/engine/flood.js activeFloodBounds
//     （canChangeFloodLevel / setFloodLevel 共用，07040/07242/07243 同模式）。
//   · 条目 abilities 的 action 描述子 → parleyMovesFor → doEntityAbility（消耗 1 行动；
//     actionKind:'resign' 使本行动按撤退结算、不引发借机攻击，见 table-decisions.js#actionKind）。
//   · 放钥匙：ctx.api.keys.transfer（描述子 resolve 的 api 是 abilityApi，keys/water/map 挂在顶层；
//     scenarioRuntime 才把同类原语放在 api.mechanics 下）把 investigator:<seat> 上的黑/红钥匙移到
//     act:<当前幕实例 id>（scenario-keys.js 的 holder 校验允许 act 持有；content resolutions.js
//     结算时读「当前幕上的钥匙」决定 TheInvestigatorsPossessAMapOfYhANthlei / KeyToYhaNthlei）。
//   · 撤退：ctx.api.scenario.resign → doResign（消除调查员、检查全员撤退）。
//   顺序说明：印刷顺序是「先撤退、再放钥匙」，但 doResign → eliminateInvestigator 的 keysOnExit
//   会把仍持有的钥匙先掉在该地点；为保证「黑/红钥匙放到当前场景」真实发生，同一 resolve 内先放钥匙
//   再撤退（玩家可见结果与印刷一致，且遗留钥匙随 eliminate 掉回门房也符合规则）。
import { keysAt } from '../../_shared.js'

const RESIGN_KEYS = ['black', 'red']

export default {
  code: '07239', scope: 'location', implemented: true,
  locationRule: { floodBounds: { min: 0, max: 1 } },
  abilities: [{
    kind: 'action', actionKind: 'resign',
    label: '撤退：退回树林（若控制黑色/红色钥匙，将其放到当前场景上）',
    resolve: ({ state, inv, api }) => {
      const act = state.acts?.[state.actIndex]
      const held = keysAt(state, `investigator:${inv.seat}`)
      for (const color of RESIGN_KEYS) {
        if (!act || !held.includes(color)) continue
        api.keys.transfer(color, `investigator:${inv.seat}`, `act:${act.id}`, { reveal: true })
      }
      api.scenario.resign(inv.seat)
    },
  }],
}
