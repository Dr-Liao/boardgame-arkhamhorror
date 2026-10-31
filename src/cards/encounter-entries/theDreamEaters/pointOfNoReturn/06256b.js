// 06256b · 《无归之地》背面故事「另一条路」（Another Path）。
// 卡面：Put the set-aside Enchanted Woods (Stone Trapdoor) into play, revealed.
//   Record in your Campaign Log the investigators found a way out of the Underworld.
//   Flip this card back over.
//
// 翻面故事（卡斯之塔 06256 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06256b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'anotherPath',
    storyOf: '06256',
    // 放一边的魔幻森林（石板暗门）在 definition 里的地点 id 与战役记录键。
    placeLocationId: 'enchantedWoods',
    campaignRecord: 'theInvestigatorsFoundAWayOutOfTheUnderworld',
  },
  note: '把放一边的「魔幻森林（石板暗门）」（06053）已揭示放人场，并写战役记录。',
}
