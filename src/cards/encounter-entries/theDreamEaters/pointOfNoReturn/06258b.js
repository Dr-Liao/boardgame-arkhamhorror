// 06258b · 《无归之地》背面故事「探查山谷」（Scouting the Vale）。
// 卡面：Look at the top 2 [per_investigator] cards of the encounter deck. You may discard up to half of
//   those cards. Return the rest to the top of the encounter deck, in any order.
//   For the remainder of the game, ignore the text on Crag of the Ghouls. Flip this card back over.
//
// 翻面故事（食尸鬼峭壁 06258 的背面）：规则由 behavior.js 的 storyResolve 按 flags.storyRule 分派。

export default {
  code: '06258b',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    storyRule: 'scoutingTheVale',
    storyOf: '06258',
    lookCountPerInvestigator: 2,
    discardUpToHalf: true,
    ignoreLocationText: 'cragOfTheGhouls',
  },
  note: '「查看并任意顺序放回」没有独立的 peek/排序原语：按「弃掉至多一半遭遇牌库顶」近似，记 simplified。',
}
