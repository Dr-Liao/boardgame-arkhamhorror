// 10653 危险瘴气 The Miasma · 议程（2a）（fateOfTheVale · 山谷的命运 P7）
// 归属：关卡专用 · theFeastOfHemlockVale/fateOfTheVale（遭遇组 fate_of_the_vale）。
// 卡面：强制 - 当将从遭遇牌库抽牌时：改为从深渊底部揭示并抽取遭遇卡（其余揭示牌放到深渊顶部）。凝视密使超过 15 秒 → 疯狂。
//
// 一张卡一个文件：条目只声明身份与规则数据（flags），行为接线在章节 behavior：
//   · flags.abyssMythosReplacement → behavior.abyssMythosActive
//   · flags.cosmicEmissaryGaze → behavior.timedEnemyView（房主服务器计时）
//   · flags.backTest → behavior.agendaReveal（战斗或敏捷 4，每失败 1 点选择伤害或将顶牌洗入深渊）
export default {
  code: '10653',
  scope: 'agenda',
  implemented: true,
  flags: {
    abyssMythosReplacement: true,
    cosmicEmissaryGaze: true,
    backTest: {
      skills: ['combat', 'agility'],
      difficulty: 4,
      penalty: 'damageOrDeckTopToAbyss',
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
