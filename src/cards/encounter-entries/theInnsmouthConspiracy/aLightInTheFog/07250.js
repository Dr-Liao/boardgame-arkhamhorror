// 07250 沉没档案库（Sunken Archives）· 地点 · 雾中之光 第六章
//
// 印刷要点：
//   · 沉没档案库淹没时，不能发现其上的线索（引擎读点：locationRule.cannotDiscoverWhileFlooded；
//     本卡揭示后即完全淹没，故等价于「淹没期间不能发现」，调查行动也无法发现线索）。
//   · 强制 - 沉没档案库揭示后：其完全淹没。将放在一边的黑色钥匙放在其上。
//
// 引擎读点：
//   · locationRule.cannotDiscoverWhileFlooded → src/engine/locations.js
//     locationClueDiscoveryBlocked（floodLevel >= 1 时 canDiscoverClueAt / discoverClueAt 皆返回 false；
//     「淹没」含部分与完全淹没，本卡揭示后即完全淹没）。
//   · locationRule.onReveal → api.mechanics.water.set(location.id, 2)（FLOOD_LEVELS.full = 2）
//     以及 api.mechanics.keys.transfer('black','setAside',`location:<id>`,{reveal:true})。
//     顺序按印刷：先完全淹没，再放黑钥匙（黑钥匙开局正面朝上放在一边）。
export default {
  code: '07250', scope: 'location', implemented: true,
  locationRule: {
    cannotDiscoverWhileFlooded: true,
    onReveal(state, location, api) {
      api.mechanics.water.set(location.id, 2)
      api.mechanics.keys.transfer('black', 'setAside', `location:${location.id}`, { reveal: true })
    },
  },
}
