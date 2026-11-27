// 08037 地区勘测
// 卡面：地区探测在你手中或投入到技能检定中时，其获得等于你[agility]的[intellect]图标，
//       以及等于你[intellect]的[agility]图标。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '08037',
  abilities: [
    {
      kind: 'commit',
      label: '手中/投入时：获得等于[agility]的[intellect]图标、等于[intellect]的[agility]图标',
      skill: {
        iconBonus: ({ skill, getStat }) => {
          const skills = [].concat(skill)
          const fromAgility = skills.includes('intellect') ? Math.max(0, getStat('agility')) : 0
          const fromOtherSkill = skills.includes('agility') ? Math.max(0, getStat('intellect')) : 0
          return fromAgility + fromOtherSkill
        },
      },
    },
  ],
  modifiers: [],
}
