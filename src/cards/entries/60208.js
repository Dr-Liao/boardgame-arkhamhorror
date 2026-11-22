// 60208 百科全书
// 卡面：使用(5秘密)。
// 卡面：[action]横置百科全书并花费1秘密：选择你所在地点的一位调查员。该调查员直到本阶段结束前，得到你指定的一项技能+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { SKILL_NAMES_ZH } from './_shared.js'

export default {
  code: '60208',
  uses: 5,
  usesType: 'secrets',
  abilities: [{
    kind: 'action',
    label: '横置并花费 1 秘密：同地点一位调查员的一项技能至阶段结束 +2',
    cost: { action: true, exhaust: true, uses: 1 },
    target: { kind: 'investigator' },
    resolve: ({ inv, api, target }) => {
      if (!target?.entity) return
      const skill = api.choice({
        kind: 'effect', source: '60208', seat: inv.seat, prompt: '选择要提高的技能。',
        options: Object.entries(SKILL_NAMES_ZH).map(([id, label]) => ({ id, label })),
      })
      api.addEffect({
        duration: 'endOfPhase', sourceCode: '60208', label: '百科全书：技能 +2',
        modifiers: [{ target: 'skill:' + skill, amount: 2 }],
      }, target.entity.seat)
    },
  }],
}
