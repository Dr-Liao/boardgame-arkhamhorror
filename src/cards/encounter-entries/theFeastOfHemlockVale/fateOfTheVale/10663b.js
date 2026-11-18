// 10663b 宇宙密使 Cosmic Emissary（幻影 · 破碎面） · 敌人（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：冷漠。猎手。警戒。猎物 - [战斗]最高者。强制 - 当你在本地点的一次技能检定中揭示[elder_thing]标记后：本次检定自动失败，或本敌人攻击你。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.tokenReaction → behavior.shatteredEmissaryReaction（品牌标记 + 两个选项）
//   · behavior.testAutoFail 读取选择结果（fateAutoFail）
export default {
  code: '10663b',
  scope: 'enemy',
  implemented: true,
  flags: {
    cosmicEmissary: true,
    formation: 'shattered',
    frontFaceCode: '10663a',
    tokenReaction: {
      token: 'elderthing',
      choices: ['autoFail', 'attack'],
    },
  },
  note: 'approximation: 标记反应走 behavior.applyTokenEffect / afterTokenReveal 的 choose；「自动失败」经 behavior.testAutoFail 生效。',
}
