// 10133 破碎冠冕（Broken Diadem · 垂死之光之冠）· 中立支援 · 5 级 · 1 资源 · 独一无二 · [[道具]]/[[护符]]/[[面具]]
// 卡面：
//   每套牌库仅限 1 张。每位调查员仅限 1 张[[面具]]。
//   [reaction] 你所在地点的技能检定结束后，如果本次检定同时揭示了[bless]标记与[curse]标记：
//   在本卡牌上放置 1 资源，作为贡品。然后，如果本卡牌上有 3 个贡品，查找你的绑定卡牌，
//   找出暮光冠冕（10134）并与本卡牌交换，将本卡牌上所有的贡品移动到暮光冠冕上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「每位调查员仅限 1 张[[面具]]」= assetRule.controlledTraitLimit: { trait:'Mask', amount:1 }
//     （assets.js#exceedsControlledTraitLimit，canEquip 的唯一读点 —— 本循环 assets.maskLifecycle
//      原语，与 10023 狼面具同一形状）。「每套牌库仅限 1 张」是卡面数据（deckLimit）。
//   · 「检定结束后」= 窗口 testEnds（tests.js 在关卡检定收尾时开窗，
//     context = { when, seat, result, source }；result.drawn 是本次检定揭示的标记列表）。
//     卡面「你所在地点」= 检定者所在地点与本卡控制者所在地点相同。
//   · 「贡品」= 支援实例的 uses（usesType 'offerings'）：「放置 1 资源作为贡品」走 api.addUses
//     （支援计数只经 api 写）；上限 3（到 3 即交换，印刷不会继续叠）。
//   · 「查找绑定卡牌…与本卡牌交换」的近似见下方 approximation。
//
// approximation（逐条披露，缺读点见 artifacts/migration/fhv/primitive-requests/10133.json）：
//   引擎没有「绑定卡就地交换」原语（bonded.js 只有 retrieve / shuffleCopyIntoDeck / returnToSet，
//   physical-faces.js#physicalFacePlanIfAny 只认 cards-data 里配对的 linkedCardCode；
//   本循环的 cards.bondedFaces 原语覆盖的是物理面/绑定检索，不是就地换卡）。
//   因此交换 = api.bonded.retrieve 取出暮光冠冕 → api.putAssetIntoPlay 放置入场 →
//   贡品转移 → api.returnAssetToHand 把破碎冠冕收回手牌。
//   与印刷的差别：破碎冠冕留在手牌（可以按 1 资源再次打出），而不是回到场外绑定集合；
//   反向交换（10134 → 10133）要求它此刻在手牌，与 10035/10036 的写法同口径。
const CODE = '10133'
const TWILIGHT = '10134'
const MAX_OFFERINGS = 3

const revealedBlessAndCurse = result => {
  const drawn = Array.isArray(result?.drawn) ? result.drawn : []
  return drawn.includes('bless') && drawn.includes('curse')
}

function swapToTwilight({ inv, source, api, offerings }) {
  const retrieved = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
  if (!retrieved?.length) {
    api.info('「破碎冠冕」：绑定卡牌不在场外集合内，无法交换。')
    return false
  }
  if (!api.putAssetIntoPlay(inv.seat, TWILIGHT)) {
    api.info('「破碎冠冕」：暮光冠冕无法放置入场（槽位不满足）。')
    return false
  }
  const twilight = (inv.assets || []).find(card => card.code === TWILIGHT && card.id !== source?.id)
  if (twilight && offerings) api.addUses(twilight, offerings)
  if (offerings) api.spendUses(source, offerings)
  if (source) api.returnAssetToHand(inv.seat, source)
  api.info(`👑 「破碎冠冕」与暮光冠冕交换：${offerings} 个贡品移到暮光冠冕上；破碎冠冕返回手牌。`)
  return true
}

export default {
  code: CODE,
  name: 'Broken Diadem',
  uses: 0,
  usesType: 'offerings',
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  simplified: true,
  note: 'approximation: 缺「绑定卡就地交换」原语，交换 = 检索绑定卡（暮光冠冕）放置入场 + 贡品转移 + 破碎冠冕返回手牌（可按费用再次打出，而不是回到场外绑定集合），见 primitive-requests/10133.json。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'testEnds',
      // 「每次检定结束后」只结算一次：perTest 上限（limits.js 的唯一读点）同时挡住
      // 同一窗口里能力窗口的重复询问循环（窗口键内嵌 state.skillTest.id）。
      limit: { scope: 'perTest', owner: 'instance' },
      label: '检定结束后（同时揭示[bless]与[curse]）：放置 1 个贡品；满 3 个则与暮光冠冕交换',
      criteria: [({ state, inv, source, context }) => {
        if (!source) return false
        if (!revealedBlessAndCurse(context?.result)) return false
        const performer = state.investigators?.[context?.seat]
        return Boolean(performer) && performer.location === inv.location
      }],
      resolve: ({ state, inv, source, api, context }) => {
        if (!source) return
        const gain = Math.max(0, Math.min(1, MAX_OFFERINGS - (source.uses || 0)))
        if (gain > 0) api.addUses(source, gain)
        const offerings = Math.max(0, Number(source.uses) || 0)
        api.info(`👑 「破碎冠冕」：${inv.name} 放置 1 个贡品（${offerings}/${MAX_OFFERINGS}）。`)
        if (offerings < MAX_OFFERINGS) return
        swapToTwilight({ inv, source, api, offerings })
      },
    },
  ],
  modifiers: [],
}
