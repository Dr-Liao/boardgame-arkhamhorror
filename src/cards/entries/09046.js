// 09046 诡异诊断（Bizarre Diagnosis）· 探求者事件 · 0 费。
// 卡面：将你的 1 个线索放到你所在地点。然后，治愈你所在地点一位调查员或一个[[盟友]]支援的 3 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 放线索 = api.spendClueToLocation（个人线索 -1、地点 +1 的唯一入口），没有线索时不放；
//   · 治疗目标 = 同地点调查员 + 同地点[[盟友]]支援，逐项询问；
//     调查员用 api.healDamage，盟友用 api.healAsset({ damage: 3 })。
export default {
  code: '09046',
  abilities: [
    {
      kind: 'played',
      label: '把你的 1 个线索放到所在地点，然后治愈一位调查员或一个[[盟友]]支援 3 点伤害',
      resolve: ({ state, inv, api }) => {
        if ((inv.clues || 0) > 0) {
          api.spendClueToLocation(inv.seat, 1)
          api.info(`诡异诊断：把 1 个线索放到「${api.locName(inv.location)}」。`)
        }
        const targets = []
        for (const other of api.investigatorsAt(inv.location)) {
          if (other.seat === inv.seat) targets.push({ id: `self`, label: `${other.name}（自己）`, kind: 'investigator', seat: other.seat })
          else targets.push({ id: `seat:${other.seat}`, label: other.name, kind: 'investigator', seat: other.seat })
          for (const card of other.assets || []) {
            const ally = (api.cardTraits(card.code) || []).some(trait => String(trait).toLowerCase() === 'ally')
            if (ally) targets.push({ id: `asset:${card.id}`, label: `${api.cardName(card.code)}（盟友）`, kind: 'asset', asset: card })
          }
        }
        if (!targets.length) return
        const chosen = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'effect', source: '09046', seat: inv.seat,
          prompt: '诡异诊断：选择治愈的对象。',
          options: targets.map(item => ({ id: item.id, label: item.label })),
        })
        const target = targets.find(item => item.id === chosen) || targets[0]
        if (target.kind === 'asset') {
          api.healAsset(target.asset, { damage: 3 })
          api.info(`诡异诊断：治愈「${api.cardName(target.asset.code)}」3 点伤害。`)
        } else {
          const healed = api.healDamage(target.seat, 3, { log: true })
          api.info(`诡异诊断：治愈 ${state.investigators[target.seat]?.name || '调查员'} ${healed} 点伤害。`)
        }
      },
    },
  ],
  modifiers: [],
}
