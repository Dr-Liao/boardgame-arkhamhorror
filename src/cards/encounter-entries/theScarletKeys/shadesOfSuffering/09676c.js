// 09676c 被杀害的工头（Slain Foreman · 剧情面 Familial Pain）· 敌人 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。同一张物理卡的另一面是剧情卡 09676d。
// 卡面：
//   被杀害的工头得到 +1[per_investigator]生命值。
//   [action] 弃掉一个你控制的支援：谈判。检定[智力](6)。降低本次检定的难度，降低的数量为
//     你作为此行动费用弃掉的支援的印刷费用。如果你检定成功，将本卡牌翻面并结算另一面的文本。
//   强制 - 在被杀害的工头将要被击败时：将其翻面并结算另一面的文本。
//
// 读点：与 09676a 相同（definition `healthPerPlayerBonus: 1`、`enemyRule.geist.parley` 的
// discardAsset 费用、behavior.resolveGeistStory / enemyDefeated）。
export default {
  code: '09676c',
  name: '被杀害的工头',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    geist: {
      story: '09676d',
      fact: 'tradedForAKitten',
      parley: { cost: 'discardAsset', min: 1, max: 1, skill: 'intellect', difficulty: 6 },
    },
  },
  note: 'approximation: 剧情面由章节 behavior 直接结算（见 primitive-requests/extend-enemy-story-face-flip.json）。',
}
