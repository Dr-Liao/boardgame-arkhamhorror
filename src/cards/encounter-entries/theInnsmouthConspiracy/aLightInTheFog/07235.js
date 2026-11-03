// 07235 猎鹰岬的恐怖（Terror at Falcon Point）· 密谋 4 · 雾中之光 第六章
//
// 印刷要点：
//   · 正面：奥赛罗思·马什得到 +2[每调查员] 生命值；同一行的地点互相连接
//     （章节 late-setup 已 map.configure({adjacency:'row'})，对整章持续生效）。
//   · 背面（推进时）：在可以提升淹没等级的地点中，找到最底下 4 张。提升这些地点的淹没等级。
//     如果你不能这么做，进入（→结局3）。否则，将本密谋翻面，继续游戏。
//
// 引擎读点：
//   · 正面生命值修正：条目 modifiers target:'enemyHealth'（modifiers.js 的场景行读点，
//     当前议程的 modifiers 参与敌人数值结算），条件限定奥赛罗思·马什（07253）。
//   · 背面 floodBottommost：与 07234b 共用 _shared.js#floodBottommostLocations
//     （参考实现 Helpers.hs#floodBottommost：可提升地点不足 4 张即失败）。
//   · 失败 → api.finish('resolution3')（resolutions.js#aLightInTheFog 的结局3）；
//     成功 → api.revertAgenda()（agenda-advance-frame 的 RevertAgenda：翻回正面并中止本次推进）。

import { floodBottommostLocations, originalOf } from '../../_shared.js'

const MARSH = '07253'

export default {
  code: '07235', scope: 'agenda', implemented: true,
  modifiers: [{
    target: 'enemyHealth',
    amount: ({ state }) => 2 * (state.numInvestigators || 1),
    condition: { when: ({ entity }) => String(originalOf(entity)) === MARSH },
  }],
  agendaRule: {
    onReveal(state, agenda, api) {
      const flooded = floodBottommostLocations(state, api, 4, '07235')
      if (flooded < 4) {
        api.info?.('「猎鹰岬的恐怖」背面：可提升淹没等级的地点不足 4 张，进入结局 3。')
        api.finish('resolution3')
        return
      }
      api.info?.('「猎鹰岬的恐怖」背面：最底下 4 处地点涨水，本密谋翻回正面继续游戏。')
      api.revertAgenda()
    },
  },
}
