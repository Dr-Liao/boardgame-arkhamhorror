// 09584 艾婕·萨辛（Ece Şahin · The Vermillion-Veiled Lady）· 剧情资产 · dealings_in_the_dark
// 卡面：[free] 横置艾婕·萨辛：查看任意一位调查员牌库顶的卡牌。如果它不是弱点，你可以将它正面朝下
//       放在艾婕·萨辛底下（她底下仅限 5 张）。
//   强制 - 在任意钥匙变换后：艾婕·萨辛底下每张卡牌的所有者抽取该卡牌。
// 读点：
//   · [free] 行动 = 描述子（kind:'free' + actionKind:'activate' + cost.exhaust），引擎在
//     任何玩家窗口按「免费触发能力」枚举；横置由 payAbilityCost 写 source.exhausted。
//   · 查看牌库顶 = 直接读 `inv.deck`（只读）+ api.info 记日志；「不是弱点」用
//     api.scenario.isWeaknessCode（场景运行时的唯一弱点读点）。
//   · 「压在她底下」= api.moveCard({ from:'deck', to:'setAside' }) 把牌移出牌库并记账到
//     `scenarioFlags.eceBeneath`（引擎没有「压在剧情支援下」的写入口，见
//     artifacts/migration/tsk/primitive-requests/09584.json）。
//   · 「钥匙变换后所有主抽取」由本章 behavior 在每次 shiftTwistedAntiprism 后读取
//     flags.afterKeyShift 并执行（引擎没有全局 keyShift 窗口，见请求 09584）。
const CODE = '09584'
const LIMIT = 5

const storyAsset = state => (state.storyAssets || []).find(asset => (asset.originalCode || asset.code) === CODE) || null
const beneath = state => {
  const list = state.scenarioFlags?.eceBeneath
  return Array.isArray(list) ? list : []
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  // behavior 读点：任意钥匙变换后抽回底下每张牌；beneathLimit 供面板显示。
  flags: { storyRule: 'eceSahin', afterKeyShift: 'drawBeneath', beneathLimit: LIMIT },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: `横置艾婕·萨辛：查看一位调查员的牌库顶；不是弱点可压在她底下（上限 ${LIMIT} 张）`,
    cost: { exhaust: true },
    criteria: ({ state }) => Boolean(storyAsset(state)) && beneath(state).length < LIMIT,
    resolve: ({ state, inv, api }) => {
      const asset = storyAsset(state)
      if (!asset || beneath(state).length >= LIMIT) return
      const candidates = (state.investigators || []).filter(who => who && !who.defeated && !who.resigned)
      if (!candidates.length) return
      const chosen = candidates.length === 1 ? candidates[0] : candidates.find(who => who.seat === Number(api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat,
        prompt: '艾婕·萨辛：查看哪位调查员的牌库顶？',
        options: candidates.map(who => ({ id: String(who.seat), label: who.name })),
      }))) || candidates[0]
      const top = (chosen.deck || []).at(-1) || null
      if (!top) {
        api.info?.(`📖 艾婕·萨辛：${chosen.name} 的牌库是空的。`)
        return
      }
      api.info?.(`📖 艾婕·萨辛查看了 ${chosen.name} 的牌库顶「${api.cardName?.(top) || top}」。`)
      if (api.scenario.isWeaknessCode?.(top)) {
        api.info?.('🚫 牌库顶是弱点：不能压在她底下。')
        return
      }
      const take = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
        prompt: `要把「${api.cardName?.(top) || top}」正面朝下放在艾婕·萨辛底下吗（当前 ${beneath(state).length}/${LIMIT}）？`,
        options: [{ id: 'skip', label: '不放置' }, { id: 'place', label: '放到她底下' }],
      })
      if (take !== 'place') return
      const moved = api.moveCard({ code: top, from: 'deck', to: 'setAside', ownerSeat: chosen.seat }, { seat: chosen.seat })
      if (!moved) return
      api.scenario.setScenarioFlag('eceBeneath', [...beneath(state), { code: moved, seat: chosen.seat }])
      api.info?.(`🂠 「${api.cardName?.(moved) || moved}」正面朝下压在艾婕·萨辛底下（${beneath(state).length}/${LIMIT}）。`)
    },
  }],
  note: 'approximation: 「压在她底下」用放一边区 + scenarioFlags.eceBeneath 记账（引擎没有剧情支援下的写入口）；'
    + '「任意钥匙变换后」由本章 behavior 在密钥变换后执行（引擎没有全局 keyShift 窗口）。见 primitive-requests/09584.json。',
}
