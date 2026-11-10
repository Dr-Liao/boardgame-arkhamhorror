// 09007「受伤的旁观者」（Wounded Bystander）· 支援 · 文森特专属弱点
// 卡面（On Death's Doorstep���：显现 - 将「受伤的旁观者」放入你的游戏区域，其上有 3 点伤害。
//   当它身上有伤害时不能离场（除非被击败）。若它没有伤害，弃掉它。
//   强制 - 当你受到非直接伤害时：该伤害必须分配给「受伤的旁观者」（若其可承受）。
//
// 读点：weaknessPlaysAsAsset + weakness type threat 的资产分支（weakness.js）；
//   cannotLeavePlayWhile（assets.js leaveAsset 入口）；entersPlay 描述子挂伤害。
export default {
  code: '09007',
  weaknessPlaysAsAsset: true,
  cannotLeavePlayWhile: (state, inv, asset) => (Number(asset?.damage) || 0) > 0,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：以 3 点伤害放入你的游戏区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'entersPlay',
      label: '入场：其上放置 3 点伤害',
      resolve: ({ source, api }) => {
        if (source && api.investigatorTools?.setAssetDamage) api.investigatorTools.setAssetDamage(source, 3)
      },
    },
    {
      kind: 'forced',
      trigger: 'harmAssigned',
      silent: true,
      label: '你受到非直接伤害时：伤害必须分配给受伤的旁观者',
      criteria: [({ state, inv, context, source }) => {
        if (state.skillTest) return false
        if (!(Number(context?.damage) > 0) || context?.direct === true) return false
        const asset = (inv.assets || []).find(item => item.code === '09007')
        return Boolean(asset) && asset.id === source?.id && (Number(asset.damage) || 0) < 5
          && Number.isInteger(context?.seat) && state.investigators[context.seat]?.seat === inv.seat
      }],
      resolve: ({ inv, context, api }) => {
        const asset = (inv.assets || []).find(item => item.code === '09007')
        if (!asset) return
        const amount = Math.max(0, Number(context.damage) || 0)
        api.investigatorTools.setAssetDamage(asset, amount)
        context.damage = 0
        api.info(`🩸 伤害由「受伤的旁观者」承受 ${amount} 点。`)
      },
    },
  ],
  modifiers: [],
}
