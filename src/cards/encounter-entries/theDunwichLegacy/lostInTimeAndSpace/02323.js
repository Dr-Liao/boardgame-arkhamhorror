// 02323 犹格·索托斯
// 归属：关卡专用 · lostInTimeAndSpace（迷失时空）
// 遭遇组：lost_in_time_and_space
// 卡面：庞大。猎手。反击。
// 卡面：犹格·索托斯得到+6[per_investigator]生命。
// 卡面：犹格·索托斯不能被躲避，不能进行趁乱攻击。
// 卡面：[reaction] 在犹格·索托斯攻击你时：你可以不受到最多X点恐惧，改为从自己牌库顶弃掉最多X张卡牌。然后，如果你的牌库没有卡牌，你发疯。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { originalOf } from '../../_shared.js'

export default {
  code: '02323', scope: 'enemy', enemyRule: { healthPerPlayerBonus: 6, cannotEvade: true, cannotOpportunityAttack: true },
  // 第 114 轮：跨卡身份查询（dunwich-chaos 的石板标记）用条目标志，不再写死卡号。
  flags: { yogSothoth: true },
  enemyScript: {
    onDefeated(state, enemy, api) {
      if (state.scenario?.id === 'lostInTimeAndSpace'
        && originalOf(state.agendas[state.agendaIndex] || {}) === '02315') api.finish('r3')
    },
  },
}
