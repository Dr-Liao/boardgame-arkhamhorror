// 08052 行业专家（Savant）· 游荡者（Rogue）技能 · 1 经验。
//
// 卡面：行业专家获得等于你最低技能值(除正在检定的技能外)的 [wild] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 动态承诺图标按调查员当前有效技能值计算。
const SKILLS = ['willpower', 'intellect', 'combat', 'agility']


export default {
  code: '08052',
  abilities: [
    {
      kind: 'commit',
      label: '行业专家：获得等于你最低技能值（除正在检定的技能外）的万能图标',
      skill: {
        iconBonus: ({ getStat, skill }) => {
          const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
          const remaining = SKILLS.filter(name => !tested.has(name))
          if (!remaining.length) return 0
          return Math.min(...remaining.map(getStat))
        },
      },
    },
  ],
  modifiers: [],
}
