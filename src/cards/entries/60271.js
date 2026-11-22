// 60271 镇定自若（Unflappable，1 级）
// 卡面：躲避([agility])。本次躲避 +3[agility]。若检定成功，在你控制的卡牌中治愈总计 2 点恐惧。
// 读点：played countsAs evade + api.evade({skillBonus}) + api.healHorror / api.healAsset。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60271'

const allyTrait = traits => (traits || []).some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code: CODE,
  abilities: [{
    kind: 'played',
    countsAs: 'evade',
    label: '躲避：敏捷 +3；成功在你控制的卡牌中治愈共 2 点恐惧',
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => enemy.engagedSeat === inv.seat
        || (enemy.location === inv.location && !enemy.massive))
      if (!enemies.length) return
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(item => item.id === id)
      if (!enemy) return
      api.evade(inv.seat, {
        enemyId: enemy.id, skill: 'agility', skillBonus: 3, sourceCode: CODE,
        onSuccess: () => {
          let remaining = 2
          if ((inv.horror || 0) > 0) remaining -= Math.min(remaining, inv.horror)
          while (remaining > 0) {
            const ally = (inv.assets || []).find(asset => (asset.horror || 0) > 0
              && allyTrait(api.cardTraits(asset.code)))
            if (!ally) break
            api.healAsset(ally, { horror: 1, owner: inv })
            remaining -= 1
          }
          if (remaining > 0) api.healHorror(inv.seat, remaining)
          void state
        },
      })
    },
  }],
  modifiers: [],
}
