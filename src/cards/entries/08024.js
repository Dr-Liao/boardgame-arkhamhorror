// 08024 防御姿态
// 卡面：防御姿态在你手中或投入到技能检定中时，其获得等于你[agility]的[combat]图标，
//       以及等于你[combat]的[agility]图标。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '08024',
  abilities: [
    {
      kind: 'commit',
      label: '手中/投入时：获得等于[agility]的[combat]图标、等于[combat]的[agility]图标',
      skill: {
        iconBonus: ({ skill, getStat }) => {
          const skills = [].concat(skill)
          const fromAgility = skills.includes('combat') ? Math.max(0, getStat('agility')) : 0
          const fromOtherSkill = skills.includes('agility') ? Math.max(0, getStat('combat')) : 0
          return fromAgility + fromOtherSkill
        },
      },
    },
  ],
  modifiers: [],
}
