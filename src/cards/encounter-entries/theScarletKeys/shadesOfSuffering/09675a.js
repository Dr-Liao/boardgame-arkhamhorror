// 09675a 被掩埋的矿工（Buried Miner · 剧情面 A Lost Memento）· 敌人 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。同一张物理卡的另一面是剧情卡 09675b。
// 卡面：
//   被掩埋的矿工得到 +1[per_investigator]生命值。
//   [action] 受到 1-3 点恐惧：谈判。检定[战斗](6)。你作为此行动的费用每受到 1 点恐惧，
//     本次检定的难度降低 1 点。如果你检定成功，将本卡牌翻面并结算另一面的文本。
//   强制 - 在被掩埋的矿工将要被击败时：将其翻面并结算另一面的文本。
//
// 读点（章节 behavior，条目只声明数据）：
//   · 「+1[per_investigator] 生命值」→ definition 的 `healthPerPlayerBonus: 1`；
//   · 谈判费用「受到 1-3 点恐惧」→ `enemyRule.geist.parley.cost: 'takeHorror'`（behavior.resolveGeistParley
//     用 api.directHorror 支付，并按支付量降低难度）；
//   · 剧情面/解锁事实 → behavior.resolveGeistStory + enemyDefeated。
export default {
  code: '09675a',
  name: '被掩埋的矿工',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    geist: {
      story: '09675b',
      fact: 'foundACheapMemento',
      parley: { cost: 'takeHorror', min: 1, max: 3, skill: 'combat', difficulty: 6 },
    },
  },
  note: 'approximation: 剧情面由章节 behavior 直接结算（见 primitive-requests/extend-enemy-story-face-flip.json）。',
}
