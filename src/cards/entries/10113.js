// 10113 破釜沉舟（Pushed to the Limit）· 潜袭者事件 · 0 经验 · 2 资源 · 战术/即兴
// 卡面：选择你弃牌堆的一个[[武器]]或[[工具]]支援。结算该支援上的一个 [action] 能力，
//       忽略所有费用（包括其 [action] 费用）。此效果结算后，将所选支援混洗入你的牌库。
//       打出本卡牌不会触发趁乱攻击。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「选择弃牌堆的一个[[武器]]或[[工具]]支援」= 弃牌堆里的资产卡号按 cards-data 的 traits 过滤；
//     playCondition 再用条目注册表的描述子确认「该支援上有 [action] 能力」（与 resolve 的候选同源）。
//   · 「忽略所有费用（包括其 [action] 费用）」= api.resolveAssetAction(seat, { discardIndex, abilityIndex,
//     waive: 'all' })：唯一读点在 api-card.js#resolveAssetAction → resolveCardAbility
//     （ignoreCosts + ignoreActionCost，仍保留限次与合法的目标枚举）。
//   · 「结算后混洗入你的牌库」= api.moveCard({ from:'discard', to:'deckTop' }) + api.shuffleDeck
//     （牌堆搬运与洗牌的既有原语；若该能力自己把牌移走则不再搬运）。
//   · 「不会触发趁乱攻击」= played.noOpportunityAttack。
import { ALL_CARDS } from '../../cards/cards-data.js'
import { entryData } from './_shared.js'

const CODE = '10113'
const TRAITS = new Set(['weapon', 'tool'])

// 弃牌堆里的[[武器]]/[[工具]]支援卡号（同名多份只列一次）。
function weaponOrToolAssets(inv) {
  return [...new Set(inv.discard || [])].filter(code => {
    const def = ALL_CARDS[code]
    return def?.type === 'asset' && (def.traits || []).some(trait => TRAITS.has(String(trait).toLowerCase()))
  })
}

// 印刷触发条件还要求「该支援上有可执行的 [action] 能力」：用注册条目的描述子做同一份粗判
// （真正能否执行仍由 resolve 里的 api.cardAbilityOptions 决定，与牌桌按钮同一读点）。
function keyedActionAssets(inv) {
  return weaponOrToolAssets(inv).filter(code =>
    (entryData(code, 'abilities') || []).some(descriptor => descriptor.kind === 'action'))
}

export default {
  code: CODE,
  name: 'Pushed to the Limit',
  playCondition: [{
    when: ({ inv }) => keyedActionAssets(inv).length > 0,
    message: '你的弃牌堆里没有带可执行 [action] 能力的[[武器]]或[[工具]]支援',
  }],
  abilities: [
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '选择弃牌堆的一个[[武器]]/[[工具]]支援，忽略所有费用结算其 [action] 能力，然后洗回牌库',
      resolve: ({ inv, api }) => {
        const codes = keyedActionAssets(inv)
        if (!codes.length) {
          api.info('「破釜沉舟」：你的弃牌堆里没有带 [action] 能力的[[武器]]或[[工具]]支援。')
          return
        }
        const pickedCode = codes.length === 1 ? codes[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '「破釜沉舟」：选择弃牌堆中的一个[[武器]]或[[工具]]支援。',
          options: codes.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = codes.includes(pickedCode) ? pickedCode : codes[0]
        const options = api.cardAbilityOptions(inv.seat, code, {
          ignoreCosts: true, ignoreActionCost: true, actionOnly: true,
        }) || []
        if (!options.length) {
          api.info(`「破釜沉舟」：弃牌堆里的「${api.cardName(code)}」没有当前可执行的 [action] 能力。`)
          return
        }
        const abilityIndex = options.length === 1 ? options[0].index : Number(api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「破釜沉舟」：选择「${api.cardName(code)}」上的一个 [action] 能力。`,
          options: options.map(option => ({ id: String(option.index), label: option.label })),
        }))
        const ability = options.find(option => option.index === abilityIndex) || options[0]
        const discardIndex = inv.discard.lastIndexOf(code)
        if (discardIndex < 0) return
        const resolved = api.resolveAssetAction(inv.seat, {
          discardIndex, abilityIndex: ability.index, waive: 'all',
        })
        api.info(`🎯 「破釜沉舟」：${resolved ? '已忽略全部费用结算' : '无法结算'}「${api.cardName(code)}」上的 [action] 能力。`)
        if ((inv.discard || []).includes(code)) {
          api.moveCard({ code, from: 'discard', to: 'deckTop' }, { seat: inv.seat })
          api.shuffleDeck(inv.seat)
          api.info(`🃏 「破釜沉舟」：将「${api.cardName(code)}」混洗入你的牌库。`)
        }
      },
    },
  ],
  modifiers: [],
}
