// 09019「邦妮·沃尔什」（Bonnie Walsh）· 支援 · 查理专属签名
// 卡面：查理·凯恩牌库专用。
//   [reaction] 在你横置邦妮·沃尔什后：重整你控制的另一名 [[盟友]] 支援。（每轮一次）
//
// 读点：P5 通用窗口 `assetExhausted`（ability-exec.js 支付横置费用后打开；context 带 assetId/assetCode）。
export default {
  code: '09019',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'assetExhausted',
      limit: 'oncePerRound',
      label: '横置邦妮后：重整另一名盟友支援',
      criteria: [({ inv, context }) => context?.assetCode === '09019' && context?.seat === inv.seat],
      resolve: ({ inv, api }) => {
        const allies = (inv.assets || []).filter(asset => asset.code !== '09019' && asset.exhausted
          && (api.cardTraits(asset.code) || []).some(trait => String(trait).toLowerCase() === 'ally'))
        if (!allies.length) return
        const target = allies.length === 1 ? allies[0] : allies[Number(api.choice({
          kind: 'target', source: '09019', seat: inv.seat, prompt: '选择要重整的盟友支援。',
          options: allies.map((asset, index) => ({ id: String(index), label: api.cardName(asset.code) })),
        }))]
        if (target) api.ready(target)
      },
    },
  ],
  modifiers: [],
}
