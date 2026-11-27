// 09565b 恸哭女士（The Weeping Lady · Broken Statuette · [[Unstable]] 面）· 绯红密钥
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   变换 - 如可能，每位调查员必须弃掉自己控制的一个支援。然后，如果是调查员变换了本钥匙，
//   将其翻至 [[Stable]] 面。
export default {
  code: '09565b',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    shift({ state, api }) {
      const scenario = api.scenario ?? api
      for (const owner of state.investigators) {
        if (owner.defeated || owner.resigned) continue
        const assets = (owner.assets || []).filter(asset => scenario.canDiscardAsset(owner.seat, asset.id))
        if (!assets.length) continue
        const chosen = assets.length === 1 ? assets[0].id : api.choose({
          kind: 'card', source: '09565b', seat: owner.seat,
          prompt: '恸哭女士：选择弃掉一个你控制的支援。',
          options: assets.map(asset => ({
            id: asset.id, cardCode: asset.code, label: api.cardName?.(asset.code) ?? asset.name ?? asset.code,
          })),
        })
        scenario.discardAsset(owner.seat, assets.find(asset => asset.id === chosen)?.id ?? assets[0].id)
      }
    },
  },
}
