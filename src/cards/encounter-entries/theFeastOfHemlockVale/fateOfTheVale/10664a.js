// 10664a 宇宙密使 Cosmic Emissary（瘴气 · 正面） · 敌人（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：巨大。迅捷。不能发动借机攻击。强制 - 当你成功攻击或躲避本敌人时：改为本敌人在本轮敌军阶段不攻击。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.cosmicEmissary / backFaceCode / cannotBeDamaged / wardOnFightEvade → 同 10662a
export default {
  code: '10664a',
  scope: 'enemy',
  implemented: true,
  flags: {
    cosmicEmissary: true,
    formation: 'colour',
    backFaceCode: '10664b',
    cannotBeDamaged: true,
    wardOnFightEvade: true,
  },
  note: 'approximation: 同 10662a。',
}
