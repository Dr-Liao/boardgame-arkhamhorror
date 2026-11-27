// 10135 手部残疾（Maimed Hand）· 中立支援 · 基础弱点 · 手部 · [[损伤]]
// 卡面：
//   显现 - 你必须将手部残疾放置入场，放到你的威胁区域，或者受到 1 点伤害并将手部残疾混洗入你的牌库。
//   除非通过以下[action][action]能力，否则它不能离场。
//   你得到 -1 生命值。
//   [action][action]：弃掉手部残疾。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「显现」= weakness 描述子的 resolve（src/engine/weakness.js#resolveWeaknessBody 优先走描述子
//     resolve，接管整段揭示结算）。选择用 api.choice；不进入引擎的默认威胁区分支。
//   · 「放到你的威胁区域」= api.scenario.threat(seat, code)（scenario-runtime.js 的唯一写入口：
//     newCardInstance + afterThreatEntered，会触发威胁区入场窗口与生命上限即时判负）。
//     `weakness: { type: 'threat' }` 同时是 isThreatWeakness 的数据来源 —— 决定抽牌收尾时
//     本卡留在威胁区、不进弃牌堆（deck-ops.js）。
//   · 「受到 1 点伤害并将它混洗入你的牌库」= api.harm（B2 伤害入口）+ api.scheduleWeaknessShuffle
//     （抽牌段读 inv.shuffleWeaknessAfterResolution 把本卡洗回牌库）。
//   · 「你得到 -1 生命值」= 条目级 threatEffect.healthModifier（stats.js#getMaxHealth 对
//     inv.threat 逐卡求和的唯一读点，与 04085「伊格的诅咒」/ 07106 同一通道）。
//   · 「[action][action]：弃掉」= kind:'action' + cost:{ action: 2 } + api.removeThreat
//     （harm-threat.js#removeThreat 是威胁区卡离场的唯一写入口，弃牌进 inv.discard）。

const CODE = '10135'
const CARD_NAME = '手部残疾'

export default {
  code: CODE,
  name: 'Maimed Hand',
  threatEffect: { healthModifier: -1 },
  cannotLeavePlay: true,
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区，或受到 1 点伤害并洗回牌库',
      weakness: { type: 'threat' },
      resolve: ({ inv, api }) => {
        const choice = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「${CARD_NAME}」：你必须选择一项。`,
          options: [
            { id: 'threat', label: `将「${CARD_NAME}」放置入场，放到你的威胁区域` },
            { id: 'shuffle', label: `受到 1 点伤害并将「${CARD_NAME}」混洗入你的牌库` },
          ],
        })
        if (choice === 'threat') {
          api.scenario.threat(inv.seat, CODE)
          api.info(`⚠️ 「${CARD_NAME}」进入 ${inv.name} 的威胁区域：你得到 -1 生命值。`)
          return
        }
        api.harm(inv.seat, { damage: 1 })
        api.scheduleWeaknessShuffle(inv.seat, CODE)
        api.info(`⚠️ 「${CARD_NAME}」：${inv.name} 受到 1 点伤害，卡牌混洗回牌库。`)
      },
    },
    {
      kind: 'action',
      label: `花费 2 行动：弃掉${CARD_NAME}`,
      cost: { action: 2 },
      resolve: ({ inv, source, api }) => {
        if (!source) return
        if (!api.removeThreat(source, { force: true })) return
        api.info(`🩹 ${inv.name} 花费 2 行动弃掉「${CARD_NAME}」。`)
      },
    },
  ],
  modifiers: [],
}
