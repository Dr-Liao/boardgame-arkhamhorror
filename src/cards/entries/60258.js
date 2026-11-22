// 60258 心理学学生（Psychology Student）
// 卡面：[reaction] 你打出心理学学生后：治愈你所在地点一位调查员或一个[[盟友]]支援的 2 点恐惧。
// 读点：reaction trigger assetEnteredPlay（investigator-mechanics.js 窗口 context.assetCode）+ api.healHorror / api.healAsset。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60258'

const allyTrait = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE,
  abilities: [{
    kind: 'reaction',
    trigger: 'assetEnteredPlay',
    label: '打出后：治愈一位调查员或一个盟友支援 2 点恐惧',
    criteria: [({ inv, context }) => context?.seat === inv.seat && context?.assetCode === CODE],
    resolve: ({ state, inv, api }) => {
      const targets = []
      for (const owner of state.investigators.filter(item => !item.defeated && !item.resigned
        && item.location === inv.location)) {
        if ((owner.horror || 0) > 0) targets.push({ id: 'i:' + owner.seat, seat: owner.seat, assetId: null,
          label: owner.name })
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
        if (asset) api.healAsset(asset, { horror: 2, owner })
      } else {
        api.healHorror(target.seat, 2)
      }
    },
  }],
  modifiers: [],
}
