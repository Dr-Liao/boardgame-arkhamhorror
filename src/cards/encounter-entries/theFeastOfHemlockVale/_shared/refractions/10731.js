// 10731 摄魂微光（Captivating Gleam）· 诡计 · 共享遭遇组 refractions（印刷 3 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/refractions。
// 卡面（cards-data 10731）：
//   涌动。
//   显现 - 将摄魂微光放置入场，放到你的威胁区域。每位调查员仅限 1 张。
//   强制 - 如果你没有手牌：受到 5 点恐惧并弃掉摄魂微光。
//
// 读点（声明即接线）：
//   · 涌动 = 印刷正文由章节 encounterDefinitions 解析（本条目只落 flags）；
//   · 威胁区入场 = api.threat；重复副本按「每位调查员仅限 1 张」直接弃置；
//   · 「没有手牌」是持续条件，引擎没有「手牌数变为 0」的专用窗口，因此挂在
//     handCardDiscarded / eventPlayed / turnBegins 三个既有窗口上检查：
//     弃掉最后一张手牌、打出最后一张事件、回合开始时各判一次；显现入场时也立刻判一次；
//   · 恐惧走 api.horror，弃卡走 api.removeThreat（威胁区卡唯一弃置写入口）。
//
// 近似：只在这三个时点检查「没有手牌」，效果移动/弃牌之外的路径（如被他人效果移走手牌）
//   可能延后到下一次检查；成功的检查会移除本卡，不会重复触发。
const CODE = '10731'
const HORROR = 5

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

const emptyHandedHolder = (state, source) => {
  const holder = holderOf(state, source)
  if (!holder || holder.defeated || holder.resigned) return null
  return (holder.hand || []).length === 0 ? holder : null
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Power', 'Colour'],
    quantity: 3,
    surge: true,
    limitPerInvestigator: 1,
    emptyHandHorror: HORROR,
    emptyHandDiscardSelf: true,
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`✨ 「摄魂微光」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    const threatCard = api.threat(inv.seat, CODE)
    api.info?.(`✨ 「摄魂微光」进入 ${inv.name} 的威胁区域。`)
    if ((inv.hand || []).length === 0 && threatCard && (inv.threat || []).includes(threatCard)) {
      api.horror(inv.seat, HORROR)
      api.removeThreat(threatCard)
      api.info?.(`✨ 「摄魂微光」：${inv.name} 入场时已无手牌，受到 ${HORROR} 点恐惧并弃掉本卡。`)
    }
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: ['handCardDiscarded', 'eventPlayed', 'turnBegins'],
    silent: true,
    label: '如果你没有手牌：受到 5 点恐惧并弃掉摄魂微光',
    criteria: ({ state, source }) => Boolean(emptyHandedHolder(state, source)),
    resolve: ({ state, source, api }) => {
      const holder = emptyHandedHolder(state, source)
      if (!holder) return
      api.horror(holder.seat, HORROR)
      api.removeThreat(source)
      api.info?.(`✨ 「摄魂微光」：${holder.name} 没有手牌，受到 ${HORROR} 点恐惧并弃掉本卡。`)
    },
  }],
  note: 'approximation: 「没有手牌」检查挂在 handCardDiscarded / eventPlayed / turnBegins 三个既有窗口，'
    + '游戏没有专门的「手牌清空」窗口；显现入场时会立刻检查一次。涌动来自印刷正文解析。',
}
