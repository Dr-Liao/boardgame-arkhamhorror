// 09004 文森特·李（Vincent Lee）· 探求者 · 医生
// 卡面：
//   [reaction] 你的一张卡牌效果治愈了一名调查员或一名调查员的 [[盟友]] 支援上的伤害后：
//     把你场外的一张《术后恢复》加入该调查员的手牌。
//   [elder_sign] 效果：+1。你可以治疗同地点一名调查员或 [[盟友]] 支援上的 1 点伤害。
//   开局：你以每位调查员 1 张《术后恢复》放在场外开始游戏（Additional Setup）。
//
// 读点：伤害被治疗的统一窗口 `damageHealed`（harm-threat.js，P2 起）；
//   context = { seat(治疗者), healedSeat, assetId, amount, cardCode }。
//   场外区 = state.setAside（setup.js 按 investigator.setup.setAsideSignature 预置）。
export default {
  code: '09004',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 1 },
    setup: { setAsideSignature: { code: '09006', perInvestigator: true } },
  },
  elderSign: {
    id: '09004-eldersign',
    label: '文森特旧印：+1；可治疗同地点调查员或盟友的 1 点伤害',
    resolve: ({ state, inv, api }) => {
      const options = []
      for (const other of api.investigatorsAt(inv.location)) {
        if ((other.damage || 0) > 0) options.push({ id: `inv:${other.seat}`, label: `${other.name}（伤害 ${other.damage}）` })
      }
      for (const other of api.investigatorsAt(inv.location)) {
        for (const asset of other.assets || []) {
          if (api.cardType(asset.code) === 'asset' && (asset.damage || 0) > 0) options.push({ id: `asset:${asset.id}`, label: `${api.cardName(asset.code)}（${other.name}）` })
        }
      }
      if (options.length) {
        const answer = api.choice({ kind: 'target', source: '09004', seat: inv.seat, canSkip: true,
          prompt: '是否治疗同地点调查员或盟友上的 1 点伤害？', options: [{ id: 'skip', label: '不治疗' }, ...options] })
        if (answer !== 'skip') api.healDamage(Number(String(answer).split(':')[1]) || inv.seat, 1)
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'damageHealed',
    label: '治疗后：把场外一张《术后恢复》加入被治疗调查员的手牌',
    criteria: ({ state, inv, context }) => context?.cardSeat === inv.seat
      && Number.isInteger(context?.healedSeat)
      && (context.healedSeat === inv.seat
        || state.investigators[context.healedSeat]?.location === inv.location
        || Boolean(context.assetId)),
    resolve: ({ inv, context, api }) => {
      const healedSeat = context.healedSeat
      const setAside = (api.investigatorTools.tskSetAside?.(inv.seat, '09006') || [])[0]
      if (!setAside) return
      api.moveCard({ id: setAside.id, from: 'setAside', to: 'hand', ownerSeat: healedSeat })
      api.info(`🩹 《术后恢复》加入 ${api.investigatorsAt(inv.location).find(other => other.seat === healedSeat)?.name || "该调查员"} 的手牌。`)
      void inv
    },
  }],
  modifiers: [],
}
