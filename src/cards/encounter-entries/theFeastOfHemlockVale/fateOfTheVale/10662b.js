// 10662b 宇宙密使 Cosmic Emissary（深渊 · 破碎面） · 敌人（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：巨大。宇宙密使得到 +2/人 生命。强制 - 当本敌人被击败时：每位调查员检定[意志](100)，失败者被吞噬（阵亡）。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.defeatTest → behavior.enemyDefeated（检定技能/难度/失败后果）
//   · flags.frontFaceCode → 翻面读点（展示用，behavior.flipEmissariesToShattered）
export default {
  code: '10662b',
  scope: 'enemy',
  implemented: true,
  flags: {
    cosmicEmissary: true,
    formation: 'shattered',
    frontFaceCode: '10662a',
    defeatTest: {
      skill: 'willpower',
      difficulty: 100,
      fail: 'killed',
    },
  },
  note: 'approximation: +2/人 生命由卡表基础值与 definition 承接；「被击败 → 全体检定」由 behavior.enemyDefeated 读 flags.defeatTest 结算。',
}
