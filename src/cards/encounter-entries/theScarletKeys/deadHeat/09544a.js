// 09544a 末绽之花（稳定面）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：变换 - 治愈你所在地点每位调查员各 1 点伤害和 1 点恐惧。将此密钥翻到其[[动荡]]面。
export default {
  code: '09544a',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    keyCard: true,
    keyId: '09544',
    face: 'stable',
    unstableFaceCode: '09544b',
    shiftEffect: 'healInvestigatorsAtBearerLocation',
    shiftEffects: { healDamage: 1, healHorror: 1, scope: 'bearerLocationInvestigators' },
  },
  assetRule: {
    shift({ state, api, context }) {
      if (context.by !== 'investigator') return
      const bearer = state.investigators[context.seat ?? context.bearer?.seat]
      if (!bearer?.location) return
      for (const investigator of state.investigators) {
        if (investigator.location !== bearer.location || investigator.defeated || investigator.resigned) continue
        api.healDamage(investigator.seat, 1)
        api.healHorror(investigator.seat, 1)
      }
    },
  },
}
