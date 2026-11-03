// 05231 知识就是力量（探求者 · 0 经验）
// 卡面：快速。只能在你回合期间打出。
// 卡面：选择一张你控制的[[书籍]]或[[法术]]支援，或揭示你手牌中的一张[[书籍]]或[[法术]]支援。
//       结算该支援上的一个[action]或[fast]能力，忽略所有费用(包括其[action]费用，如有)。
//       然后，如果该支援是从你手牌中揭示的，你可以弃掉它来抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05231 知识就是力量：结算一张[[书籍]]/[[法术]]支援上的一个 [行动]/[快速] 能力（忽略费用）。
//
import { ownTurn } from '../../engine/matcher.js'

const isTomeOrSpell = (api, code) => {
  if (api.cardType(code) !== 'asset') return false
  const traits = api.cardTraits(code) || []
  return traits.some(trait => ['tome', 'spell'].includes(String(trait).toLowerCase()))
}

export default {
  code: '05231',
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '知识就是力量：结算一张书籍/法术支援的 [行动]/[快速] 能力（忽略费用）',
      resolve: ({ inv, api }) => {
        const optionsFor = source => api.cardAbilityOptions(inv.seat, source, { ignoreCosts: true })
        const controlled = inv.assets
          .filter(asset => isTomeOrSpell(api, asset.code) && optionsFor(asset).length)
          .map(asset => ({ kind: 'asset', code: asset.code, asset }))
        const fromHand = [...new Set(inv.hand)]
          .filter(code => isTomeOrSpell(api, code) && optionsFor(code).length)
          .map(code => ({ kind: 'hand', code, asset: null }))
        const candidates = [...controlled, ...fromHand]
        if (!candidates.length) { api.info('没有可以结算能力的[[书籍]]或[[法术]]支援。'); return }
        const answer = candidates.length === 1 ? '0' : api.choice({
          kind: 'target', source: '05231', seat: inv.seat,
          prompt: '选择一张[[书籍]]或[[法术]]支援，结算它的一个[行动]或[快速]能力。',
          options: candidates.map((candidate, index) => ({
            id: String(index),
            label: `${api.cardName(candidate.code)}（${candidate.kind === 'asset' ? '场上' : '手牌'}）`,
          })),
        })
        const picked = candidates[Number(answer)] || candidates[0]
        const source = picked.kind === 'asset' ? picked.asset : picked.code
        const list = optionsFor(source)
        const pickedIndex = list.length === 1 ? 0 : Number(api.choice({
          kind: 'effect', source: '05231', seat: inv.seat,
          prompt: '选择要结算的能力。',
          options: list.map((option, index) => ({ id: String(index), label: option.label })),
        }))
        const ability = list[pickedIndex] || list[0]
        if (picked.kind === 'hand') {
          api.info(`📖 ${inv.name} 从手牌揭示「${api.cardName(picked.code)}」。`)
        }
        api.resolveCardAbility(inv.seat, source, { abilityIndex: ability.index, ignoreCosts: true })
        if (picked.kind !== 'hand') return
        const discardIt = api.choice({
          kind: 'effect', source: '05231', seat: inv.seat, canSkip: true,
          prompt: '是否弃掉这张从手牌揭示的支援，以抽取 1 张卡牌？',
          options: [{ id: 'skip', label: '保留' }, { id: 'discard', label: '弃掉并抽 1 张' }],
        })
        if (discardIt !== 'discard') return
        api.discardFromHand(inv.seat, picked.code)
        api.drawCards(inv.seat, 1)
        api.info(`🃏 ${inv.name} 弃掉「${api.cardName(picked.code)}」并抽取 1 张牌。`)
      },
    },
  ],
}
