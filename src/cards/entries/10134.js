// 10134 暮光冠冕（Twilight Diadem · 垂死之光之冠）· 中立支援 · 0 级 · 独一无二 · [[道具]]/[[护符]]/[[面具]]/[[祝福]]
// 卡面：
//   绑定（破碎冠冕）10133。每位调查员仅限 1 张[[面具]]。
//   [reaction] 你在技能检定期间揭示[bless]标记或[curse]标记时，花费 1 贡品并横置本卡牌：
//   改为将揭示的标记视为[elder_sign]标记并将其返回混乱袋中。
//   然后，如果本卡牌上没有贡品，查找你的绑定卡牌，找出破碎冠冕并与本卡牌交换。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自 cards-data（bondedTo / bondedCards），条目不需要额外声明（bonded.js）。
//   · 「每位调查员仅限 1 张[[面具]]」= assetRule.controlledTraitLimit（canEquip 唯一读点，
//     与 10023 / 10133 同一口径）。
//   · 「揭示[bless]/[curse]标记时」= 窗口 tokenReveal（tests.js 在标记效果结算前开窗，
//     context = { when, seat, location, token, tokenIndex, tokenDelta, autoFail, testValue }；
//     窗口只在有 tokenReveal 监听者时打开，本条目就是监听者）。
//   · 「花费 1 贡品并横置」= 描述子 cost: { exhaust: true, uses: 1 }
//     （ability-rules.js#payAbilityCost 先整体校验再扣费；贡品 = 实例 uses）。
//   · 「视为[elder_sign]并返回混乱袋」= api.replaceChaosToken(context,'eldersign')
//     （api-misc.js 的唯一写点：写 context.replacementToken；tests.js 把原标记归还混乱袋后
//      以替换标记继续结算 —— 与 05324 / 09049 同一读点）。
//   · 「没有贡品则与破碎冠冕交换」的近似见 approximation。
//
// approximation（逐条披露，缺读点见 artifacts/migration/fhv/primitive-requests/10134.json）：
//   缺「绑定卡就地交换」原语 —— 反向交换要求破碎冠冕在手牌（10133 的交换会把它放在那里），
//   然后 api.putAssetIntoPlay 放置入场 + 本卡返回手牌；印刷是本卡回到场外绑定集合。
const CODE = '10134'
const BROKEN = '10133'

function swapToBroken({ inv, source, api }) {
  if (!(inv.hand || []).includes(BROKEN)) {
    api.info('「暮光冠冕」：破碎冠冕不在手牌，无法交换（缺绑定卡就地交换原语）。')
    return false
  }
  if (!api.putAssetIntoPlay(inv.seat, BROKEN)) {
    api.info('「暮光冠冕」：破碎冠冕无法放置入场（槽位不满足）。')
    return false
  }
  if (source) api.returnAssetToHand(inv.seat, source)
  api.info('👑 「暮光冠冕」：没有贡品，与破碎冠冕交换（破碎冠冕入场，暮光冠冕返回手牌）。')
  return true
}

export default {
  code: CODE,
  name: 'Twilight Diadem',
  uses: 0,
  usesType: 'offerings',
  assetRule: { controlledTraitLimit: { trait: 'Mask', amount: 1 } },
  simplified: true,
  note: 'approximation: 缺「绑定卡就地交换」原语，反向交换要求破碎冠冕在手牌（10133 交换时放入），放置入场后本卡返回手牌而不是场外绑定集合，见 primitive-requests/10134.json。',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'tokenReveal',
      label: '揭示[bless]或[curse]标记时：花费 1 贡品并横置，改为视为[elder_sign]；没有贡品时与破碎冠冕交换',
      cost: { exhaust: true, uses: 1 },
      criteria: [({ state, inv, source, context }) => Boolean(source)
        && Boolean(state.skillTest)
        && context?.seat === inv.seat
        && ['bless', 'curse'].includes(context?.token)
        && !context?.replacementToken],
      resolve: ({ inv, source, api, context }) => {
        if (!source) return
        api.replaceChaosToken(context, 'eldersign')
        api.info(`👑 「暮光冠冕」：花费 1 贡品并横置，把揭示的${context.token === 'curse' ? '[curse]' : '[bless]'}标记视为[elder_sign]（原标记归还混乱袋）。`)
        if ((Number(source.uses) || 0) > 0) return
        swapToBroken({ inv, source, api })
      },
    },
  ],
  modifiers: [],
}
