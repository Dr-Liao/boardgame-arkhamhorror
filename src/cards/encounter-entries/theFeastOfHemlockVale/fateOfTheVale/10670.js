// 10670 深渊 The Abyss（地点面） · 地点（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：强制 - 当你进入深渊时，若深渊中有牌：你阵亡。敌军阶段期间，每个在深渊的[[破碎]]敌人失去冷漠。深渊必须一直盖在深渊牌库顶。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.entryKillsIfCards → behavior.locationEntered
//   · 深渊地点本身的「故事卡盖顶」由 definition 的 storyCode 与 behavior 的深渊牌库承接
export default {
  code: '10670',
  scope: 'location',
  implemented: true,
  flags: {
    entryKillsIfCards: true,
  },
  note: 'approximation: 「[[破碎]]敌人失去冷漠」依赖引擎敌军阶段的 aloof 关键词读点，当前只保留卡面文本（未接线）；深渊在布置时与故事卡同面，由 behavior.flipAbyssToLocation 翻到地点面。',
  abilities: [],
}
