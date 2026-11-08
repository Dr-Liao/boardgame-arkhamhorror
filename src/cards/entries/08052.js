// 08052 行业专家（Savant）· 游荡者（Rogue）技能 · 1 经验。
//
// 卡面：行业专家获得等于你最低技能值(除正在检定的技能外)的 [wild] 图标。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：commit 档案的 `iconBonus`（src/engine/stats.js#conditionalCommitIcons）——动态图标
// 按"未参与本次检定的技能里最低的印刷技能值"给。注意：iconBonus 的 ctx 没有 getStat/api，
// 因此这里读 cards-data 的印刷技能值（近似；已登记 primitive request 让主进程把修正后属性
// 或 api 读点传进 iconBonus，接线后本卡自动可改成修正值）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

const printedSkill = (inv, skill) => Number(ALL_CARDS[inv?.code]?.[skill] ?? 0)

export default {
  code: '08052',
  abilities: [
    {
      kind: 'commit',
      label: '行业专家：获得等于你最低技能值（除正在检定的技能外）的万能图标',
      skill: {
        iconBonus: ({ inv, skill }) => {
          const tested = new Set((Array.isArray(skill) ? skill : [skill]).filter(Boolean))
          const remaining = SKILLS.filter(name => !tested.has(name))
          if (!remaining.length) return 0
          return Math.min(...remaining.map(name => printedSkill(inv, name)))
        },
      },
    },
  ],
  modifiers: [],
}
