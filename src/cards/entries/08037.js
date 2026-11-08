// 08037 地区勘测
// 卡面：地区探测在你手中或投入到技能检定中时，其获得等于你[agility]的[intellect]图标，
//       以及等于你[intellect]的[agility]图标。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：同 08024 —— commit iconBonus 拿不到 getStat（原语请求 m2-1-08024.json），
// 用调查员印刷基值计算两向图标；有属性修正时图标不会随之变化。
import { ALL_CARDS } from '../../cards/cards-data.js'

const baseStat = (inv, skill) => Number(ALL_CARDS[inv?.code]?.[skill]) || 0

export default {
  code: '08037',
  abilities: [
    {
      kind: 'commit',
      label: '手中/投入时：获得等于[agility]的[intellect]图标、等于[intellect]的[agility]图标',
      skill: {
        // 引擎在真实检定管线里传入 skillList 数组，这里同时兼容字符串。
        iconBonus: ({ inv, skill }) => {
          const skills = Array.isArray(skill) ? skill : [skill]
          return skills.includes('intellect') ? baseStat(inv, 'agility')
            : skills.includes('agility') ? baseStat(inv, 'intellect') : 0
        },
      },
    },
  ],
  modifiers: [],
}
