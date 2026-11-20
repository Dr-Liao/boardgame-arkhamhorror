// 11733 伏特鳗（Voltaic Eel）· 敌人 · 共享遭遇组 undersea_creatures（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/undersea_creatures。
// 卡面（cards-data 11733）：
//   猎手。猎物 - 线索最多者。
//   伏特鳗在敌军阶段移动时，每处完全淹没地点视为互相连接。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧/胜利 = cards-data；
//   · 「移动时完全淹没地点互相连接」= 条目 enemyRule.hunterTreatsFloodedConnected
//     （读点 turn.js#hunterStep / resolveHunterMove：敌人位于完全淹没地点时把其它完全淹没地点
//     加入相邻候选；不写实例字段，移出淹没地点立即失效）；
//   · 猎手/猎物来自章节 encounterDefinitions 解析印刷正文。
const CODE = '11733'

export default {
  code: CODE,
  name: '伏特鳗',
  scope: 'enemy',
  implemented: true,
  enemyRule: { hunterTreatsFloodedConnected: true },
  flags: {
    traits: ['Monster'],
    quantity: 1,
    fight: 4,
    evade: 2,
    health: 5,
    damage: 1,
    horror: 1,
    victory: 1,
    hunter: true,
    prey: 'mostClues',
    hunterTreatsFloodedConnected: true,
  },
  note: '「完全淹没地点互相连接」直接复用既有原语 enemyRule.hunterTreatsFloodedConnected'
    + '（turn.js#hunterStep / resolveHunterMove 的同一读点，与 07332 同口径）；数值与猎手/猎物来自'
    + 'cards-data 与章节 encounterDefinitions 解析。',
}
