// 10030 手眼协调（Hand-Eye Coordination）· 守护者事件 · 1 经验 · 1 资源 · 洞察
// 卡面：快速。只能在你的回合期间打出。
//       结算你控制的[[工具]]或[[武器]]支援上的一个[action]能力，不支付其[action]费用。
//
// 读点（卡面 → 引擎）：
//   · 快速 + 只能在自己回合 = 条目 playCondition[ownTurn()]（matcher.js）与 played 描述子的 fast；
//     played 描述子不声明 trigger，因此它在行动点用尽后的空档期是 legalMoves 的直接 play 行动
//     （docs/card-model.md §7.1「回合收尾」），也仍会出现在其它玩家窗口的「⚡ 快速打出」候选里。
//   · 「结算一个[action]能力，不支付其[action]费用」= api.resolveAssetAction(seat, { assetId,
//     abilityIndex, waive:'action' })：与 legalMoves/牌桌按钮走同一个 resolveCardAbility，
//     ignoreActionCost 只免行动费，其余费用（横置/充能/弹药/资源）照付。
//   · 「[[工具]]或[[武器]]」= 支援特性（实例 traits + cardDef.traits 合并后小写比对），
//     候选还要求该支援当前确实有可执行的[action]能力（api.cardAbilityOptions）。
//   · 参考实现的 TabooList24 分支（0–3 级限制）不在本 Mod 的禁卡表模型内，按无 Taboo 的
//     其余文本结算（见卡面注释）。

// 「只能在自己回合期间打出」的纯判据（与 engine/matcher.js#ownTurn 同口径；卡文件不 import 引擎）。
const ownTurn = () => ctx => {
  const { state, inv } = ctx || {}
  return state?.phase === 'investigation' && state?.currentSeat === inv?.seat
}


const CODE = '10030'
const ASSET_TRAITS = ['tool', 'weapon']

function traitsOf(api, asset) {
  const list = [...(asset?.traits || []), ...(api.cardTraits(asset?.code) || [])]
  return new Set(list.map(trait => String(trait).toLowerCase()))
}

function resolvableAssets(state, inv, api) {
  return (inv.assets || []).filter(asset => {
    if (!asset) return false
    const traits = traitsOf(api, asset)
    if (!ASSET_TRAITS.some(trait => traits.has(trait))) return false
    return api.cardAbilityOptions(inv.seat, asset, { ignoreCosts: true }).length > 0
  })
}

function resolveAssetActionFree({ state, inv, api }) {
  const candidates = resolvableAssets(state, inv, api)
  if (!candidates.length) {
    api.info('手眼协调：你没有带可结算[action]能力的[[工具]]或[[武器]]支援。')
    return
  }
  const assetId = candidates.length === 1 ? candidates[0].id : api.choice({
    kind: 'asset', source: CODE, seat: inv.seat,
    prompt: '手眼协调：选择要结算[action]能力的支援。',
    options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
  })
  const asset = candidates.find(item => item.id === assetId) || candidates[0]
  const abilities = api.cardAbilityOptions(inv.seat, asset, { ignoreCosts: false })
  if (!abilities.length) {
    api.info(`手眼协调：「${api.cardName(asset.code)}」当前没有可结算的[action]能力。`)
    return
  }
  let picked = abilities[0]
  if (abilities.length > 1) {
    const index = Number(api.choice({
      kind: 'ability', source: CODE, seat: inv.seat,
      prompt: `手眼协调：选择「${api.cardName(asset.code)}」要结算的能力。`,
      options: abilities.map((ability, position) => ({ id: String(position), label: ability.label })),
    }))
    picked = abilities[Number.isSafeInteger(index) ? index : 0] || abilities[0]
  }
  const done = api.resolveAssetAction(inv.seat, { assetId: asset.id, abilityIndex: picked.index, waive: 'action' })
  if (done) api.info(`🤝 手眼协调：不支付[action]费用结算「${api.cardName(asset.code)}」的[action]能力。`)
  else api.info(`手眼协调：「${api.cardName(asset.code)}」的能力结算失败（费用或目标不满足）。`)
}

export default {
  code: CODE,
  name: 'Hand-Eye Coordination',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '结算一个[[工具]]/[[武器]]支援上的[action]能力（不支付[action]费用）',
      resolve: resolveAssetActionFree,
    },
  ],
  modifiers: [],
}
