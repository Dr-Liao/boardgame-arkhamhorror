// 01018 巡警（Beat Cop）
// 归属：核心包 · 玩家卡
// 卡面：你得到+1[combat]。
// 卡面：[free]弃掉巡警：对你所在地点的一个敌人造成1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P2-4（2026-10-28）：与重印号 01518 合并为一份实现（01518 等重印号由注册期的
// 重印别名机制生成，数据见 src/cards/entries/_reprint-aliases.js，出口在 card-identity.js）。
// 描述子形状：
//   · 修正用 modifiers（与 passive.stats 同一读点 getStat）；
//   · 能力声明 target:{kind:'enemy'}——目标进入 legalMoves/validateMove/ctx.target（B1 接线）；
//   · 结算用 effect 数据体（dealDamage target:'here'），窗口/合法动作的可行性检查与迁移前一致；
//   · 合法动作形状保留 cost.action:false 的 action（卡面 [free] 关键字的旧实现口径），
//     不在收尾窗口额外生成一条 free 描述子候选（重放指纹敏感；2026-10-28 实测）。
import { skillModifier } from './_shared.js'

export default {
  code: '01018',
  modifiers: [
    skillModifier('combat', 1),
  ],
  abilities: [
    {
      kind: 'action', label: '弃掉：对同地点 1 个敌人造成 1 伤害',
      cost: { action: false, discardSelf: true },
      target: { kind: 'enemy' },
      effect: { type: 'dealDamage', amount: 1, target: 'here' },
    },
  ],
}
