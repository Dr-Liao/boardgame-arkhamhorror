// 05042 高塔·XVI
// 卡面：高塔·XVI在你手牌中时，你不能在技能检定投入卡牌。
// 卡面：如果冒险设置期间你抽取了高塔·XVI作为你起始手牌(不论在重调之前还是之后)，你不能将其替换。其必须留在你的起始手牌中。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：基础弱点 + 塔罗槽双身份。三条条目级布尔读点是 P2.9 原语：
//   - blocksCommitWhileInHand：在手牌里时，本人不能投入任何卡牌（tests.js 的 handCommitBlocker 读点）；
//   - cannotMulliganAway：换起始手牌时不在候选里（table-decisions.js 的 mulliganCandidates 读点）；
//   - weaknessStaysInHand：抽到后留在手牌而不是立刻结算进弃牌堆（deck-ops.js 的抽牌读点）。
// 显式简化（见 note）：开局抽到时「必须留在起始手牌」需要 setup.drawOpeningHand 的条目级读点，
// 现有引擎在起手抽牌阶段把所有基础弱点洗回牌库；本批先让它在任意抽牌通道留在手牌并封锁投入。

export default {
  code: '05042',
  blocksCommitWhileInHand: true,
  cannotMulliganAway: true,
  weaknessStaysInHand: true,
  weaknessHandNote: '「高塔·XVI」留在手中：你不能在技能检定投入卡牌。',
  simplified: true,
  note: '未实现：开局抽取后「必须留在起始手牌」——setup 的起手抽牌把基础弱点洗回牌库，没有条目级读点；'
    + '当前实现让它在抽到后留在手牌（weaknessStaysInHand），手牌封锁与换牌保护（blocksCommitWhileInHand / cannotMulliganAway）已接线。',
  abilities: [
    // 兜底：若通过弱点结算通道直接揭示（例如剧本效果），卡面没有显现效果，只记录日志。
    {
      kind: 'weakness', label: '高塔·XVI', weakness: { type: 'theTower' },
      resolve: ({ inv, api }) => {
        api.info(`「高塔·XVI」：${inv.name} 揭示了这张塔罗基础弱点（没有显现效果）。`)
      },
    },
  ],
  modifiers: [],
}
