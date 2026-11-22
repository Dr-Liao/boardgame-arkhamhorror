// 60252 实验心理学（Experimental Psychology，卡洛琳签名）
// 卡面：[action] 检定[intellect](2)。成功时治愈你所在地点一位调查员或一个[[盟友]]支援的 1 点恐惧。
// [reaction] 你治愈调查员的恐惧后，横置：该调查员本轮下次技能检定 +2 技能值。
// 读点：action 描述子 + api.test；reaction trigger horrorHealed + cost.exhaust + playerTools.addNextTestBonus（下一检定加值唯一读点）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60252'

const allyTrait = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE,
  abilities: [
    {
      kind: 'action',
      label: '检定智识(2)：成功治愈 1 点恐惧',
      cost: { action: true },
      resolve: ({ state, inv, api }) => {
        api.test(inv.seat, 'intellect', 2, {
          source: { code: CODE, label: '实验心理学' },
          resolve: result => {
            if (!result.success) return
            const targets = []
            for (const owner of state.investigators.filter(item => !item.defeated && !item.resigned
              && item.location === inv.location)) {
              if ((owner.horror || 0) > 0) targets.push({ id: 'i:' + owner.seat, seat: owner.seat,
                assetId: null, label: owner.name })
              for (const asset of owner.assets || []) {
                if ((asset.horror || 0) > 0 && allyTrait(api.cardTraits(asset.code))) {
                  targets.push({ id: 'a:' + asset.id, seat: owner.seat, assetId: asset.id,
                    label: api.cardName(asset.code) })
                }
              }
            }
            if (!targets.length) return
            const id = targets.length === 1 ? targets[0].id : api.choice({
              kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要治愈恐惧的调查员或盟友。',
              options: targets.map(item => ({ id: item.id, label: item.label })),
            })
            const target = targets.find(item => item.id === id) || targets[0]
            if (!target) return
            if (target.assetId) {
              const owner = state.investigators.find(item => item.seat === target.seat)
              const asset = (owner?.assets || []).find(item => item.id === target.assetId)
              if (asset) api.healAsset(asset, { horror: 1, owner })
            } else {
              api.healHorror(target.seat, 1)
            }
          },
        })
      },
    },
    {
      kind: 'reaction',
      trigger: 'horrorHealed',
      label: '治愈调查员恐惧后横置：该调查员本轮下次检定 +2',
      cost: { exhaust: true },
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [({ inv, context }) => context?.cardSeat === inv.seat && Number.isInteger(context?.healedSeat)],
      resolve: ({ context, api }) => api.playerTools.addNextTestBonus(context.healedSeat, 2),
    },
  ],
  modifiers: [],
}
