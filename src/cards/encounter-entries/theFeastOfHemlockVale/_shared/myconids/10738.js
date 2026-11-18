// 10738 黑色毒菇（Black Amanita）· 敌人 · 共享遭遇组 myconids（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/myconids（theLostSister / theTwistedHollow 的遭遇牌库
//   把本组洗入）。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   (Day [day]) Aloof. (Night [night]) Massive.
//   Forced - After you discover a clue at Black Amanita's location or a connecting location,
//   if it is ready: Take 1 direct horror.
//
// 读点（声明即接线）：
//   · 「冷漠 / 庞大」：encounterDefinitions 从英文正文解析关键词（content/campaigns/theFeastOfHemlockVale/
//     card-data.js），昼夜差异是 P8 关键词昼夜读点，条目只把昼夜数据放进 flags。
//   · 「你发现线索后（本地或连接地点），若它处于重整状态」= 条目的 forced 描述子，
//     trigger 'clueDiscovered'：读点 src/engine/locations.js#discoverClue 的
//     triggerReaction + reactionWindow('clueDiscovered')，context 带 { seat, location, amount, lastClue }；
//     非玩家实体作为窗口来源见 ability-rules.js#nonPlayerAbilitySources。
//   · 直接恐惧 = api.directHorror（api-misc.js 的直接恐惧入口）。
const CODE = '10738'
const NAME = '黑色毒菇'

const isHereOrConnected = (state, clueLocationId, ownLocationId) => {
  if (!clueLocationId || !ownLocationId) return false
  if (clueLocationId === ownLocationId) return true
  const location = (state.locations || []).find(item => item.id === ownLocationId)
  return (location?.connections || []).includes(clueLocationId)
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: {
    encounterGroup: 'myconids',
    quantity: 2,
    traits: ['Flora', 'Mutated'],
    dayOnlyKeywords: ['aloof'],
    nightOnlyKeywords: ['massive'],
    printedFight: 2,
    printedEvade: 3,
    printedHealth: 2,
    printedDamage: 0,
    printedHorror: 1,
    printedVictory: 0,
    forcedClueDiscovery: { directHorror: 1, scope: 'hereAndConnections', whileReady: true },
  },
  abilities: [{
    kind: 'forced',
    trigger: 'clueDiscovered',
    silent: true,
    label: '强制：你发现本地或连接地点的线索后，若它处于重整状态，受到 1 点直接恐惧',
    criteria: [({ state, source, context }) => !source?.exhausted
      && isHereOrConnected(state, context?.location, source?.location)],
    resolve: ({ context, api }) => {
      const seat = Number.isInteger(context?.seat) ? context.seat : null
      if (seat == null) return
      api.directHorror(seat, 1)
      api.info?.(`🍄 「${NAME}」：发现线索后受到 1 点直接恐惧。`)
    },
  }],
  note: '「发现线索后的直接恐惧」用 clueDiscovered 窗口（本地或连接地点、且本敌人处于重整状态）自足实现；'
    + '「白日冷漠 / 黑夜庞大」由 encounterDefinitions 按英文正文静态解析，昼夜差异留给 P8 关键词昼夜读点。',
}
