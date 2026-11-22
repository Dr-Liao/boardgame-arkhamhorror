// 12003 身临危境（In Harm's Way）· 中立 · 弱点/缺陷。（丹妮拉·雷耶丝的签名弱点）
//
// 卡面：
//   显现 - 将身临危境放置入场，位于你的威胁区域。
//   强制 - 你对敌人造成伤害后：受到 1 点伤害，并在身临危境上放置 1 点伤害。
//     如果本卡牌上有至少 3 点伤害，将其弃掉。
//   强制 - 在游戏结束时：承受 1 点肉体创伤。
//
// 引擎读点（批次 3 · B2 原语落地后）：
//   · 显现：weakness 描述子的 `{ type: 'threat' }` 由 src/engine/weakness.js 的 threat 分支
//     放进威胁区域。
//   · 「你对敌人造成伤害后」：`enemyDamagePlaced` 窗口（enemy-damage.js），context.amount>0 且
//     context.seat 是你；受到 1 点伤害走 api.damage。
//   · 「在卡上放置 1 点伤害 / 3 点以上弃掉」：卡面伤害标记用实例 damage 字段——
//     api.addCardDamage(卡实例, 1) 写、api.cardDamage(卡实例) 读（src/engine/api-misc.js 读点）。
//   · 「游戏结束时承受 1 点肉体创伤」：条目级 `physicalTraumaAtGameEnd: true`，读点
//     src/engine/campaign-flow.js#finishScenario 的威胁区扫描（每张卡一次性：
//     threat.physicalTraumaApplied）。

import { ownSeat } from '../../engine/matcher.js'

const code = '12003'

export default {
  code,
  physicalTraumaAtGameEnd: true,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入你的威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'forced',
      trigger: 'enemyDamagePlaced',
      label: '你对敌人造成伤害后：受到 1 点伤害并在本卡上放置 1 点伤害；3 点以上弃掉',
      criteria: [ownSeat(), ({ context }) => (context?.amount || 0) > 0],
      resolve: ({ inv, source, api }) => {
        api.damage(inv.seat, 1)
        api.addCardDamage(source, 1)
        if (api.cardDamage(source) >= 3) {
          api.removeThreat(source)
          api.info('「身临危境」上已有 3 点伤害，被弃掉。')
        }
      },
    },
  ],
  modifiers: [],
}
