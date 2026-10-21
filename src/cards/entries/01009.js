// 01009 死灵之书
// 卡面：显现 - 将死灵之书放置入场，放到你的威胁区域，带有3点恐惧。死灵之书上有恐惧时不能离场。
// 卡面：将你揭示的每个混乱标记上的[elder_sign]视为[auto_fail]。
// 卡面：[action]：将死灵之书的1点恐惧移动到黛西·沃克上。然后，如果死灵之书没有恐惧，将其弃掉。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01009',
  abilities: [
    {
      kind: 'weakness',
      label: '死灵之书',
      weakness: { type: 'threat', horror: 3, eldersignToAutofail: true, purgeAbility: true },
    },
  ],
  modifiers: [

  ],
}
