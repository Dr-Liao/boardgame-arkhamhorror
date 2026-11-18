// 10031 膂力过人（Strong-Armed）· 守护者技能 · 1 经验 · 天赋 · [combat][agility]
// 卡面：膂力过人投入到使用[[近战]]或[[远程]]支援的攻击时，本次攻击造成 +1 伤害。
//       本次技能检定揭示混乱标记后，你可以受到 1 点伤害，以取消该混乱标记，将其放回混乱袋，
//       并揭示一个新标记。（你可以执行任意次数。）
//
// 读点（卡面 → 引擎）：
//   · 「投入到使用[[近战]]/[[远程]]支援的攻击」= commit 档案 skill.onCommit(ctx)：
//     tests.js 在投入后立即调用；ctx.state.skillTest.source.label 为「攻击」表示本次检定是攻击，
//     攻击支援来自 state.skillTest.assetSourceId / source.assetId / state._resolvingAssetId
//     （reveal.js#executeDescriptor 在支援能力结算期间压入 _resolvingAssetId，与 09023 同读点）。
//   · 「本次攻击 +1 伤害」= api.playerTools.addAttackDamageBonus(1)：写 state.skillTest.attackDamageBonus，
//     combat.js 的成功伤害公式并入（08086 同原语）。
//   · 「受到 1 点伤害取消标记、放回混乱袋并揭示新标记（任意次数）」= reaction + tokenEffectWouldResolve
//     窗口 + cost.damage:1 + api.playerTools.rerollToken(context, code)。引擎揭示循环在
//     rerollToken 时归还该标记并重新揭示（tests.js:959 → continue 重抽），窗口每次重抽都会再开，
//     因此「任意次数」由玩家逐次选择实现（08126 厚重皮衣同口径）。
//   · 这张牌在投入区时仍会被 descriptorSources 枚举为能力来源（ability-rules.js 的
//     state.skillTest.committed 分支），因此反应能力写在同一份条目里就可达。
const CODE = '10031'
const ATTACK_ASSET_TRAITS = ['melee', 'ranged']

function attackAsset(state, inv) {
  const id = state.skillTest?.assetSourceId ?? state.skillTest?.source?.assetId ?? state._resolvingAssetId
  if (id == null) return null
  return (inv.assets || []).find(asset => asset.id === id) || null
}

function grantDamageBonus({ state, inv, api }) {
  if (!state.skillTest) return
  if (state.skillTest.source?.label !== '攻击') return
  const asset = attackAsset(state, inv)
  if (!asset) return
  const traits = new Set([...(asset.traits || []), ...(api.cardTraits(asset.code) || [])]
    .map(trait => String(trait).toLowerCase()))
  if (!ATTACK_ASSET_TRAITS.some(trait => traits.has(trait))) return
  api.playerTools.addAttackDamageBonus(1)
  api.info('💪 膂力过人：本次攻击使用[[近战]]/[[远程]]支援，造成 +1 伤害。')
}

export default {
  code: CODE,
  name: 'Strong-Armed',
  abilities: [
    {
      kind: 'commit',
      label: '膂力过人：使用近战/远程支援的攻击 +1 伤害；揭示后受伤可取消标记并重抽',
      skill: { onCommit: grantDamageBonus },
    },
    {
      kind: 'reaction',
      trigger: 'tokenEffectWouldResolve',
      label: '受到 1 点伤害：取消该混乱标记，放回混乱袋并揭示一个新标记',
      cost: { damage: 1 },
      criteria: [({ state, inv, context }) => Boolean(state.skillTest)
        && context?.seat === inv.seat
        && context?.when === 'tokenEffectWouldResolve'
        && !context.rerollToken
        && !context.cannotCancel
        && (state.chaosBag || []).length > 0
        && (state.skillTest.committed || []).some(item => item.code === CODE && item.seat === inv.seat)],
      resolve: ({ context, api }) => {
        if (!api.playerTools.rerollToken(context, CODE)) return
        api.info('💪 膂力过人：受到 1 点伤害，取消该混乱标记，放回混乱袋并重新揭示。')
      },
    },
  ],
  modifiers: [],
}
