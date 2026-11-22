// 60253 不灭之网（Unbroken Web，卡洛琳专属弱点）
// 卡面：显现 - 将不灭之网放入你的威胁区域。
// [reaction] 在你将要发现任意数量的线索时：改为将等量恐惧放在不灭之网上；然后若其上至少 4 点恐惧，弃掉它。
// 强制 - 在游戏结束时或你退场时：你少取得 2 点经验。
// 读点：weakness type:threat（weakness.js 威胁区入场）；reaction trigger discoverClue（locations.js 发现线索前窗口）；
// api.addCardCounter / api.cardCounterOf（计数器唯一写点）+ api.discardSelf；scenarioXpModifier 由结局 XP 结算读取。
// 近似：引擎 discoverClue 窗口没有「取消本次发现」的返回值，线索仍会被发现（请求见 primitive-requests/w4-carolyn.json）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60253'

export default {
  code: CODE,
  scenarioXpModifier: -2,
  abilities: [
    {
      kind: 'weakness',
      label: '放入威胁区域',
      weakness: { type: 'threat' },
    },
    {
      kind: 'reaction',
      trigger: 'discoverClue',
      limit: 'oncePerPhase',
      label: '发现线索前：在卡上放等量恐惧，达到 4 点弃掉',
      criteria: [({ inv, context }) => context?.seat === inv.seat],
      resolve: ({ inv, context, api }) => {
        // 替换本次线索发现（locations.js#discoverClueAt 的 _clueDiscoveryReplaced 读点）。
        api.replaceClueDiscovery()
        const card = (inv.threat || []).find(item => item.code === CODE)
        if (!card) return
        const amount = Math.max(1, Number(context?.amount) || 1)
        api.addThreatFear(card, amount)
        const counters = api.threatFear(card) || 0
        if (counters >= 4) api.discardSelf(CODE)
      },
    },
  ],
  note: 'approximate: 每阶段最多替换一次（引擎窗口重放避免无限询问）；印刷允许每次发现线索时替换。',
  modifiers: [],
}
