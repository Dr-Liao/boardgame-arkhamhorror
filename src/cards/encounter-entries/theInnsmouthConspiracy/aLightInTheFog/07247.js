// 07247 海德拉祭坛（Shrine to Hydra）· 地点 · 雾中之光 第六章
//
// 印刷要点：
//   · 除调查外，不能从海德拉祭坛发现线索（引擎读点：locationRule.cluesOnlyByInvestigation，
//     只拦非调查来源的发现，如 02224 式的远程发现；调查行动照常）。
//   · 海德拉祭坛的调查员控制绿色钥匙时，海德拉祭坛 -3 帷幕。
//   · 强制 - 海德拉祭坛揭示后：将放在一边的红色钥匙放在其上。
//
// 引擎读点：
//   · locationRule.cluesOnlyByInvestigation → src/engine/locations.js
//     canDiscoverClueAt / discoverClueAt（opts.investigation !== true 时拒绝）。
//   · modifiers: [{ target:'locationShroud', amount }] → modifiers.js entityModifierTotal（来源=本卡号条目），
//     调查难度读点 actions.js:506、令牌费用帷幕读点 engine.js:1036；条件用 scenario-keys.js 的
//     keysHeldAtLocation（「此地点上的调查员所持钥匙」，07048 同模式）。
//   · locationRule.onReveal → locations.js#revealLocation（进入未揭示地点/被效果揭示时触发）。
//   · 放钥匙：api.mechanics.keys.transfer('red','setAside',`location:<id>`,{reveal:true})
//     （07241/07243/07248 同模式；红钥匙开局放在一边且正面朝上）。
import { keysHeldAtLocation } from '../../_shared.js'

export default {
  code: '07247', scope: 'location', implemented: true,
  modifiers: [{
    target: 'locationShroud',
    amount: ({ state, entity }) => (keysHeldAtLocation(state, entity.id).includes('green') ? -3 : 0),
  }],
  locationRule: {
    cluesOnlyByInvestigation: true,
    onReveal(state, location, api) {
      api.mechanics.keys.transfer('red', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
}
