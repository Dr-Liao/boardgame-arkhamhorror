// 10137 银蛾（The Silver Moth）· 中立支援 · 基础弱点 · 饰品 · [[道具]]/[[遗物]]
// 卡面：
//   显现 - 你必须将银蛾放置入场，放到你的威胁区域，或者受到 1 点恐惧并将银蛾混洗入你的牌库。
//   除非通过以下[action][action]能力，否则它不能离场。
//   你得到 -1 神智值。
//   [action][action]：弃掉银蛾。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · weakness 描述子的 resolve 接管显现结算（src/engine/weakness.js）；api.choice 二选一。
//   · 威胁区 = api.scenario.threat；弱点数据 `weakness.type:'threat'` 决定抽牌收尾不进弃牌堆。
//   · 「受到 1 点恐惧并将它混洗入你的牌库」= api.harm({ horror: 1 })（B2 恐惧入口）
//     + api.scheduleWeaknessShuffle（抽牌段读 inv.shuffleWeaknessAfterResolution）。
//   · 「你得到 -1 神智值」= 条目级 threatEffect.sanityModifier（stats.js#getMaxSanity 对
//     inv.threat 逐卡求和的唯一读点，与 07106「印斯茅斯面容」/ 01182 同一通道）。
//   · 「[action][action]：弃掉」= kind:'action' + cost:{action:2} + api.removeThreat。
//
// approximation（缺读点见 artifacts/migration/fhv/primitive-requests/10135.json，
// 与 10135/10136 同一模板，四条基础弱点共用同一句卡文）：
//   ① 「除上述能力外不能离场」没有威胁区读点（只有 threatCannotLeaveWhileCounters 按计数拦截）。
//   ② 1 点恐惧走普通恐惧分配（可被支援承接），不是直接恐惧。
const CODE = '10137'
const CARD_NAME = '银蛾'

export default {
  code: CODE,
  name: 'The Silver Moth',
  threatEffect: { sanityModifier: -1 },
  simplified: true,
  note: 'approximation: ①「除上述[action][action]能力外不能离场」没有威胁区读点（引擎只有 threatCannotLeaveWhileCounters 按计数拦截）；②1 点恐惧按普通恐惧分配（可被支援承接），与 10135 同一模板，见 primitive-requests/10135.json。',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区，或受到 1 点恐惧并洗回牌库',
      weakness: { type: 'threat' },
      resolve: ({ inv, api }) => {
        const choice = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「${CARD_NAME}」：你必须选择一项。`,
          options: [
            { id: 'threat', label: `将「${CARD_NAME}」放置入场，放到你的威胁区域` },
            { id: 'shuffle', label: `受到 1 点恐惧并将「${CARD_NAME}」混洗入你的牌库` },
          ],
        })
        if (choice === 'threat') {
          api.scenario.threat(inv.seat, CODE)
          api.info(`⚠️ 「${CARD_NAME}」进入 ${inv.name} 的威胁区域：你得到 -1 神智值。`)
          return
        }
        api.harm(inv.seat, { horror: 1 })
        api.scheduleWeaknessShuffle(inv.seat, CODE)
        api.info(`⚠️ 「${CARD_NAME}」：${inv.name} 受到 1 点恐惧，卡牌混洗回牌库。`)
      },
    },
    {
      kind: 'action',
      label: `花费 2 行动：弃掉${CARD_NAME}`,
      cost: { action: 2 },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        api.removeThreat(source)
        api.info(`🩹 ${inv.name} 花费 2 行动弃掉「${CARD_NAME}」。`)
      },
    },
  ],
  modifiers: [],
}
