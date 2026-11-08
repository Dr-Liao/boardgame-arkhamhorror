// 08049 反间谍活动（Counterespionage）· 游荡者（Rogue）事件 · 1 经验。
//
// 卡面：快速。在你抽取一张非弱点的诡计时打出。
//       取消该卡牌的显现效果并抽取遭遇牌库顶的卡牌。
//       [reaction] 在你打出反间谍活动时，提升其费用 2 点：将"遭遇牌库"换成"你的牌库"。
//       [reaction] 在你打出反间谍活动时，提升其费用 2 点：将"你"换成"任意调查员"。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 已实现：「取消显现 + 改抽你的牌库」的升级（beforePlayCost 窗口记 playUpgrades/costIncrease，
// 与 05111/05234/05277 同一口径）。「'你'→任意调查员」的升级需要跨座位快速事件候选：
// 当前引擎的快速事件只在抽取者自己的窗口枚举 → 已写原语请求 m2-2-08049.json，待主进程接线。
export default {
  code: '08049',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      label: '打出反间谍活动时：提升费用 2 点（遭遇牌库 → 你的牌库）',
      criteria: [({ inv, context }) => context?.cardCode === '08049'
        && !context?.playUpgrades?.yourDeck
        && (inv.resources || 0) >= Number(context?.cost || 0) + Number(context?.costIncrease || 0) + 2],
      resolve: ({ api, context }) => {
        context.playUpgrades = { ...(context.playUpgrades || {}), yourDeck: true }
        context.costIncrease = Number(context.costIncrease || 0) + 2
        api.info('反间谍活动：提升费用 2 点，把「遭遇牌库」换成「你的牌库」。')
      },
    },
    {
      kind: 'reaction',
      trigger: 'beforePlayCost',
      // approximation: 引擎的快速事件候选只在抽牌者自己的窗口枚举，无法把触发范围扩到
      // 「任意调查员」；这里仍允许花 2 点费用记录该升级（主效果不变），跨座位触发待原语。
      label: '打出反间谍活动时：提升费用 2 点（"你"→"任意调查员"，近似：仅记录升级）',
      criteria: [({ inv, context }) => context?.cardCode === '08049'
        && !context?.playUpgrades?.anyInvestigator
        && (inv.resources || 0) >= Number(context?.cost || 0) + Number(context?.costIncrease || 0) + 2],
      resolve: ({ api, context }) => {
        context.playUpgrades = { ...(context.playUpgrades || {}), anyInvestigator: true }
        context.costIncrease = Number(context.costIncrease || 0) + 2
        api.info('反间谍活动：提升费用 2 点，记录「任意调查员」升级（跨座位触发近似）。')
      },
    },
    {
      kind: 'played',
      fast: true,
      trigger: 'treachery',
      label: '取消该诡计的显现，并抽取遭遇牌库顶（升级后改为你的牌库）',
      criteria: [({ context }) => Boolean(context) && context.when === 'treachery'
        && !context.weakness && !context.cancelled && !context.cannotCancel],
      resolve: ({ inv, context, api }) => {
        if (!api.playerTools.cancelRevelation(context)) {
          api.info('「反间谍活动」：这张诡计的效果不能被取消。')
          return
        }
        const upgrades = context?.playCost?.playUpgrades || {}
        if (upgrades.yourDeck) {
          api.drawCards(inv.seat, 1)
          api.info(`「反间谍活动」取消了「${api.cardName(context.cardCode)}」的显现，改为抽取你的牌库顶。`)
        } else {
          api.drawEncounter(inv.seat)
          api.info(`「反间谍活动」取消了「${api.cardName(context.cardCode)}」的显现，并抽取遭遇牌库顶。`)
        }
      },
    },
  ],
  modifiers: [],
}
