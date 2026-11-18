// 10670b 深渊 The Abyss（故事面） · 剧情资产（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：本卡必须一直盖在深渊牌库顶。卡牌总是从深渊底部抽取/揭示。非弱点遭遇卡被弃掉时总是放到深渊顶部。强制 - 当你从深渊抽牌时：诡计/敌人 → 抽取；[[居民]] → 翻到敌人面并获得「显现 - 本敌人攻击你（不与你交战）。弃掉本敌人。」；玩家卡 → 加入所有者手牌；地点 → 与最近的镜巢相邻、未揭示入场并互相连接；「真正的」调查员卡 → 所有者治愈全部伤害/恐惧、控制该卡，并把破碎自我翻到旧时记忆面。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.abyssStory → behavior.abyssStoryInPlay
//   · flags.drawFromBottom / discardToTop → behavior.drawFromAbyss / drawEncounterFromAbyss / putOnAbyss
//   · flags.revealRules → behavior.classifyAbyssCard / resolveAbyssCard（五类结算）
export default {
  code: '10670b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    abyssStory: true,
    global: true,
    alwaysOnTop: true,
    drawFromBottom: true,
    discardToTop: true,
    revealRules: {
      encounter: 'draw',
      resident: 'enemySideAttackThenDiscard',
      player: 'toOwnerHand',
      location: 'placeAdjacentToNearestMirrorNest',
      investigator: 'returnToTrueSelfThenOldMemory',
    },
  },
  note: 'approximation: 深渊牌库用引擎既有 scenarioDecks（deck 尾部为顶、头部为底），「故事卡盖顶」不占牌位；神话阶段替换见 behavior 文件头 approximation 1/3。',
  abilities: [],
}
