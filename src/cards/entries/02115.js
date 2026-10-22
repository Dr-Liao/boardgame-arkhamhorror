// 02115 照明弹
// 卡面：选择一项：
// 卡面：- 攻击。本次攻击你得到+3[combat]并造成+2伤害。放逐照明弹。
// 卡面：- 查找任意调查员牌库顶9张卡牌，找出一个[[盟友]]支援并将其放置入场，放到你的控制之下。然后，放逐照明弹。混洗查找过的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02115 照明弹：第 122 轮从 player-effects.js 的 `flare` 分派搬进本文件。

export default {
  code: '02115',
  abilities: [
    {
      kind: 'played',
      label: '照明弹',
      exileAfterPlay: true,
      resolve: ({ inv, api }) => {
        const choice = api.choice({
          kind: 'effect', source: '02115', seat: inv.seat, prompt: '选择照明弹的效果。',
          options: [{ id: 'fight', label: '战斗 +3，伤害 +2' }, { id: 'ally', label: '搜索任意调查员牌库顶 9 张并使一名盟友入场' }],
        })
        if (choice === 'fight') {
          const enemy = api.chooseEnemy(inv.seat, {})
          if (!enemy) return
          api.fight(inv.seat, enemy.id, { combatBonus: 3, damageBonus: 2, noSpend: true })
          return
        }
        api.searchDeckIntoPlay(inv.seat, {
          amount: 9, trait: 'ally', source: '02115',
          ownerPrompt: '选择要搜索的牌库。',
          prompt: '选择要放置入场的盟友支援。',
        })
      },
    },
  ],
  modifiers: [

  ],
}
