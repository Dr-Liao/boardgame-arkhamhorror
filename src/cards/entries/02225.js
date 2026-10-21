// 02225 “如果它会流血……”
// 卡面：快速。在你击败一个[[怪物]]敌人后打出。
// 卡面：你所在地点的每位调查员治愈等于该敌人恐惧值的恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02225 “如果它会流血……”

export default {
  code: '02225',
  abilities: [
    {
      "kind": "played",
      "fast": true,
      "trigger": "defeatEnemy",
      "label": "“如果它会流血……”",
      "resolve": ({ inv, api }) => {
        const reaction = api.reactionContext()
        const enemy = reaction?.enemy || reaction?.context?.enemy
        if (!enemy || !(enemy.traits || []).some(trait => String(trait).toLowerCase() === 'monster')) return
        for (const target of api.investigatorsAt(inv.location)) api.healHorror(target.seat, enemy.horror || 0)
      }
    },
  ],
  modifiers: [

  ],
}
