// 10660 山谷的命运（版本四） Fate of the Vale (v.IV) · 幕（3a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：[action] 若下列至少 5 项为真（调查员找到了汽油／希奥的卡车／前路已通／勘察笔记已找回／伯蒂逃走／已找到样本）：撤退。目标 - 逃命！若所有未被击败的调查员都已撤退，推进。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.resignRememberedKeys / resignRequired → behavior.resignSpec（fateResign 行动）
//   · flags.back = 'resolution5' → behavior.actReveal / resolutionOf
// 背面「Just the Beginning...」→ 结局 5。
export default {
  code: '10660',
  scope: 'act',
  implemented: true,
  flags: {
    resignRememberedKeys: ['theInvestigatorsFoundGas', 'theInvestigatorsFoundTheosTruck', 'theRoadIsClear', 'theSurveyNotesWereRecovered', 'bertieIsFleeing', 'theSamplesWereFound'],
    resignRequired: 5,
    back: 'resolution5',
  },
  note: 'approximation: 六个「记得」条件直接读战役记录的布尔键；撤退用 api.resign（缺省置 inv.resigned）。',
  abilities: [],
}
