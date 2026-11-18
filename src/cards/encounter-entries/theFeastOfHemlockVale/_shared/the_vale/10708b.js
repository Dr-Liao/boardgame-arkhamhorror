// 10708b 老磨坊 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10708b）：[[毒堇谷]]。黑夜面。帷幕 4，线索 1，连接符号 ♥ → ◆ / ☾。
//   [action]：检定[敏捷](8)。如果你检定成功，治愈 2 点伤害（如果你检定失败，你可以花费
//     2[per_investigator] 个线索以改为自动成功）。然后，如果当前幕为「山谷的命运（版本四）」，
//     记住「已找到样本」。
//
// 读点（数据型条目，规则在章节层）：检定难度/治愈量/替代支付都在 flags 里；结算由当前章节 behavior 的
//   地点行动读点（引擎没有「难度 8 自动成功可花线索替代」的声明式字段）。
export default {
  code: '10708b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10708a',
    printedShroud: 4, printedClues: 1, printedVictory: 0, cluesFixed: false,
    symbol: 'heart', connectsTo: ['diamond', 'moon'],
    actionTest: { skill: 'agility', difficulty: 8 },
    onSuccessHealDamage: 2,
    alternateAutoSuccessCost: { cluesPerInvestigator: 2 },
    rememberIfActFateOfTheValeIV: ['theSamplesWereFound'],
  },
  note: '数据型地点条目：检定/治愈/替代支付数值由章节 behavior 的地点行动读点结算（无声明式字段）。',
  abilities: [],
}
