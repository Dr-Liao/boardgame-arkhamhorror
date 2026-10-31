// 06027 仰望星空
// 卡面：每场游戏最多两次。
//       遭遇牌库中有至少10张卡牌时才能打出本卡牌。
//       查找你的绑定卡牌，找出1张群星正确之时，将其混洗入遭遇牌库顶的10张卡牌中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06027 仰望星空：
//   · 「每场游戏最多两次」→ limit { scope:'perGame', owner:'player', count:2 }。
//   · 打出条件 → playCondition（遭遇牌库 ≥10 张）。
//   · 绑定查找 + 洗入遭遇牌库：直接把 06028 洗入遭遇牌库（api.shuffleIntoEncounterDeck）。
//     显式简化：引擎没有「混洗入遭遇牌库顶 N 张」的插入点，只洗入整副遭遇牌库；
//     06028 作为遭遇卡抽出后的显现结算依赖 06028 的原语（见 primitive-requests/w-m2-1-06028-*）。

export default {
  code: '06027',
  simplified: true,
  note: '未实现：遭遇牌库没有「混洗入顶部 N 张」的插入点（api.shuffleIntoEncounterDeck 只能洗入整副遭遇牌库），改为洗入遭遇牌库。',
  playCondition: [
    {
      when: ({ state }) => (state.encounterDeck || []).length >= 10,
      message: '遭遇牌库少于 10 张，不能打出「仰望星空」',
    },
  ],
  abilities: [
    {
      kind: 'played',
      label: '查找群星正确之时并混洗入遭遇牌库',
      limit: { scope: 'perGame', owner: 'player', count: 2 },
      resolve: ({ inv, api }) => {
        api.shuffleIntoEncounterDeck('06028')
        api.info(`「仰望星空」：${inv.name} 将「群星正确之时」混洗入遭遇牌库。`)
      },
    },
  ],
  modifiers: [],
}
