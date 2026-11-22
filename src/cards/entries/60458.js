// 60458 献祭人偶（Sacrificial Doll，Marie Lambeau）· 支援（3 费，手部槽位）
// 卡面：你的剩余生命值不超过 3 时，[献祭人偶]不占用手部槽位。
//       [reaction] 技能检定期间，你揭示了非[auto_fail]混乱标记后，受到 1 点伤害并横置[献祭人偶]：
//       取消该标记，从混乱袋中揭示标记，直到揭示了一个带有符号的标记。结算该标记，忽略其余标记。
//
// 读点（批次 3 原语）：
//   · 触发窗口 chaosTokenRevealed（揭示混乱标记后的统一窗口，tests.js#performTest 标记揭示段）；
//   · api.revealTokenUntilSymbol(context)：在窗口里登记「取消当前标记，补揭示到符号标记」，
//     引擎在窗口返回后归还当前标记并继续揭示（同一段测试代码消费该标记）；
//   · 成本：横置（cost.exhaust，引擎扣费）+ 受到 1 点伤害（api.damage，结算开始时支付）。
//     「结算该标记、忽略其余」由引擎的补揭示逻辑完成，不需要卡侧再 revealChaosTokens。
// 手部槽位豁免：flags.noHandSlotWhenLowHealth（低生命时不占手部槽位，由支援槽位读点消费）。
import { ownSeat } from '../../engine/matcher.js'

const CODE = '60458'

export default {
  code: CODE,
  flags: { noHandSlotWhenLowHealth: 3 },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'chaosTokenRevealed',
      label: '受到 1 点伤害并横置：取消该标记，补揭示到符号标记',
      cost: { exhaust: true },
      criteria: [ownSeat(), ({ context }) => Boolean(context?.token) && context.token !== 'autofail'],
      resolve: ({ inv, context, api }) => {
        api.damage(inv.seat, 1)
        api.revealTokenUntilSymbol(context)
      },
    },
  ],
  modifiers: [],
}
