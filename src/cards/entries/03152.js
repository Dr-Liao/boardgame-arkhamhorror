// 03152 偷袭
// 卡面：对你所在地点的一个未与你交战的敌人造成2点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ---- 卡可萨：游荡者/幸存者 ----
// 03152 偷袭：对同地点 1 个未与你交战的敌人造成 2 点伤害（旧原语 carcosaPlayer.sneakAttack2）。

export default {
  code: '03152',
  abilities: [
    {
      kind: 'played', label: '对未与你交战的敌人造成 2 点伤害',
      resolve: ({ state, inv, api }) => {
        const candidates = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== inv.seat)
        if (!candidates.length) return
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03152', seat: inv.seat, prompt: '选择要偷袭的敌人。',
            options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })) })
        const target = candidates.find(enemy => enemy.id === chosen) || candidates[0]
        api.damageEnemy(target, 2, inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
