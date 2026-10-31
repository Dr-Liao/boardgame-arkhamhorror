// 06133 伊莱克-瓦达（theSearchForKadath）· 地点（禁闭 / 城市 / 港口，掩藏，线索1，帷幕2，胜利1）
// 卡面：掩藏。
// 卡面：你位于伊莱克-瓦达时，你每轮打出的第一张[[法术]]、[[仪式]]或[[遗物]]卡牌的费用减少1点。
//
// 一卡一文件：掩藏[fast]翻面由共享层提供；背面故事卡规则在 06133b。
// 简化：费用减免没有内容层读点（playCost 只读玩家卡能力层 playCostDelta），见报告 simplified[]。
export default {
  code: '06133', scope: 'location', implemented: true,
}
