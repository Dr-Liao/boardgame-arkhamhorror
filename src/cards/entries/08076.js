// 08076 阅后即焚（Burn After Reading）· 幸存者事件 · 1 经验。
//
// 卡面：放逐你手中一张等级 0-5 的卡牌。发现你所在地点的 2 个线索。
//       如果被放逐的卡牌为等级 2 或更高，移除当前密谋上的 1 个毁灭印记。放逐阅后即焚。
//
// 一卡一文件：这张卡的行为只在这里维护。
// approximation: 引擎没有直接的「放逐任意手牌」ctx.api。这里先把该手牌移入弃牌堆，再用
// api.exileFromDiscard 记账放逐（state.removedFromGame 与引擎放逐读点一致）；事件自身用
// played 描述子的 exileAfterPlay 放逐。
import { ALL_CARDS } from '../../cards/cards-data.js'

const levelOf = code => {
  const def = ALL_CARDS[code]
  if (!def || def.subtype === 'weakness' || def.subtype === 'basicweakness') return null
  const xp = Number(def.xp)
  return Number.isSafeInteger(xp) && xp >= 0 && xp <= 5 ? xp : null
}

export default {
  code: '08076',
  abilities: [
    {
      kind: 'played',
      exileAfterPlay: true,
      label: '放逐一张 0-5 级手牌：发现 2 个线索；等级≥2 时移除 1 毁灭；放逐本卡',
      resolve: ({ inv, api }) => {
        const candidates = [...new Set(inv.hand || [])].filter(code => levelOf(code) != null && code !== '08076')
        if (!candidates.length) {
          api.info('「阅后即焚」：你手中没有 0-5 级的卡牌可以放逐。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0]
          : api.choice({ kind: 'card', source: '08076', seat: inv.seat,
            prompt: '选择要放逐的手牌（等级 0-5）。',
            options: candidates.map(code => ({ id: code, cardCode: code, label: `${api.cardName(code)}（${levelOf(code)} 级）` })) })
        if (!candidates.includes(picked)) return
        const level = levelOf(picked)
        api.moveCard({ code: picked, from: 'hand', to: 'discard' })
        api.exileFromDiscard(inv.seat, picked)
        api.info(`🔥 「阅后即焚」：放逐了「${api.cardName(picked)}」（${level} 级）。`)
        api.discoverClue(inv.seat, 2)
        if (level >= 2) {
          const removed = api.removeDoom(1)
          api.info(removed > 0 ? '🔥 「阅后即焚」：移除了当前密谋上的 1 个毁灭印记。' : '「阅后即焚」：当前密谋没有可移除的毁灭印记。')
        }
      },
    },
  ],
  // 事件自身放逐：played 描述子读点见 src/engine/actions.js#_playDisposal。
  modifiers: [],
}
