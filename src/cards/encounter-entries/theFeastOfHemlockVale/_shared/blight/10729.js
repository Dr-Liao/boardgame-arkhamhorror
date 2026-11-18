// 10729 脱水（Desiccation）· 诡计 · 共享遭遇组 blight（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/blight。
// 卡面（cards-data 10729）：
//   显现 - 将脱水放置入场，放在密谋牌库旁。
//   作为调查员打出卡牌的额外费用，该调查员必须受到 1 点伤害。
//   强制 - 当一轮结束时：从场上弃掉 1 张脱水。（每轮最多一次。）
//
// 读点（声明即接线）：
//   · 「放在密谋牌库旁」= api.putNextToAgenda（scenario-runtime 的唯一 agendaAside 写入口）；
//     返回 { placed: true } 阻止本卡进遭遇弃牌堆；
//   · 「打出卡牌的额外费用」= beforePlayCost 窗口（actions.js#payPlayCost 的支付前窗口，
//     context 带 seat/cardCode/cost）。每次打出触发，放在密谋牌库旁的条目是窗口里的
//     非玩家来源（ability-rules.js#nonPlayerAbilitySources 已含 agendaAside）；
//   · 「轮末弃掉 1 张（每轮最多一次）」= 条目 treacheryRule.discardOneAtRoundEnd
//     （phases.js#upkeepPhase 的旁置卡扫描，同轮最多弃 1 张同名副本）。
//
// 近似：额外费用按「每次打出各副本各造成 1 点伤害」结算（印刷的两张副本是两条独立静态规则）；
//   若主进程裁决为不叠加，只需把 forced 的能力改成只结算其中一张副本。
const CODE = '10729'

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { discardOneAtRoundEnd: true },
  flags: {
    traits: ['Blight'],
    quantity: 2,
    agendaAside: true,
    additionalPlayCost: { damage: 1 },
    discardOneAtRoundEnd: true,
  },
  encounterResolve(state, inv, card, api) {
    api.putNextToAgenda(CODE)
    api.info?.(`🏜️ 「脱水」被放到密谋牌库旁。`)
    return { placed: true }
  },
  abilities: [{
    kind: 'forced',
    trigger: 'beforePlayCost',
    silent: true,
    label: '打出卡牌的额外费用：该调查员受到 1 点伤害',
    criteria: ({ inv, context }) => Boolean(context?.cardCode) && Number.isInteger(inv?.seat)
      && context?.seat === inv.seat,
    resolve: ({ inv, context, api }) => {
      api.damage(inv.seat, 1)
      api.info?.(`🏜️ 「脱水」：${inv.name} 打出「${api.cardName?.(context.cardCode) || context.cardCode}」的额外费用，受到 1 点伤害。`)
    },
  }],
  note: 'approximation: 「打出卡牌的额外费用」走 beforePlayCost 窗口（每次打出触发）；'
    + '两张副本各自结算 1 点伤害。轮末弃 1 张走 treacheryRule.discardOneAtRoundEnd（phases.js 扫描）。',
}
