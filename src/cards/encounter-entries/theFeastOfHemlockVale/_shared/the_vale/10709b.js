// 10709b 阿特伍德宅 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10709b）：[[毒堇谷]]。黑夜面。帷幕 3，线索 1，连接符号 ☾ → ◆ / ▲ / ♥ / ◈（水滴）。
//   强制 - 在你调查阿特伍德宅时技能检定失败后：受到 1 点恐惧。
//   [action]：检定[意志](8)。如果你检定成功，治愈 2 点恐惧（如果你检定失败，你可以花费
//     2[per_investigator] 个线索以改为自动成功）。然后，如果当前幕为「山谷的命运（版本四）」，
//     记住「勘察笔记已找回」。
//
// 读点（数据型条目，规则在章节层）：调查失败的恐惧由章节 behavior 的 afterTest / investigate 读点结算；
//   检定/治愈/替代支付数值在 flags。水滴（droplet）是 Haskell 背面的第 4 个连接图标，本章没有对应地点。
export default {
  code: '10709b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10709a',
    printedShroud: 3, printedClues: 1, printedVictory: 0, cluesFixed: false,
    symbol: 'moon', connectsTo: ['diamond', 'triangle', 'heart', 'droplet'],
    forcedFailedInvestigateTest: { horror: 1 },
    actionTest: { skill: 'willpower', difficulty: 8 },
    onSuccessHealHorror: 2,
    alternateAutoSuccessCost: { cluesPerInvestigator: 2 },
    rememberIfActFateOfTheValeIV: ['theSurveyNotesWereRecovered'],
  },
  note: '数据型地点条目：调查失败的 1 点恐惧由章节 behavior 的 afterTest 读点；其余数值在 flags。',
  abilities: [],
}
