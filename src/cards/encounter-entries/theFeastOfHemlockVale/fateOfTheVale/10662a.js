// 10662a 宇宙密使 Cosmic Emissary（深渊 · 正面） · 敌人（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：巨大。不能发动借机攻击。强制 - 当你成功攻击或躲避本敌人时：改为本敌人在本轮敌军阶段不攻击（不造成伤害/不横置）。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.cosmicEmissary → behavior.emissaryInPlay / flipEmissariesToShattered（按条目声明分派）
//   · flags.backFaceCode → behavior.flipEmissariesToShattered（翻面卡号）
//   · flags.cannotBeDamaged → behavior.enemyDamageAllowed
//   · flags.wardOnFightEvade → behavior.enemyAttackedSuccessfully / enemyCannotAttack
export default {
  code: '10662a',
  scope: 'enemy',
  implemented: true,
  flags: {
    cosmicEmissary: true,
    formation: 'colour',
    backFaceCode: '10662b',
    cannotBeDamaged: true,
    wardOnFightEvade: true,
  },
  note: 'approximation: 正面没有生命值（印刷如此），因此 enemyDamageAllowed 直接禁止伤害；「本轮不攻击」用 behavior.wardEmissary + enemyCannotAttack 记录。',
}
