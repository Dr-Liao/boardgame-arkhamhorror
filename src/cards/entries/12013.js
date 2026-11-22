// 12013 伊莎贝拉·巴恩斯（Isabelle Barnes）· 生存者 · 归来者（2026 核心盒）。
//
// 卡面：
//   [fast] 你执行的技能检定期间，受到 1 点直接恐惧：将你弃牌堆中的一张符合条件的技能投入本次检定。
//     本次检定结算后，将该卡牌混洗入你的牌库。（每轮仅限一次）
//   [elder_sign] 效果：+1。如果你检定成功，治愈 1 点恐惧。
//
// 引擎读点：
//   · [fast] 检定期间的免费能力：玩家窗口 `test.beforeCommit` / `test.afterCommit`
//     （tests.js 每次检定都会开这两个窗口）内的 `free` 描述子 + duringOwnSkillTest；限次 perRound；
//     直接恐惧走 api.directHorror（不可分配），投入弃牌堆技能走
//     api.commitOrigins.commit({ from: 'discard' })，投入后去向由 commit 目的地读出。
//   · 投入去向：api.setCommitDestination(item, 'shuffleIntoDeck')（结算后洗入牌库的唯一读点）。
//   · 旧印：`{ delta: 1, onSuccess: { type: 'heal', what: 'horror', amount: 1 } }`。

const code = '12013'

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '12013-eldersign',
    label: '旧印：+1。若检定成功，治愈 1 点恐惧',
    resolve: () => ({
      delta: 1,
      onSuccess: { type: 'heal', what: 'horror', amount: 1 },
    }),
  },
  abilities: [{
    kind: 'free',
    trigger: ['test.beforeCommit', 'test.afterCommit'],
    duringOwnSkillTest: true,
    limit: 'oncePerRound',
    label: '受到 1 点直接恐惧：从弃牌堆投入一张技能牌，结算后混洗入牌库',
    resolve: ({ inv, api }) => {
      const candidates = [...new Set(inv.discard || [])]
        .filter(skillCode => api.canCommitCard(inv.seat, skillCode, { from: 'discard' }))
      if (!candidates.length) return
      const picked = candidates.length === 1 ? candidates[0] : api.choice({
        kind: 'card', source: code, seat: inv.seat,
        prompt: '选择要从弃牌堆投入本次检定的技能牌。',
        options: candidates.map(skillCode => ({ id: skillCode, cardCode: skillCode, label: api.cardName(skillCode) })),
      })
      if (!picked || !candidates.includes(picked)) return
      api.directHorror(inv.seat, 1)
      if (inv.defeated) return
      const committed = api.commitOrigins.commit(inv.seat, { from: 'discard', code: picked })
      if (!committed) return
      api.setCommitDestination(committed, 'shuffleIntoDeck')
    },
  }],
  modifiers: [],
}
