// 06152 夜骑（theSearchForKadath）· 敌人（生物 / 怪物，蜂拥1，印刷 2 张）
// 卡面：蜂拥1。
// 卡面：当头领「夜骑」上没有附属蜂拥卡牌时，它得到躲避值-3。
// 卡面：强制 - 在你躲避夜骑后：将其弃掉。
//
// 一卡一文件：规则数据在这里声明；章节 behavior 的 enemyStatModifier（躲避）与 afterEvade（弃掉）读取并接线。
export default {
  code: '06152', scope: 'enemy', implemented: true,
  enemyRule: { evadePenaltyWithoutSwarm: -3, discardAfterEvade: true },
}
