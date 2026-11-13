// 09674a 诡怪的阴影（Uncanny Shadow · 剧情面 Playful Shadows）· 敌人 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。同一张物理卡的另一面是剧情卡 09674b；
// Setup 时三对灵怪各随机留一张（另一张移出游戏），所以本张可能在放一边区、也可能直接被移出游戏。
// 卡面：
//   诡怪的阴影得到 +1[per_investigator]生命值。
//   [action] 从你手中随机弃掉 1-3 张卡牌：谈判。检定[意志](6)。你作为此行动的费用每弃掉一张卡牌，
//     本次检定的难度降低 1 点。如果你检定成功，将本卡牌翻面并结算另一面的文本。
//   强制 - 在诡怪的阴影将要被击败时：将其翻面并结算另一面的文本。
//
// 读点（全部在章节 behavior，条目只声明数据）：
//   · 「+1[per_investigator] 生命值」→ definition 的 `healthPerPlayerBonus: 1`（enemies.js#spawnEnemy 读点）；
//   · 谈判 → behavior.actions 的 `parley:<enemyId>` 行动读 `enemyRule.geist.parley`（费用/技能/难度）；
//   · 剧情面与解锁事实 → `enemyRule.geist.story/fact`，翻面结算见 behavior.resolveGeistStory；
//   · 「将要被击败」→ behavior.enemyDefeated 的灵怪替换分支（密谋 3「畏惧收割者」期间不能被翻面）。
export default {
  code: '09674a',
  name: '诡怪的阴影',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    geist: {
      story: '09674b',
      fact: 'embarrassedTheConsulate',
      parley: { cost: 'discardRandomCards', min: 1, max: 3, skill: 'willpower', difficulty: 6 },
    },
  },
  note: 'approximation: 剧情面「翻面并结算」由章节 behavior 直接结算（敌人离场 + 剧情卡进胜利区，或原地治愈/'
    + '解除交战/横置），没有跨类型物理翻面；见 primitive-requests/extend-enemy-story-face-flip.json。',
}
