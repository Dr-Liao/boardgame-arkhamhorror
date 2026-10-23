// 05047 杰罗姆·戴维斯（序章故事调查员）
// 卡面：[reaction]在你地点的调查员从遭遇牌库抽出诡计时，弃掉你总计至少带有2个[intellect]图标的手牌：
//       取消该卡片的显现效果。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05047')

export default {
  code: '05047',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '05047-eldersign',
    label: '旧印：+1，发现你所在地点的 1 个线索',
    resolve: ({ inv, api }) => {
      api.discoverClue(inv.seat, 1)
      return { delta: Number(sign.bonus ?? 1) }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'treachery',
      label: '弃掉至少 2 个智力图标的手牌，取消该诡计的显现效果',
      limit: 'oncePerRound',
      criteria: [({ inv, context, state }) => Boolean(context?.cardCode)
        && (context?.location == null || context.location === inv.location)
        && (state.investigators[context.seat]?.location === inv.location)
        && (inv.hand || []).some(code => true)],
      resolve: ({ inv, api, context }) => {
        const total = (inv.hand || []).reduce((sum, code) => sum + (api.cardIcons(code)?.intellect || 0), 0)
        if (total < 2) {
          api.info(`${inv.name} 手牌上的智力图标不足 2 个。`)
          return
        }
        // 逐张选择要弃掉的手牌，直到图标合计达到 2。
        let icons = 0
        let guard = 0
        while (icons < 2 && (inv.hand || []).length && guard++ < 12) {
          const answer = api.choice({
            kind: 'discard', source: '05047', seat: inv.seat,
            prompt: `「杰罗姆·戴维斯」：弃掉手牌以取消这次显现（还需要 ${2 - icons} 个智力图标）。`,
            options: [{ id: 'skip', label: '不弃牌（不取消）' },
              ...inv.hand.map((code, index) => ({
                id: String(index), cardCode: code,
                label: `${api.cardName(code)}（智力 ${api.cardIcons(code)?.intellect || 0}）`,
              }))],
          })
          if (answer === 'skip') return
          const index = Number(answer)
          if (!Number.isInteger(index) || index < 0 || index >= inv.hand.length) return
          const [code] = inv.hand.splice(index, 1)
          inv.discard.push(code)
          icons += api.cardIcons(code)?.intellect || 0
        }
        if (icons < 2) return
        context.cancelled = true
        api.info(`${inv.name} 弃掉手牌，取消了「${api.cardName(context.cardCode)}」的显现效果。`)
      },
    },
  ],
  modifiers: [],
}
