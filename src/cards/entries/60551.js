// 60551 米格尔·德·拉·克鲁兹 · 生存者调查员（8/8，意志 3/智识 2/战斗 3/敏捷 4）
// 卡面：你可以在自己回合进行额外一个行动，该行动只能用于打出事件。
//       旧印：+1。你可以将弃牌堆中一张[[技巧]]或[[陷阱]]卡牌加入你的手牌。
//
// 引擎读点：
//   · 「额外一个只能打出事件的行动」= `investigator.restrictedAction = { kind: 'eventPlay' }`
//     （restricted-actions.js 的 RESTRICTED_ACTION_FIELDS.eventPlay = eventPlayOnlyActions；
//     turn.js 回合开始时 grantRestrictedAction 发放，table-decisions.js#restrictedKindOfMove
//     对 `move.action === 'play'` 且卡牌类型为 event 的行动命中该额度）。
//   · 旧印走 discard → hand 的 api.moveCard（唯一区域搬运入口）。
const CODE = '60551'

export default {
  code: CODE,
  kind: 'investigator',
  investigator: {
    elderSign: { bonus: 1 },
    restrictedAction: { kind: 'eventPlay' },
  },
  elderSign: {
    id: `${CODE}-eldersign`,
    label: '旧印：+1，可将弃牌堆中一张[[技巧]]或[[陷阱]]卡牌加入手牌',
    resolve: ({ inv, api }) => {
      const candidates = [...new Set((inv.discard || []).filter(code => {
        const traits = api.cardTraits(code).map(trait => String(trait).toLowerCase())
        return traits.includes('trick') || traits.includes('trap')
      }))].filter(code => api.cardType(code) !== 'weakness')
      if (!candidates.length) return { delta: 1 }
      const options = candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))
      const picked = options.length === 1 ? options[0].id : api.choice({
        kind: 'card', source: `${CODE}-eldersign`, seat: inv.seat, canSkip: true,
        prompt: '旧印：选择弃牌堆中一张[[技巧]]或[[陷阱]]卡牌加入手牌。',
        options: [{ id: 'skip', label: '不加入手牌' }, ...options],
      })
      if (picked && picked !== 'skip' && api.moveCard({ code: picked, from: 'discard', to: 'hand' })) {
        api.info(`旧印：${inv.name} 将「${api.cardName(picked)}」从弃牌堆加入手牌。`)
      }
      return { delta: 1 }
    },
  },
  abilities: [],
}
