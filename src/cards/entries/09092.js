// 09092 艾勒·鲁巴什（Elle Rubash）· 秘术师支援 · 2 经验。
// 卡面：你结算附属的支援的技能检定时得到 +1 技能值。
//       每张附属的支援上有 1 个毁灭标记不计入密谋的毁灭阈值。
//       [fast] 横置艾勒·鲁巴什：选择你游戏区域内一个有毁灭标记的支援。
//       将其附属到艾勒·鲁巴什，或与一个已经附属的支援交换。（仅限附属 2 个支援）。
//
const code = '09092'
const inPlay = (inv, source) => inv.assets.filter(asset => asset.id !== source.id
  && asset.attachedToAsset == null && (asset.doom || 0) > 0)
const attached = (inv, source) => inv.assets.filter(asset => asset.attachedToAsset === source.id)

export default {
  code,
  assetRule: { ignoreOneDoomOnAttachment: true },
  abilities: [
    {
      kind: 'free',
      label: '横置：附属一个带毁灭的支援，或与已附属的支援交换（最多两个）',
      cost: { exhaust: true },
      criteria: [({ inv, source }) => inPlay(inv, source).length > 0],
      resolve: ({ inv, source, api }) => {
        const candidates = inPlay(inv, source)
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '选择一个带毁灭的支援。',
          options: candidates.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const attachedAssets = attached(inv, source)
        const options = attachedAssets.length < 2 ? [{ id: 'attach', label: '直接附属' }] : []
        options.push(...attachedAssets.map(asset => ({ id: asset.id, label: `与「${api.cardName(asset.code)}」交换` })))
        const option = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '选择直接附属或交换。', options,
        })
        api.attachOrSwapControlledAsset(inv.seat, source.id, picked, {
          maximum: 2, ...(option === 'attach' ? {} : { replaceId: option }),
        })
      },
    },
    {
      kind: 'forced',
      trigger: 'testBegins',
      limit: { scope: 'perTest', owner: 'instance' },
      silent: true,
      label: '结算附属支援的技能检定时，本次检定 +1 技能值',
      criteria: [({ state, inv, source }) => state.skillTest?.seat === inv.seat
        && attached(inv, source).some(asset => asset.id
          === (state.skillTest.assetSourceId ?? state.skillTest.source?.assetId ?? state._resolvingAssetId))],
      resolve: ({ api }) => api.addPendingTestBonus(1),
    },
  ],
  modifiers: [],
}
