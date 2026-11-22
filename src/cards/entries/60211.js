// 60211 高等教育
// 卡面：只要你有至少5张手牌，高等教育获得：
// 卡面："[fast]花费1资源：本次技能检定你得到+1[willpower]。
// 卡面：[fast]花费1资源：本次技能检定你得到+1[intellect]。"
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { SKILL_NAMES_ZH } from './_shared.js'

export default {
  code: '60211',
  abilities: ['willpower', 'intellect'].map(skill => ({
    kind: 'free',
    trigger: ['test.beforeCommit', 'test.afterCommit'],
    duringOwnSkillTest: true,
    label: '至少 5 张手牌时花费 1 资源：本次检定' + SKILL_NAMES_ZH[skill] + ' +1',
    cost: { resources: 1 },
    criteria: ({ state, inv }) => inv.hand.length >= 5 && [].concat(state.skillTest?.skill ?? []).includes(skill),
    resolve: ({ api }) => api.addPendingTestBonus(1),
  })),
}
