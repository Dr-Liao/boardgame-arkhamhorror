// 09110 救生索（Lifeline）· 幸存者事件 · 1 经验
// 卡面：每回合最多 1 张。
//       快速。在一位调查员的回合将要结束时打出。
//       该调查员可以在自己的回合期间进行额外 X 个行动。X 等于其自己回合期间技能检定失败的次数。放逐救生索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 快速（无固定触发时机）：收尾玩家窗口的「⚡ 快速打出」候选（fastHandPlays 会再校验 playCondition）；
//   · 每回合最多 1 张：playCondition 读 campaign.records 的 `lifeline:<round>:<turnSerial>` 记账
//     （泛型记录写点 api.setCampaignRecord，不为本卡新造状态字段）；
//   · 额外行动：api.gainAction；放逐：played 描述子 exileAfterPlay（doPlay / playReactionCard 同一去向读点）。
// approximation: 引擎没有「本回合技能检定失败次数」读点（history 未交付），X 近似按 1 结算；
//   印刷时机「回合将要结束」用「自己回合内快速打出」近似（不能在他人回合结束窗口打出）。
const code = '09110'

const turnKey = state => `lifeline:${state.round}:${state.turnSerial ?? 0}`

export default {
  code,
  note: 'approximation: X（本回合失败检定次数）按 1 结算；印刷时机「回合将要结束」近似为自己回合内的快速打出。',
  playCondition: [
    { when: ({ state, inv }) => state.currentSeat === inv.seat && !inv.turnEnded,
      message: '「救生索」只能在你自己的回合期间打出' },
    { when: ({ state }) => !state.campaign?.records?.[turnKey(state)],
      message: '「救生索」每回合最多打出 1 张' },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      exileAfterPlay: true,
      label: '获得额外 1 个行动（X 近似为 1），然后放逐本卡',
      resolve: ({ state, inv, api }) => {
        api.gainAction(inv.seat, 1)
        api.setCampaignRecord(turnKey(state), true)
        api.info(`🪢 「救生索」：${inv.name} 获得额外 1 个行动（X 以 1 计），救生索被放逐。`)
      },
    },
  ],
  modifiers: [],
}
