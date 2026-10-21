// 03263 追猎行动
// 卡面：快速。在神话阶段期间你将要抽取一张遭遇卡牌时打出。
// 卡面：改为查找遭遇牌库顶9张卡牌，找出一个敌人，生成并与你交战（而非其通常的生成地点），并混洗遭遇牌库。如果你不能这么做，抽取遭遇牌库顶1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03263 追猎：刚抽到遭遇卡时快速打出——从遭遇牌库顶 9 张里选一名敌人，在所在地点生成并交战。
// 没有敌人候选时按旧实现回落成「正常抽一张遭遇卡」。

export default {
  code: '03263',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { ownMythosOnly: true },
      label: '从遭遇牌库顶 9 张里找一名敌人生成并交战',
      resolve: ({ inv, api }) => {
        const candidates = api.encounterEnemies(9)
        if (!candidates.length) { api.drawEncounter(inv.seat); return }
        const chosen = candidates.length === 1 ? candidates[0] : api.choice({ kind: 'enemy', source: '03263',
          seat: inv.seat, prompt: '从遭遇牌库顶 9 张中选择 1 名敌人生成。',
          options: candidates.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) })) })
        const picked = candidates[Number(chosen)] || candidates[0]
        api.spawnEncounterEnemy(inv.seat, picked)
      },
    },
  ],
  modifiers: [

  ],
}
