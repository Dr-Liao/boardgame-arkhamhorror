// 10687 最后一个黎明 · 幕 1 · 共享遭遇组 day_of_the_feast
// 归属：战役共用 · theFeastOfHemlockVale/_shared/day_of_the_feast。
// 卡面（cards-data 10687）：
//   目标 - 跟当地人聊聊，享受盛宴。
//   背面「The Bliss（极乐）」：翻面时读一段正文；你必须承受 1 点精神创伤，或查找收藏随机找出一张基础
//   [[疯狂]]弱点加入牌库（不计入牌库张数）。你取得 2 点奖励经验值。
//
// 读点（数据型条目，规则在章节层）：幕目标不是线索阈值（章节 objective 声明 chapterRule）；背面「创伤或
//   随机基础疯狂弱点 + 2 点奖励经验」由 dawnOfTheFinalDay 的 behavior.actReveal 用 api.addBasicWeakness /
//   api.addTrauma 结算（剧本正文来自 story-text.js）。
export default {
  code: '10687',
  scope: 'act',
  implemented: true,
  flags: {
    stage: 1,
    objective: { type: 'talkToLocals' },
    back: {
      name: 'The Bliss',
      mentalTraumaOrBasicMadnessWeakness: { trauma: 'mental', weaknessTraits: ['madness'] },
      bonusXp: 2,
      readsStory: true,
    },
  },
  note: '数据型幕条目：目标与背面（1 精神创伤或随机基础[[疯狂]]弱点 + 2 奖励经验）在 dawnOfTheFinalDay 的 behavior.actReveal。',
  abilities: [],
}
