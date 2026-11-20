// 11738 不祥寂静（Ominous Silence）· 诡计 · 共享遭遇组 tdc_flood（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tdc_flood。
// 卡面（cards-data 11738）：
//   显现 - 将不祥寂静放置入场，位于你的威胁区。
//   作为打出一张卡牌的额外费用，你必须花费1个资源或受到1点恐惧。
//   [action]：检定[agility](3)。如果你所在地点未淹没，本检定自动成功。如果你成功，弃掉不祥寂静。
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat；
//   · 「打出卡牌的额外费用」= beforePlayCost 中断窗口（actions.js#payPlayCost 的支付前窗口，
//     context 带 seat/cardCode），持有者的每张威胁区卡都作为窗口来源；二选一走 api.choice，
//     资源 = api.spendResources、恐惧 = api.horror；
//   · 摆脱行动 = 威胁区 action 描述子；「未淹没自动成功」读 api.mechanics.water.level（0 = 未淹没），
//     自动成功时跳过检定直接弃卡（api.removeThreat）；否则 api.test + 成功 api.removeThreat。
const CODE = '11738'
const DIFFICULTY = 3

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE,
  name: '不祥寂静',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Terror'],
    quantity: 2,
    additionalPlayCost: { resourceOrHorror: 1 },
    test: { skill: 'agility', difficulty: DIFFICULTY, autoSuccessWhenUnflooded: true },
  },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, CODE)
    api.info?.(`🤫 「不祥寂静」进入 ${inv.name} 的威胁区域：打出卡牌须额外付 1 资源或受 1 恐惧。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'beforePlayCost',
    silent: true,
    label: '打出一张卡的额外费用：花费 1 资源或受到 1 恐惧',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && Boolean(context?.cardCode) && context?.seat === holder.seat
    },
    resolve: ({ state, source, context, api }) => {
      const holder = holderOf(state, source)
      if (!holder) return
      const canPayResource = (holder.resources || 0) > 0
      const answer = canPayResource ? String(api.choice({
        kind: 'effect', source: CODE, seat: holder.seat,
        prompt: '「不祥寂静」：为打出这张卡额外花费 1 个资源，或受到 1 点恐惧。',
        options: [
          { id: 'resource', label: '花费 1 个资源' },
          { id: 'horror', label: '受到 1 点恐惧' },
        ],
      })) : 'horror'
      if (answer === 'resource') {
        api.spendResources?.(holder.seat, 1)
        api.info?.(`🤫 「不祥寂静」：${holder.name} 为打出「${api.cardName?.(context.cardCode) || context.cardCode}」额外花费 1 资源。`)
      } else {
        api.horror(holder.seat, 1)
        api.info?.(`🤫 「不祥寂静」：${holder.name} 为打出「${api.cardName?.(context.cardCode) || context.cardCode}」受到 1 点恐惧。`)
      }
    },
  }, {
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 1 },
    label: '[action] 敏捷(3)：未淹没时自动成功；成功弃掉不祥寂静',
    criteria: ({ state, source }) => Boolean(holderOf(state, source)),
    resolve: ({ state, inv, source, api }) => {
      const unflooded = api.mechanics?.water?.level?.(inv.location) === 0
      if (unflooded) {
        api.removeThreat?.(source)
        api.info?.(`🤫 「不祥寂静」：所在地点未淹没，检定自动成功，弃掉本卡。`)
        return
      }
      api.test(inv.seat, 'agility', DIFFICULTY, {
        source: { type: 'encounter', code: CODE, name: '不祥寂静', label: '摆脱检定' },
        resolve: result => {
          if (!result?.success) return
          api.removeThreat?.(source)
          api.info?.(`🤫 「不祥寂静」：${inv.name} 检定成功，弃掉本卡。`)
        },
      })
    },
  }],
  note: '威胁区入场/额外打出费用/摆脱行动全部接线：额外费用走 beforePlayCost 中断窗口（二选一，'
    + '无资源时强制受恐惧）；未淹没自动成功按 water.level===0 判定后跳过检定直接弃卡。'
    + '近似：额外费用按「每次打出各张不祥寂静各询问一次」结算（两张副本是两条独立静态规则）。',
}
