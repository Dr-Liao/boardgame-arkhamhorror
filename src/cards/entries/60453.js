// 60453 故土呼唤（Called to Guinée，Marie Lambeau 专属弱点）
// 卡面：显现 - 将故土呼唤放置入场，位于你的威胁区域。你不能治疗伤害。
//       [action] 从你的手牌中选择并弃掉 3 张卡牌：弃掉故土呼唤。
//
// 引擎读点：
//   · 「你不能治疗伤害」= 条目 flags.cannotHealDamage（harm-threat.js 的 healDamage/healHorror
//     入口统一读取：持有该 weak 卡时治疗伤害被拒绝并记日志）。这是持续能力，不是一次性效果。
//   · [action] 弃 3 张手牌 = cost.discardHand:3；弃掉本卡 = api.removeThreat（威胁区唯一移除入口）。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60453',
  flags: { cannotHealDamage: true },
  abilities: [
    {
      kind: 'weakness',
      label: '显现时放入威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'action',
      label: '弃掉 3 张手牌：弃掉故土呼唤',
      cost: { action: true, discardHand: 3 },
      criteria: [ownSeat(), ({ inv }) => (inv.hand || []).length >= 3],
      resolve: ({ inv, source, api }) => api.removeThreat(source),
    },
  ],
}
