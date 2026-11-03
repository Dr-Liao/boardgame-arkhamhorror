// 06071 急救病房（Emergency Room）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：当你在急救病房时，你的每次技能检定，其难度 +1（每张投入本次检定的卡牌）。
// 读点：章节 behavior 在投入阶段结束后调用 locationRule.difficultyAfterCommit；
//   返回本次检定已经投入的卡牌总数，供检定器在揭示标记前统一加到难度。
export default {
  code: '06071',
  scope: 'location',
  implemented: true,
  locationRule: {
    // 本次检定所有调查员投入的卡牌都计入难度，必须在投入阶段结束后读取。
    difficultyAfterCommit(state, inv, api) {
      return Number(state.skillTest?.committed?.length || 0)
    },
  },
  flags: {
    difficultyPerCommittedCard: 1,
  },
}
