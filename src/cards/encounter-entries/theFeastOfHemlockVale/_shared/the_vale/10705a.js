// 10705a 旅舍 · 地点（The Vale · 白日面 [day]）· 共享遭遇组 the_vale
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_vale（P7 共享组；The Vale 组 17 张里 10704「山谷」
//   是各章提示卡（definition 的 REFERENCE_CODE），故本组单卡条目是 16 个地点面）。
// 卡面（cards-data 10705a）：[[毒堇谷]]。白日面。帷幕 3，线索 0，连接符号 ● → ◆ / ♠。
//   [action]：你在山谷中四处询问（[codex] 9）。
//   [action]：治愈 1 点伤害或 1 点恐惧。（每场游戏仅限一次。）
//
// 读点（数据型条目，规则在章节层）：
//   · 印刷数值/符号/连接：章节 definition 的 location() 从卡表取 shroud/clues，连接图标按
//     `参考资源/.../Location/CardDefs/TheFeastOfHemlockVale/TheVale.hs` 重建（welcomeToHemlockVale /
//     dawnOfTheSecondDay / dawnOfTheFinalDay / preludeTheFinalEvening / fateOfTheVale 各自持有摆法）；
//   · 白日面/黑夜面由章节按日历挑面：scenario.mechanics.calendar = { maximumDay: 3, record: 'hemlockDate' }，
//     引擎 scenario-calendar.js#duringPeriod 读同一份日期；
//   · [codex] 9 由序曲 behavior 的 actions / performAction 结算（本章 codex 表见 definition 的 CODEX_ENTRIES）；
//   · 「治愈 1 伤害或恐惧」是印刷的一次性行动，由同一批序曲 behavior 的地点行动读点承接。
export default {
  code: '10705a',
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Hemlock Vale'],
    side: 'day', period: 'day', oppositeCode: '10705b',
    printedShroud: 3, printedClues: 0, printedVictory: 0, cluesFixed: false,
    symbol: 'circle', connectsTo: ['diamond', 'spade'],
    codexNumber: 9,
    actionCodex: 9,
    healDamageOrHorrorOncePerGame: 1,
  },
  note: '数据型地点条目：印刷数值由章节 definition 的 location() 读取；[codex] 9 与治愈行动在序曲 behavior 的地点行动读点。',
  abilities: [],
}
