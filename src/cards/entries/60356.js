// 60356 浑然不觉（Unaware，基础弱点）
// 卡面：显现 - 将浑然不觉放置入场，位于你的威胁区域。
//       强制 - 你在你的回合期间第一次技能检定失败：抽取遭遇牌库顶的卡牌。如果该卡是敌人，弃掉浑然不觉。
//
// 近似：遭遇牌结算后检查是否新生成敌人；是则把本弱点移入弃牌堆。
import { ownSeat, ownTurn } from '../../engine/matcher.js'

export default {
  code: '60356',
  abilities: [
    {
      kind: 'weakness',
      label: '显现时放入威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'forced',
      trigger: 'skillTestFailed',
      label: '你的回合内第一次检定失败：抽 1 张遭遇牌，若是敌人则弃掉本牌（每回合一次）',
      limit: 'oncePerTurn',
      criteria: [
        ownSeat(),
        ownTurn(),
        ({ inv, source }) => Boolean(source) && (inv.threat || []).includes(source),
      ],
      resolve: ({ state, inv, source, api }) => {
        const before = state.enemies.length
        api.drawEncounter(inv.seat)
        // 卡面：如果抽到的卡不是敌人，弃掉浑然不觉；是敌人则保留（近似：抽到敌人时保留）。
        if (state.enemies.length <= before) api.removeThreat(source)
      },
    },
  ],
}
