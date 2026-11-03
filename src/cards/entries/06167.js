// 06167 多才多艺
// 卡面：永久。你的牌库卡牌张数+5。
// 卡面：你调查员的牌库构建选项获得：“1张任意职阶([guardian]、[seeker]、[rogue]、[mystic]或[survivor])的其它等级0卡牌。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 纯数据卡：卡面效果全部属于构筑层（牌库张数与牌库构建选项），对局内没有行为。
// 数据事实源：cards-data 的 permanent:true / type:'asset' / cost:null / klass:'neutral'；
// 开局把永久卡自动放入场的读点在 setup.js（按卡面 permanent 判断），本条目不需要对局钩子。
// 构筑层的 +5 牌库张数与「任意职阶 1 张等级 0 卡」由 deckConstruction 声明。

export default {
  code: '06167',
  deckConstruction: {
    sizeBonus: 5,
    options: [{ factions: ['guardian', 'seeker', 'rogue', 'mystic', 'survivor'], level: { min: 0, max: 0 }, limit: 1 }],
  },
  abilities: [],
  modifiers: [],
}
