// 09674c 诡怪的阴影（Uncanny Shadow · 剧情面 Timorous Shadows）· 敌人 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。同一张物理卡的另一面是剧情卡 09674d。
// 卡面：
//   诡怪的阴影得到 +1[per_investigator]生命值。
//   [action] 从你手中随机弃掉 1-3 张卡牌：谈判。检定[意志](6)。你作为此行动的费用每弃掉一张卡牌，
//     本次检定的难度降低 1 点。如果你检定成功，将本卡牌翻面并结算另一面的文本。
//   强制 - 在诡怪的阴影将要被击败时：将其翻面并结算另一面的文本。
//
// 读点：与 09674a 相同（definition `healthPerPlayerBonus: 1`、behavior 的 `parley:<enemyId>` 行动、
// behavior.resolveGeistStory / enemyDefeated）。
export default {
  code: '09674c',
  name: '诡怪的阴影',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    geist: {
      story: '09674d',
      fact: 'peeredBeyond',
      parley: { cost: 'discardRandomCards', min: 1, max: 3, skill: 'willpower', difficulty: 6 },
    },
  },
  note: 'approximation: 剧情面由章节 behavior 直接结算（见 primitive-requests/extend-enemy-story-face-flip.json）。',
}
