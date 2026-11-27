// 10652 寂灭 The Silence · 议程（1a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：强制 - 当你将从遭遇牌库抽取 1 张或更多卡牌时：改为从深渊底部逐张揭示，直到揭示一张有遭遇卡背的卡牌并抽取它（其余揭示的卡牌放到深渊顶部）。凝视宇宙密使超过 15 秒 → 疯狂。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.abyssMythosReplacement → behavior.abyssMythosActive / drawEncounterFromAbyss
//   · flags.cosmicEmissaryGaze → behavior.timedEnemyView（房主服务器计时）
//   · flags.backTest → behavior.agendaReveal（意志或智识 4，每失败 1 点选择恐惧或将顶牌洗入深渊）
export default {
  code: '10652',
  scope: 'agenda',
  implemented: true,
  flags: {
    abyssMythosReplacement: true,
    cosmicEmissaryGaze: true,
    backTest: {
      skills: ['willpower', 'intellect'],
      difficulty: 4,
      penalty: 'horrorOrDeckTopToAbyss',
    },
  },
  abilities: [{
    kind: 'forced',
    trigger: 'encounterCardWouldDraw',
    silent: true,
    label: '改为从深渊底揭示并抽取一张遭遇卡',
    criteria: ({ state, context }) => state.scenario.id === 'fateOfTheVale' && !context.replaced,
    resolve: ({ context, api }) => {
      context.replaced = true
      api.scenario.resolveScenarioEvent('fateOfTheValeEncounterFromAbyss', { seat: context.seat })
    },
  }],
}
