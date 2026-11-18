// 10669 镜巢 Mirror Nest（mirrorNestLeft） · 地点（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：镜巢与其顺时针和逆时针的地点连接。强制 - 在你位于本地点结束你的回合时：随机弃掉 1 张手牌。[action] 共同花费 7/人 线索：查找深渊，找出一张卡牌并抽取它（团队每幕一次）。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.mirrorNest / position → behavior.nestAssignment / applyNestCodes / syncConnections
//   · flags.turnEnd → behavior.turnEnded（回合末强制效果）
//   · flags.abyssSearch → behavior.actions / performAction（仅 10669）
// 印刷：隐藏值 3、线索 2/人、特性 [[破碎]]/[[巢穴]]（数值回卡表与 definition）。
export default {
  code: '10669',
  scope: 'location',
  implemented: true,
  flags: {
    mirrorNest: true,
    position: 'mirrorNestLeft',
    turnEnd: {
      require: null,
      choices: ['discard'],
    },
    abyssSearch: {
      groupCluesPerInvestigator: 7,
      limit: 'oncePerAct',
    },
  },
  note: 'approximation: 「与顺时针/逆时针相邻的镜巢连接」由 behavior.syncConnections 按固定环实现；四个镜巢的卡号洗牌（隐藏信息）由 behavior.nestAssignment 用 randomValue 决定。',
  abilities: [],
}
