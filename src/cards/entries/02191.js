// 02191 鲜血盟约
// 卡面：永久。
// 卡面：[free]在鲜血盟约上增加1个毁灭标记：你本次技能检定得到+3[willpower]。(每次检定仅限一次。)
// 卡面：[free]在鲜血盟约上增加1个毁灭标记：你本次技能检定得到+3[combat]。(每次检定仅限一次。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02191 苦修：意志 / 战斗 +3（放置 1 毁灭）。

export default {
  code: '02191',
  freeTriggers: [
    { skill: 'willpower', cost: { doom: 1 }, bonus: 3 },
    { skill: 'combat', cost: { doom: 1 }, bonus: 3 },
  ],
  abilities: [

  ],
  modifiers: [

  ],
}
