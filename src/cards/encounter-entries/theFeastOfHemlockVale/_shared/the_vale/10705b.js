// 10705b 旅舍 · 地点（The Vale · 黑夜面 [night]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale。
// 卡面（cards-data 10705b）：[[毒堇谷]]。黑夜面。帷幕 3，线索 1，连接符号 ● → ◆ / ♠。
//   每轮在本地点抽取的第一张遭遇卡牌获得涌动。
//   [action]：检定[意志](3)，然后[敏捷](2)，然后[战斗](1)。如果这些检定都成功，抽取 3 张卡牌。
//     然后，如果当前幕为「山谷的命运（版本四）」，记住「调查员找到了汽油」。
//
// 读点（数据型条目，规则在章节层）：摆面/连接同 10705a；「获得涌动」走引擎 encounter.js#drawEncounter 的
//   scenarioBehavior.encounterGainsSurge（章节 behavior 写点，Fate of the Vale 的 v.IV 记号在 fateOfTheVale）；
//   三项检定行动由当前章节 behavior 的地点行动读点承接（同一句模板多章复用，条目只声明数值）。
export default {
  code: '10705b',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'night', period: 'night', oppositeCode: '10705a',
    printedShroud: 3, printedClues: 1, printedVictory: 0, cluesFixed: false,
    symbol: 'circle', connectsTo: ['diamond', 'spade'],
    firstEncounterEachRoundGainsSurge: true,
    actionTests: { sequence: [['willpower', 3], ['agility', 2], ['combat', 1]] },
    onAllTestsSucceed: { drawCards: 3 },
    rememberIfActFateOfTheValeIV: ['investigatorsFoundGas'],
  },
  note: '数据型地点条目：涌动读点 scenarioBehavior.encounterGainsSurge；三项检定行动的数值由章节 behavior 的地点行动承接。',
  abilities: [],
}
