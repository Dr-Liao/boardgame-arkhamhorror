// 08078 无畏精神（Dauntless Spirit）· 幸存者（Survivor）技能 · 1 经验。
//
// 卡面：无畏精神在你手中或投入到技能检定中时，其获得等于你 [combat] 的 [willpower] 图标，
//       以及等于你 [willpower] 的 [combat] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 动态承诺图标按调查员当前有效技能值计算。
export default {
  code: '08078',
  abilities: [
    {
      kind: 'commit',
      label: '无畏精神：获得等于你[战斗]的[意志]图标与等于你[意志]的[战斗]图标',
      skill: {
        iconBonus: ({ getStat, skill }) => {
          const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
          let icons = 0
          if (tested.has('willpower')) icons += getStat('combat')
          if (tested.has('combat')) icons += getStat('willpower')
          return icons
        },
      },
    },
  ],
  modifiers: [],
}
