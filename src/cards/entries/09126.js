// 09126 该付账了（Pay Your Due）· 基础弱点 · 事件
// 卡面：[rogue] 调查员专用。
//       作为打出该付账了的额外费用，你可以花费任意数量的额外行动。每花费一个额外行动，降低其费用 5 点。
//       强制 - 如果当你的回合结束时，该付账了在你手中：将其揭示并受到 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 抽到后留在手中：条目级 weaknessStaysInHand（deck-ops.js 弱点结算分支的唯一读点）；
//   · 回合结束时若仍在手牌：条目级 endTurnInHandDamage（turn-flow.js#advanceInvestigator 扫描手牌的读点，
//     与 09125 的 endTurnInHandHorror 同族）；
//   · 减费：条目级 playCostModifier（turn-flow.js#playCost 的真实读点），按「回合内剩余行动 - 1」
//     每点 -5、最多 -10（10 费）；
//   · 花费额外行动：played 描述子 resolve 里 api.loseActions（打出后行动数 = 原行动数 - 1，
//     与减费档位一一对应）。
// approximation: 「花费任意数量额外行动」简化为「用满可用档位」（最多 2 个额外行动），
//   不接受「少花行动、多付资源」的选择；额外费用在打出后扣除。
const code = '09126'

const extraActions = inv => Math.min(2, Math.max(0, (inv.actionsLeft || 0) - 1))

export default {
  code,
  playableWeakness: true,
  weaknessStaysInHand: true,
  endTurnInHandDamage: 1,
  weaknessHandNote: '留在手中；可在回合结束前打出，否则回合结束时揭示并受到 1 点伤害。',
  note: 'approximation: 额外行动费用只提供「用满档位」（最多 2 个额外行动）并在打出后扣除。',
  playCostModifier: ({ inv }) => -5 * extraActions(inv),
  abilities: [
    {
      kind: 'played',
      label: '花费额外行动降低费用后打出，弃掉该付账了',
      resolve: ({ inv, api }) => {
        const spent = Math.min(2, Math.max(0, inv.actionsLeft || 0))
        if (spent) api.loseActions(inv.seat, spent)
        api.info(`💸 「该付账了」：${inv.name} 打出该付账了（额外花费 ${spent} 个行动）。`)
      },
    },
  ],
  modifiers: [],
}
