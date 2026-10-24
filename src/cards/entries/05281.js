// 05281 勇闯火线
// 卡面：快速。只能在你回合期间打出。
// 卡面：选择你一项技能。直到你回合结束，将该技能的基础值设为5。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05281 勇闯火线：打出时选一项技能，用 state.effects 的 endOfTurn 修正把它补到基础值 5
// （需要 set-base 语义，用「差值修正」实现；后续检定读到 5，回合结束由统一过期点清理）。

import { ownTurn } from '../../engine/matcher.js'

const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

export default {
  code: '05281',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '把一项技能的基础值设为 5 直到回合结束',
      resolve: ({ inv, api }) => {
        const answer = api.choice({ kind: 'skill', source: '05281', seat: inv.seat,
          prompt: '选择要设为 5 的技能。', options: SKILLS.map(skill => ({ id: skill, label: api.skillName(skill) })) })
        const skill = SKILLS.includes(answer) ? answer : 'willpower'
        const amount = 5 - (inv[skill] || 0)
        api.addEffect({
          duration: 'endOfTurn',
          sourceCode: '05281',
          label: `本回合${api.skillName(skill)}基础值设为 5`,
          modifiers: [{ target: `skill:${skill}`, amount }],
        })
        api.info(`${inv.name} 本回合的${api.skillName(skill)}基础值视为 5。`)
      },
    },
  ],
  modifiers: [

  ],
}
