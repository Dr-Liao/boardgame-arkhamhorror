// 98017 茉莉·麦克斯韦（Molly Maxwell）· 中立 · 支援/盟友/助手 · 费用 3 · 生命 2 / 恐惧 4 · 替换（戴克斯特·德雷克）。
// 卡面（cards-data 98017）：
//   戴克斯特·德雷克牌库专用。替换。
//   [fast] 横置茉莉·麦克斯韦并给她 1 点恐惧：命名任意一个特质。从你的牌库顶逐张揭示，
//     直到揭示出一张带有该特质的支援。抽取那张支援。将其他已揭示的牌洗回你的牌库。
//
// 引擎读点：
//   · [fast] 横置 + 给自身 1 恐惧 = free 描述子 cost { exhaust:true } + api.addAssetHorror
//     （支援恐惧的唯一写点；3 点恐惧的来源是「承受 1 点恐惧」）。
//   · 「命名任意特质」= 从牌库中支援牌的实际特质集合里选择（cards-data 的 traits），api.choice。
//   · 「查找带该特质的支援并抽到它、其余洗回」= api.searchDeck({ type:'asset', traitsAny:[trait],
//     choose:1, shuffle:true })（deck-ops.js 的检索/洗回统一入口，与 90062 同一读点）。
// 近似：印刷是「从牌库顶逐张揭示直到第一张」，searchDeck 会检索整副牌库并让你选一张符合条件的支援
//   （若牌库中有多张同特质支援，可能选到不在「顶到底第一张」位置的那张）；已在 note 说明。
//   另外「给茉莉恐惧」目前不触发盟友被击败检查（addAssetHorror 只写计数），先按卡面计数接线。
import { ALL_CARDS } from '../cards-data.js'

const code = '98017'

function deckAssetTraits(inv) {
  const traits = new Set()
  for (const cardCode of inv.deck || []) {
    const def = ALL_CARDS[cardCode]
    if (def?.type !== 'asset') continue
    for (const trait of def.traits || []) traits.add(String(trait))
  }
  return [...traits].sort((a, b) => a.localeCompare(b))
}

export default {
  code,
  abilities: [{
    kind: 'free',
    cost: { exhaust: true },
    label: '横置茉莉并给她 1 点恐惧：命名一个特质，查找该特质的支援并抽取',
    criteria: [({ inv }) => (inv.deck || []).length > 0 && deckAssetTraits(inv).length > 0],
    resolve: ({ inv, source, api }) => {
      if (!source) return
      api.addAssetHorror(source, 1)
      const traits = deckAssetTraits(inv)
      const trait = traits.length === 1 ? traits[0] : api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '茉莉·麦克斯韦：命名一个特质。',
        options: traits.map(name => ({ id: name, label: name })),
      })
      if (!traits.includes(trait)) return
      const found = api.searchDeck(inv.seat, {
        source: code,
        type: 'asset',
        traitsAny: [trait],
        choose: 1,
        shuffle: true,
        optional: true,
        prompt: `茉莉·麦克斯韦：查找一张带有「${trait}」特质的支援并抽取，其余洗回牌库。`,
      }) || []
      api.info(found.length
        ? `茉莉·麦克斯韦：抽取「${api.cardName(found[0])}」，其余牌洗回牌库。`
        : `茉莉·麦克斯韦：牌库中没有带有「${trait}」特质的支援。`)
    },
  }],
  modifiers: [],
  note: '近似：「从牌库顶逐张揭示直到第一张」用 searchDeck（整库检索 + 洗回）实现，多张同特质支援时可能选中非最顶那张；给茉莉恐惧只写计数，不触发盟友被击败检查。',
}
