// 08065 密教理论（Occult Theory）· 秘术师（Mystic）技能 · 1 经验。
//
// 卡面：密教理论在你手中或投入到技能检定中时，其获得等于你 [intellect] 的 [willpower] 图标，
//       以及等于你 [willpower] 的 [intellect] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 动态承诺图标按调查员当前有效技能值计算。
export default {
  code: '08065',
  abilities: [
    {
      kind: 'commit',
      label: '密教理论：获得等于你[智慧]的[意志]图标与等于你[意志]的[智慧]图标',
      skill: {
        iconBonus: ({ getStat, skill }) => {
          const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
          let icons = 0
          if (tested.has('willpower')) icons += getStat('intellect')
          if (tested.has('intellect')) icons += getStat('willpower')
          return icons
        },
      },
    },
  ],
  modifiers: [],
}
