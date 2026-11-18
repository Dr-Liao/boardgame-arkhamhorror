// 10654 往升 The Spiral · 议程（3a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：强制 - 当将从遭遇牌库抽牌时：改为从深渊底部揭示并抽取遭遇卡。凝视密使超过 15 秒 → 疯狂。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.abyssMythosReplacement → behavior.abyssMythosActive
//   · flags.cosmicEmissaryGaze → behavior.gazeRule
//   · flags.backEffect = 'devoured' → behavior.agendaReveal（议程 3 背面：全员被吞噬 → noResolution）
export default {
  code: '10654',
  scope: 'agenda',
  implemented: true,
  flags: {
    abyssMythosReplacement: true,
    cosmicEmissaryGaze: true,
    backEffect: 'devoured',
  },
  note: 'approximation: 同 10652（凝视计时只保留标记）。',
  abilities: [],
}
