// 05314 舒缓旋律
// 卡面：绑定(圣化之镜)。
// 卡面：治愈你所在地点的调查员和/或[[盟友]]支援的2点伤害或2点恐惧(或者以任意方式组合，总计2点)。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05314 舒缓旋律：2 点治疗点逐点选择（调查员/盟友支援的伤害或恐惧），然后抽 1 张。
// 治疗恐惧走引擎统一入口 healHorror（治疗支援时带 owner）；盟友支援用 api.healAsset。

function healCandidates(state, inv) {
  const out = []
  for (const owner of state.investigators) {
    if (owner.defeated || owner.resigned || owner.location !== inv.location) continue
    if ((owner.damage || 0) > 0) out.push({ id: `dmg:${owner.seat}`, kind: 'damage', seat: owner.seat, label: `${owner.name} 的 1 点伤害` })
    if ((owner.horror || 0) > 0) out.push({ id: `hor:${owner.seat}`, kind: 'horror', seat: owner.seat, label: `${owner.name} 的 1 点恐惧` })
    for (const ally of owner.assets || []) {
      const def = state.cards?.[ally.code]
      const isAlly = (def?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')
      if (!isAlly) continue
      const name = def?.nameZh || def?.name || ally.code
      if ((ally.damage || 0) > 0) out.push({ id: `assetDamage:${ally.id}`, kind: 'assetDamage', asset: ally, owner: owner.seat, label: `${name} 的 1 点伤害` })
      if ((ally.horror || 0) > 0) out.push({ id: `assetHorror:${ally.id}`, kind: 'assetHorror', asset: ally, owner: owner.seat, label: `${name} 的 1 点恐惧` })
    }
  }
  return out
}

export default {
  code: '05314',
  abilities: [
    {
      kind: 'played',
      label: '治愈 2 点伤害/恐惧并抽 1 张',
      resolve: ({ state, inv, api }) => {
        for (let point = 0; point < 2; point++) {
          const candidates = healCandidates(state, inv)
          if (!candidates.length) break
          const answer = candidates.length === 1 ? candidates[0].id : api.choice({
            kind: 'heal', source: '05314', seat: inv.seat, canSkip: true,
            prompt: `「舒缓旋律」：选择第 ${point + 1} 点治疗的对象（伤害或恐惧）。`,
            options: [{ id: 'done', label: '不再治疗' }, ...candidates.map(item => ({ id: item.id, label: item.label }))],
          })
          if (answer === 'done' || answer === undefined) break
          const picked = candidates.find(item => item.id === answer)
          if (!picked) break
          if (picked.kind === 'damage') api.healDamage(picked.seat, 1)
          else if (picked.kind === 'horror') api.healHorror(picked.seat, 1)
          else if (picked.kind === 'assetDamage') api.healAsset(picked.asset, { damage: 1 })
          else if (picked.kind === 'assetHorror') api.healAsset(picked.asset, { horror: 1, owner: state.investigators[picked.owner] })
        }
        api.drawCards(inv.seat, 1)
      },
    },
  ],
  modifiers: [

  ],
}
