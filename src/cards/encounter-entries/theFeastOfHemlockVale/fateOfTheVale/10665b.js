// 10665b 宇宙密使 Cosmic Emissary（光辉 · 破碎面） · 敌人（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：冷漠。飘忽。猎手。猎物 - [意志]最高者。强制 - 当你在本地点的一次技能检定中揭示[tablet]标记后：本次检定自动失败，或本敌人攻击你。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.tokenReaction → behavior.shatteredEmissaryReaction（tablet）
export default {
  code: '10665b',
  scope: 'enemy',
  implemented: true,
  flags: {
    cosmicEmissary: true,
    formation: 'shattered',
    frontFaceCode: '10665a',
    tokenReaction: {
      token: 'tablet',
      choices: ['autoFail', 'attack'],
    },
  },
  note: 'approximation: 同 10663b（tablet）。',
}
