// 60251 卡洛琳·弗恩（Carolyn Fern，2026 核心/入门包调查员）
// 卡面：[reaction] 你治愈调查员或[[盟友]]支援的恐惧后：发现你所在地点 1 个线索（每轮仅限一次）。
// [elder_sign]：+1，可治愈你所在地点一位调查员或一个[[盟友]]支援的 1 点恐惧。
// 读点：reaction trigger horrorHealed（harm-threat.js#healHorrorFrom 唯一读点，context.cardSeat=治疗方）；
// elderSign 走 elderSignDescriptor；治疗走 api.healHorror / api.healAsset。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60251'

const allyTrait = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'ally')

const healTargets = (inv, api) => {
  const out = []
  for (const owner of api.investigatorsAt(inv.location)) {
    if ((owner.horror || 0) > 0) {
      out.push({ id: 'i:' + owner.seat, label: owner.name + '（' + owner.horror + ' 恐惧）', seat: owner.seat })
    }
    for (const asset of owner.assets || []) {
      if ((asset.horror || 0) <= 0 || !allyTrait(api.cardTraits(asset.code))) continue
      out.push({ id: 'a:' + asset.id, label: api.cardName(asset.code) + '（' + asset.horror + ' 恐惧）',
        assetId: asset.id, seat: owner.seat })
    }
  }
  return out
}

export default {
  code: CODE,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '60251-eldersign',
    label: '旧印：+1，可治愈 1 点恐惧',
    resolve: ({ inv, api }) => {
      const targets = healTargets(inv, api)
      if (!targets.length) return { delta: 1 }
      const answer = api.choice({
        kind: 'target', source: 'carolyn2ElderSign', seat: inv.seat, canSkip: true,
        prompt: '旧印：是否治愈你所在地点一位调查员或一个盟友支援的 1 点恐惧？',
        options: [{ id: 'skip', label: '不治愈' }, ...targets],
      })
      if (answer === 'skip') return { delta: 1 }
      const target = targets.find(item => item.id === answer)
      if (!target) return { delta: 1 }
      if (target.assetId) {
        const owner = api.investigatorsAt(inv.location).find(item => item.seat === target.seat)
        const asset = (owner?.assets || []).find(item => item.id === target.assetId)
        if (asset) api.healAsset(asset, { horror: 1, owner })
      } else {
        api.healHorror(target.seat, 1)
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'horrorHealed',
    label: '治愈恐惧后：发现你所在地点的 1 个线索（每轮一次）',
    limit: { scope: 'perRound', owner: 'player' },
    criteria: [({ inv, context }) => context?.cardSeat === inv.seat && Number(context?.amount) > 0],
    resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1, inv.location),
  }],
  modifiers: [],
}
