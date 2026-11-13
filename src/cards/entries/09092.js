// 09092 艾勒·鲁巴什（Elle Rubash）· 秘术师支援 · 2 经验。
// 卡面：你结算附属的支援的技能检定时得到 +1 技能值。
//       每张附属的支援上有 1 个毁灭标记不计入密谋的毁灭阈值。
//       [fast] 横置艾勒·鲁巴什：选择你游戏区域内一个有毁灭标记的支援。
//       将其附属到艾勒·鲁巴什，或与一个已经附属的支援交换。（仅限附属 2 个支援）。
//
// 读点：+1 技能值 = skill:* 修正（statPipeline 唯一读点），条件读本次检定的来源支援是否附属；
//       附属 = api.attachOrSwapControlledAsset（与 08089 同一写点）。
//
// approximation（已写 primitive-request/09092.json）：
//   · 「附属支援上的 1 个毁灭不计入密谋阈值」没有 agendaDoom 的排除读点，未实现（不伪造）。
//   · 引擎的支援宿主同一时刻只支持 1 个 attachedToAsset；「仅限附属 2 个支援」按 1 个近似。
const attachedSource = (state, inv, source) => {
  const id = state?.skillTest?.source?.assetId ?? state?._resolvingAssetId ?? null
  if (!id || !source) return false
  const asset = (inv.assets || []).find(item => item.id === id)
  return asset?.attachedToAsset === source.id
}

export default {
  code: '09092',
  simplified: true,
  note: 'approximation: 见 primitive-request/09092.json（「附属支援 1 个毁灭不计入密谋阈值」缺少 agendaDoom 排除读点；宿主仅支持 1 个附属支援）',
  abilities: [
    {
      kind: 'free',
      label: '横置：选择有毁灭标记的支援附属到艾勒（或交换）',
      cost: { action: false, exhaust: true },
      resolve: ({ state, inv, source, api }) => {
        if (!source) return
        const candidates = (inv.assets || []).filter(asset => asset !== source
          && asset.attachedToAsset == null && (asset.doom || 0) > 0)
        if (!candidates.length) {
          api.info('「艾勒·鲁巴什」：没有可附属的带毁灭支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: '09092', seat: inv.seat,
          prompt: '选择要附属（或交换）的带毁灭支援。',
          options: candidates.map(asset => ({ id: asset.id, label: `${api.cardName(asset.code)}（毁灭 ${asset.doom}）` })),
        })
        api.attachOrSwapControlledAsset(inv.seat, source.id, picked)
        api.info('🕯️ 「艾勒·鲁巴什」：附属了一个带毁灭标记的支援。')
        void state
      },
    },
  ],
  modifiers: [
    { target: 'skill:willpower', amount: 1, condition: { when: ({ state, inv, source }) => attachedSource(state, inv, source) } },
    { target: 'skill:intellect', amount: 1, condition: { when: ({ state, inv, source }) => attachedSource(state, inv, source) } },
    { target: 'skill:combat', amount: 1, condition: { when: ({ state, inv, source }) => attachedSource(state, inv, source) } },
    { target: 'skill:agility', amount: 1, condition: { when: ({ state, inv, source }) => attachedSource(state, inv, source) } },
  ],
}
