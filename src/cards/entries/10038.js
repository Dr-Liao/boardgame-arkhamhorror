// 10038 奇迹祝愿（Miracle Wish）· 守护者事件 · 5 经验 · 恩惠/祝福
// 卡面：快速。你所在地点的技能检定期间揭示了[bless]标记后打出。
//       查找你的绑定卡牌，找出转瞬为神，并将其放置入场。
//       在上面放置最多 X 个资源，作为祝愿（最多为揭示的[bless]标记数量）。
//       将奇迹祝愿从游戏中移除。
//
// 读点（卡面 → 引擎）：
//   · 「快速。在……技能检定期间揭示了[bless]标记后打出」= played 描述子 fast + trigger:
//     'chaosTokenRevealed'（tests.js ST.4 之后的窗口，context = { when, seat, location, token,
//     tokenIndex }），criteria 收窄为「本次标记是 bless 且在你的地点」。快速事件统一通道
//     （quickEventView → reactionWindow → playReactionCard）会按这两项枚举与执行。
//   · 「查找绑定卡，把转瞬为神放置入场」= api.bonded.retrieve（把场外集合的绑定卡加入手牌）
//     + api.putAssetIntoPlay（从手牌放置入场，走同一套槽位/入场窗口）。
//   · 「放置最多 X 个祝愿」= X = 本次检定期间揭示的 bless 标记数（state.chaos.revealed 当前帧，
//     与 tests.js#closeTest 统计 bless 的口径同一数据源），由玩家选择 0..X，
//     写入方式 api.setAssetUses（支援 uses 的唯一写点）。
//   · 「将奇迹祝愿从游戏中移除」= 条目级 removeAfterPlay（actions.js 打出收尾段读点）。
const CODE = '10038'
const ASCENSION = '10039'
const BLESS = 'bless'

function revealedBlessings(state) {
  const frames = state.chaos?.frames || []
  const start = frames.length ? frames[frames.length - 1] : 0
  return (state.chaos?.revealed || []).slice(start).filter(face => face === BLESS).length
}

function miracleWish({ state, inv, api }) {
  let wishes = revealedBlessings(state)
  if (!wishes) wishes = 1
  const retrieved = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
  if (!retrieved?.length) {
    api.info('奇迹祝愿：绑定卡牌不在场外集合内，无法找出转瞬为神。')
    return
  }
  if (!api.putAssetIntoPlay(inv.seat, ASCENSION)) {
    api.info('奇迹祝愿：转瞬为神无法放置入场（槽位不满足）。')
    return
  }
  const ascension = (inv.assets || []).find(asset => asset.code === ASCENSION)
  let placed = wishes
  if (wishes > 1) {
    const pick = api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: `奇迹祝愿：最多放置 ${wishes} 个祝愿（本次检定揭示了 ${wishes} 个祝福标记）。`,
      options: Array.from({ length: wishes + 1 }, (_, amount) => ({ id: String(amount), label: `放置 ${amount} 个祝愿` })),
    })
    placed = Math.max(0, Math.min(wishes, Number(pick) || 0))
  }
  if (ascension && placed) api.setAssetUses(ascension, placed)
  api.info(`🌟 奇迹祝愿：转瞬为神放置入场，放置 ${placed} 个祝愿；奇迹祝愿移出游戏。`)
}

export default {
  code: CODE,
  name: 'Miracle Wish',
  removeAfterPlay: true,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'chaosTokenRevealed',
      label: '快速：把转瞬为神放置入场并放置最多 X 个祝愿，然后移出游戏',
      criteria: [({ inv, context }) => Boolean(context)
        && context.when === 'chaosTokenRevealed'
        && context.token === BLESS
        && context.location === inv.location],
      resolve: miracleWish,
    },
  ],
  modifiers: [],
}
