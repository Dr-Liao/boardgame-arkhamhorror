// 98002 绿人徽章（Green Man Medallion）· 中立 · 支援/道具/遗物 · 费用 1 · 配饰 · 替换（珍妮·巴恩斯）。
// 卡面（cards-data 98002）：
//   珍妮·巴恩斯牌库专用。替换。
//   [fast] 花费至多 3 资源并横置绿人徽章：将那些资源放在它上面，作为「供奉」。
//   [reaction] 当你撤退或游戏结束时：绿人徽章上每有 6 个「供奉」，你在下一场冒险前购买的下 1 张牌
//     的经验费用 -1。
//
// 引擎读点：
//   · 「花费至多 3 资源并横置」= free 描述子 cost { exhaust:true } + api.spendResources（资源唯一扣减入口）；
//   · 「放在它上面，作为供奉」= api.addUses(source, n)（实例 uses 的唯一写点，usesType 声明为 offerings，
//     与 02010 的 ammo 同层）。
// 缺原语（战役层）：
//   · 「撤退/游戏结束时按每 6 个供奉折抵下一场景前购买 1 张卡的经验」需要战役购买层读取「卡实例上的
//     供奉数」并生成临时购买减免（campaign.js#temporaryPurchaseDiscount 目前只认 entry flags 里的
//     固定减免，不读实例 uses）→ primitive-requests/core-cards-a-98002-offerings-xp-discount.json；
//     本条目先把供奉计数与被动记录接线，等 Lead 补读点后即可生效。
const code = '98002'

export default {
  code,
  uses: 0,
  usesType: 'offerings',
  abilities: [{
    kind: 'free',
    cost: { exhaust: true },
    label: '花费至多 3 资源并横置：把那些资源作为「供奉」放在徽章上',
    criteria: [({ inv }) => (inv.resources || 0) > 0],
    resolve: ({ inv, source, api }) => {
      const max = Math.min(3, inv.resources || 0)
      if (max <= 0) return
      const amount = max === 1 ? 1 : Number(api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '绿人徽章：选择要花费并作为「供奉」的资源数（至多 3）。',
        options: Array.from({ length: max }, (_, index) => ({ id: String(index + 1), label: `${index + 1} 资源` })),
      })) || 1
      const n = Math.max(1, Math.min(max, amount))
      if (api.spendResources(inv.seat, n) === false) return
      api.addUses(source, n)
      api.info(`🪙 绿人徽章：放置 ${n} 个「供奉」（当前 ${source?.uses ?? n} 个）。`)
    },
  }],
  modifiers: [],
  note: '待战役层接线：「撤退/游戏结束时每 6 个供奉使下一场景前 1 次购买 -1 经验」需要购买报价读取卡实例 uses 的原语 → primitive-requests/core-cards-a-98002-offerings-xp-discount.json；供奉计数已实现。',
}
