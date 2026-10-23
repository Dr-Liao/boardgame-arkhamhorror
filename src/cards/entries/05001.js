// 05001 卡洛琳·弗恩
// 卡面：[reaction]在你的卡牌效果治愈调查员或[[盟友]]支援的恐惧后：被治愈卡牌的控制者获得1资源。
// 卡面：[elder_sign]效果：+1，你可以治愈你所在地点的一位调查员或一个[[盟友]]支援的1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 反应挂在引擎的 horrorHealed 窗口上（src/engine/harm-threat.js 的 healHorrorFrom 是治疗恐惧的
// 唯一入口）：条件里的 cardSeat 就是「这是你的卡牌效果」，别人治好的恐惧不给你资源。

import { entryFlag, investigatorSign } from './_shared.js'

const sign = investigatorSign('05001')

const allyTrait = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'ally')

const healTargets = (inv, api) => {
  const out = []
  for (const owner of api.investigatorsAt(inv.location)) {
    if ((owner.horror || 0) > 0) {
      out.push({ id: `i:${owner.seat}`, label: `${owner.name}（${owner.horror} 恐惧）`, seat: owner.seat })
    }
    for (const asset of owner.assets || []) {
      if ((asset.horror || 0) <= 0 || !allyTrait(api.cardTraits(asset.code))) continue
      out.push({ id: `a:${asset.id}`, label: `${api.cardName(asset.code)}（${asset.horror} 恐惧）`,
        assetId: asset.id, seat: owner.seat })
    }
  }
  return out
}

export default {
  code: '05001',
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 1 },
  },
  elderSign: {
    id: '05001-eldersign',
    label: '旧印：+1，可治愈 1 点恐惧',
    resolve: ({ inv, api }) => {
      const bonus = Number(sign.bonus ?? 1)
      const targets = healTargets(inv, api)
      if (!targets.length) return { delta: bonus }
      const answer = api.choice({
        kind: 'target', source: 'carolynElderSign', seat: inv.seat, canSkip: true,
        prompt: '旧印：是否治愈你所在地点的一位调查员或一个盟友支援的 1 点恐惧？',
        options: [{ id: 'skip', label: '不治愈' }, ...targets],
      })
      if (answer === 'skip') return { delta: bonus }
      const target = targets.find(item => item.id === answer)
      if (!target) return { delta: bonus }
      if (target.assetId) {
        const owner = api.investigatorsAt(inv.location).find(item => item.seat === target.seat)
        const asset = (owner?.assets || []).find(item => item.id === target.assetId)
        if (asset) api.healAsset(asset, { horror: 1, owner })
      } else {
        api.healHorror(target.seat, 1)
      }
      return { delta: bonus }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'horrorHealed',
      id: 'carolynHealReward',
      label: '治愈恐惧后：被治愈卡牌的控制者获得 1 资源',
      // 一次治疗只结算一次（否则窗口会重复提供同一个反应）。
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [({ inv, context }) => context?.cardSeat === inv.seat && Number.isInteger(context?.healedSeat)],
      resolve: ({ inv, context, api, state }) => {
        // 05008「理性思考」在场时不能从这条能力获得资源。
        if ((inv.threat || []).some(card => entryFlag(card.code, 'blocksHealReward'))) return
        const healed = state.investigators[context.healedSeat]
        api.gainResources(context.healedSeat, 1)
        api.info(`${healed?.name || inv.name} 因卡洛琳的治疗获得 1 资源。`)
      },
    },
  ],
  modifiers: [],
}
