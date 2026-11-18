// 10080 脏活（Dirty Deeds）· 潜袭（Rogue）事件 · 1 资源 · 3 经验 · [[人情]]/[[双重]]/[[违法]]
//
// 卡面：
//   作为打出脏活的额外费用，花费一个行动。
//   查找你的牌库，找出一张 [[违法]] 支援并打出，支付其费用。然后，你可以结算该支援上的一个
//   [action] 或 [fast] 能力，忽略所有费用（包括其 [action] 费用，如有）。
//   打出本卡牌不会触发趁乱攻击。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「作为额外费用，花费一个行动」：[[双重]]（Double）的额外行动费统一读点
//     ability.js#playedActionCost —— played 描述子声明 `cost: { action: 1 }`，
//     legalMoves / validateMove / doPlay 共用（actions.js 在资源费成功后 consumeAction）。
//   · 「打出不触发趁乱攻击」：played 描述子的 `noOpportunityAttack: true`（cardPlayFlag 读点）。
//   · 「查找牌库，找出一张[[违法]]支援并打出」：api.searchDeck({ trait:'Illicit', type:'asset',
//     choose:1, shuffle:true, playFound:true }) —— playFound 让候选只包含「现在付得起」的支援
//     （deck-ops.js 的同一份费用口径），选中的牌按 B5 原语进入手牌；随后 api.playCard(seat, code,
//     { noAction: true }) 走正常打出管线（付费用、入场钩子、反应窗口；不再花行动）。
//     与 10026「举起手来」的折扣打出是同一个 api.playCard 读点。
//   · 「结算该支援上的一个 [action] 或 [fast] 能力，忽略所有费用」：
//     api.cardAbilityOptions(seat, asset, { ignoreCosts: true, ignoreActionCost: true }) +
//     api.resolveCardAbility(..., { ignoreCosts: true, ignoreActionCost: true })
//     （api-card.js 的唯一执行器；ignoreCosts 跳过横置/使用次数/资源，ignoreActionCost 跳过行动费。
//     与 10002/09076/08089 同一套「忽略费用结算某张卡的能力」原语）。
const CODE = '10080'

export default {
  code: CODE,
  name: 'Dirty Deeds',
  abilities: [
    {
      kind: 'played',
      // 「作为额外费用，花费一个行动」（[[双重]] 的统一读点）。
      cost: { action: 1 },
      noOpportunityAttack: true,
      label: '查找[[违法]]支援并支付费用打出，然后忽略费用结算它的一个 [action]/[fast] 能力',
      resolve: ({ state, inv, api }) => {
        const found = api.searchDeck(inv.seat, {
          trait: 'Illicit', type: 'asset', choose: 1, shuffle: true, playFound: true,
          source: CODE,
          prompt: '「脏活」：查找一张[[违法]]支援并打出（支付其费用）。',
        })
        const code = (found || [])[0]
        if (!code) {
          api.info('「脏活」：牌库里没有可以打出的[[违法]]支援。')
          return
        }
        if (!api.playCard(inv.seat, code, { noAction: true })) {
          api.info(`「脏活」：「${api.cardName(code)}」当前不能打出。`)
          return
        }
        const played = (inv.assets || []).filter(card => card.code === code).at(-1)
        if (!played) return
        const options = api.cardAbilityOptions(inv.seat, played, { ignoreCosts: true, ignoreActionCost: true })
        if (!options.length) {
          api.info(`「脏活」：「${api.cardName(code)}」没有可结算的 [action] 或 [fast] 能力。`)
          return
        }
        const chosen = options.length === 1 ? options[0] : (() => {
          const answer = api.choice({
            kind: 'ability', source: CODE, seat: inv.seat,
            prompt: `「脏活」：选择「${api.cardName(code)}」要忽略费用结算的能力。`,
            options: options.map(option => ({ id: String(option.index), label: option.label })),
          })
          return options.find(option => String(option.index) === String(answer)) || options[0]
        })()
        if (!chosen) return
        api.info(`🕶️ 「脏活」：「${api.cardName(code)}」已打出，忽略所有费用结算它的能力。`)
        api.resolveCardAbility(inv.seat, played, {
          abilityIndex: chosen.index, ignoreCosts: true, ignoreActionCost: true,
        })
      },
    },
  ],
  modifiers: [],
}
