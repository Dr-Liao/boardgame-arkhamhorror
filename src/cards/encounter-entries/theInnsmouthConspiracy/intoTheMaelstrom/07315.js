// 07315 回到深渊（Back into the Depths）· 幕 1 · 暗潮之下 第八章
//
// 印刷（中文）：
//   目标 - 如果每位未击败的调查员都在伊哈·恩斯雷门扉，且调查员们持有下列每把钥匙
//          （蓝色、红色、黄色、绿色），你可以选择推进。
//   背面（推进时）：
//     将伊哈·恩斯雷门扉以外的每个地点移出游戏（如果其有胜利 X 且没有线索，改为加入胜利区）。
//     弃掉这些地点上的所有其他卡牌。
//     按战役指南的「幕 2 布置」将放在一边的地点放入场（人数不同，[[伊哈·恩斯雷]]地点的数量与
//     排布不同）。
//     将放在一边的海德拉敌人放入海德拉巢穴，（深入沉睡）面朝上。
//     将放在一边的达贡敌人放入达贡巢穴。查看战役记录：如果达贡已苏醒，以（苏醒狂怒）面入场；
//     否则以（深入沉睡）面入场。
//
// 引擎读点：
//   · actRule.objective(state) ← act-agenda.js#checkAct（每次行动后读条目函数分支并推进）。
//     钥匙用 _shared 的 keysHeldByGroup（全队持有的已揭示钥匙；setAside/removed 的不算）。
//   · actRule.chapterSetup: 'act1Back' ← content entry-rules.actReveal 的数据驱动分派；
//     content/late-setup.js#chapterActBackSetup 读取 chapter-data.setup.act1Back：
//     移除旧地点（Victory X 且无线索 → api.awardLocationVictory，其余 removeLocationFromGame）、
//     按人数图示放置圣堂/普通地点与两座巢穴（入场水位由 locationRule.entersPlayFlooded 负责）、
//     按记录选择达贡面并把两古神从 setAside 生成到各自巢穴。
//   · 条目用 `setupSpawns` 给出结构化生成声明：数据文件里的 spawnDagon.face 是人工描述串，
//     卡面印刷规则是「按记录二选一」，因此在条目里声明 record/then/else，内容层只按数据执行。

import { keysHeldByGroup, originalOf } from '../../_shared.js'

const GATEWAY = '07320'
const REQUIRED_KEYS = ['blue', 'red', 'yellow', 'green']

export default {
  code: '07315', scope: 'act', implemented: true,
  actRule: {
    objective(state) {
      const gateway = state.locations.find(location => String(originalOf(location)) === GATEWAY)
      if (!gateway) return false
      const alive = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
      if (!alive.length || !alive.every(inv => inv.location === gateway.id)) return false
      const held = keysHeldByGroup(state)
      return REQUIRED_KEYS.every(color => held.includes(color))
    },
    chapterSetup: 'act1Back',
    setupSpawns: [
      { face: '07331a', location: '07329' },
      { record: 'DagonHasAwakened', then: '07330b', else: '07330a', location: '07328' },
    ],
  },
}
