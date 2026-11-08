// 08083 医学生
// 卡面：[reaction]在医学生入场后：治愈你所在地点的一位调查员或一个[[盟友]]支援1点伤害和1点恐惧。
//
// 读点：能力层 entersPlay 描述子（actions.js#doPlay 的入场唯一读点），地点内调查员候选 +
// 支援候选：
//   · 调查员：api.healDamage / api.healHorror；
//   · 盟友：api.healAsset(card, { damage, horror }) —— 第二参必须是规格对象（src/engine/api-misc.js:759
//     的签名 `(card, spec = {})` 读 spec.damage/spec.horror），不是数字；恐惧侧内部走 healHorrorFrom
//     并遵守 0 下限（不会把支援恐惧治成负数）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08083',
  abilities: [
    { kind: 'entersPlay', label: '入场：治愈同地点一位调查员或一个盟友支援 1 伤害与 1 恐惧',
      resolve: ({ inv, source, state, api }) => {
        if (!source) return
        const candidates = []
        for (const other of state.investigators) {
          if (other.defeated || other.resigned || other.location !== inv.location) continue
          candidates.push({ id: `inv:${other.seat}`, label: `${other.name}（调查员）` })
          for (const ally of other.assets) {
            if (api.cardTraits(ally.code).some(trait => String(trait).toLowerCase() === 'ally')) {
              candidates.push({ id: `asset:${ally.id}`, label: api.cardName(ally.code) })
            }
          }
        }
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'effect', source: '08083', seat: inv.seat,
          prompt: '选择要治愈 1 点伤害和 1 点恐惧的调查员或盟友支援。',
          options: candidates,
        })
        if (String(chosen).startsWith('inv:')) {
          const seat = Number(String(chosen).slice(4))
          api.healDamage(seat, 1)
          api.healHorror(seat, 1)
        } else if (String(chosen).startsWith('asset:')) {
          const id = String(chosen).slice(6)
          const target = state.investigators.flatMap(owner => owner.assets).find(asset => asset.id === id)
          if (target) api.healAsset(target, { damage: 1, horror: 1 })
        }
      } },
  ],
  modifiers: [],
}
