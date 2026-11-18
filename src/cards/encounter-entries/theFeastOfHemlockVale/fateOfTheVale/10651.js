// 10651 山谷的命运 Fate of the Vale · 章节提示卡（scenario）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：两套混乱符号文本（简单/普通与困难/专家）：[skull]/[cultist]/[tablet]/[elder_thing]，见 chaos.js 的权威表。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.referenceCard / chapterId → 章节身份（审计与指南读取）
//   · chaos.js#fateChaosToken 提供数值；behavior.resolveChaosToken 回派到引擎
export default {
  code: '10651',
  scope: 'scenario',
  implemented: true,
  flags: {
    referenceCard: true,
    chapterId: 'fateOfTheVale',
  },
  note: 'approximation: 「玩家卡效果不能查看/搜索/加入/弃掉遭遇牌库」在引擎侧没有统一拦截点，当前只在深渊牌库的读点上不暴露（behavior 的深渊函数只由章节自己调用）。',
  abilities: [],
}
