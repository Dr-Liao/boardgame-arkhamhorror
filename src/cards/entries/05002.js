// 05002 乔·戴蒙德
// 卡面：强制 - 在调查阶段开始时：揭示你直觉牌库顶1张卡牌。直到本阶段结束，你可以以-2费用打出该卡牌，
//       如同它是你的手牌。如果当本阶段结束时该卡牌未被打出，将其洗回你的直觉牌库。
// 卡面：[elder_sign]效果：+1。你可以将你弃牌堆的一张[[洞察]]事件移动到你的直觉牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 直觉牌库的三条规则（揭示 / -2 费用 / 洗回）都在引擎的 src/engine/hunch-deck.js：
// 调查员条目只声明「几张、什么特性、必须包含哪张」，不写第二套结算。
// 牌组配额（至少 11 张洞察事件）由 src/deck/deckbuilding.js 的自动构筑落实。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05002')

export default {
  code: '05002',
  kind: 'investigator',
  investigator: {
    hunchDeck: { size: 11, trait: 'Insight', requiredCodes: ['05010'] },
    elderSign: { bonus: 1 },
  },
  elderSign: {
    id: '05002-eldersign',
    label: '旧印：+1，可把弃牌堆的一张洞察事件放到直觉牌库底',
    resolve: ({ inv, api }) => {
      const bonus = Number(sign.bonus ?? 1)
      const candidates = api.hunchDeck.insightsInDiscard(inv)
      if (!candidates.length) return { delta: bonus }
      const answer = api.choice({
        kind: 'card', source: 'joeElderSign', seat: inv.seat, canSkip: true,
        prompt: '旧印：是否把弃牌堆中的一张[[洞察]]事件放到直觉牌库底？',
        options: [{ id: 'skip', label: '不移动' },
          ...candidates.map((code, index) => ({ id: String(index), cardCode: code, label: api.cardName(code) }))],
      })
      if (answer === 'skip') return { delta: bonus }
      const chosen = candidates[Number(answer)]
      if (chosen) api.hunchDeck.moveToBottom(inv, chosen)
      return { delta: bonus }
    },
  },
  abilities: [],
  modifiers: [],
}
