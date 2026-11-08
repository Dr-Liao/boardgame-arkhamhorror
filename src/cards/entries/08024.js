// 08024 防御姿态
// 卡面：防御姿态在你手中或投入到技能检定中时，其获得等于你[agility]的[combat]图标，
//       以及等于你[combat]的[agility]图标。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// approximation：commit 描述符的 iconBonus 上下文没有 getStat（原语请求 m2-1-08024.json），
// 这里用调查员印刷基值（ALL_CARDS）计算两向图标——无属性修正/装备加值时与有效值一致；
// 有修正时图标不会随之变化。获得的两组图标都按当前检定的技能计入 commitIcons。
import { ALL_CARDS } from '../../cards/cards-data.js'

const baseStat = (inv, skill) => Number(ALL_CARDS[inv?.code]?.[skill]) || 0

export default {
  code: '08024',
  abilities: [
    {
      kind: 'commit',
      label: '手中/投入时：获得等于[agility]的[combat]图标、等于[combat]的[agility]图标',
      skill: {
        // 投入战斗检定时提供「等于敏捷」的图标；投入敏捷检定时提供「等于战斗」的图标。
        // 引擎在真实检定管线里传入 skillList 数组，这里同时兼容字符串（印刷基值近似仍保留）。
        iconBonus: ({ inv, skill }) => {
          const skills = Array.isArray(skill) ? skill : [skill]
          return skills.includes('combat') ? baseStat(inv, 'agility')
            : skills.includes('agility') ? baseStat(inv, 'combat') : 0
        },
      },
    },
  ],
  modifiers: [],
}
