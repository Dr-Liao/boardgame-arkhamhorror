// 05047 杰罗姆·戴维斯（序章故事调查员）
// 卡面：[reaction]在你地点的调查员从遭遇牌库抽出诡计时，弃掉你总计至少带有2个[intellect]图标的手牌：
//       取消该卡片的显现效果。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 修复（task-22/task-41）：
//   · 可用性：旧 criteria 只看「手牌非空」，智力图标不足时也给玩家一个点了才发现无效的反应选项。
//     现在 criteria 在 state.cards 嵌入了手牌定义时先过滤（总数 <2 不出现在窗口里）；定义未嵌入时
//     （剧本设置阶段才写入的固定手牌）退回 resolve 并用 api.cardIcons 精确判定。
//   · 旧 resolve 在逐张弃牌途中仍提供「不弃牌（不取消）」，玩家弃 1 张后放弃会白丢牌且不取消。
//     现在图标已校验 ≥2，弃牌阶段不再提供中断选项，按卡面一次性付清费用。
//   · 手牌统计与弃牌都排除弱点卡（弱点不能主动弃掉）。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05047')

const handIconInfo = (state, inv) => {
  const entries = (inv.hand || []).map((code, index) => {
    const def = state?.cards?.[code]
    const subtype = def?.subtype
    const weakness = subtype === 'weakness' || subtype === 'basicweakness'
    return { code, index, weakness, intellect: Number(def?.icons?.intellect || 0), known: Boolean(def) }
  })
  return { entries, discardable: entries.filter(entry => !entry.weakness) }
}

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
      criteria: [({ inv, context, state }) => {
        if (!context?.cardCode) return false
        if (context.location != null && context.location !== inv.location) return false
        if (state.investigators?.[context.seat]?.location !== inv.location) return false
        const { discardable } = handIconInfo(state, inv)
        if (!discardable.length) return false
        // state.cards 有这些手牌的定义时先过滤；没有时留给 resolve 用 api.cardIcons 判定。
        if (discardable.some(entry => entry.known)) {
          return discardable.reduce((sum, entry) => sum + entry.intellect, 0) >= 2
        }
        return true
      }],
      resolve: ({ inv, state, api, context }) => {
        const iconsOf = code => Number(api.cardIcons(code)?.intellect || 0)
        const isWeakness = code => {
          const subtype = state?.cards?.[code]?.subtype
          return subtype === 'weakness' || subtype === 'basicweakness'
        }
        const handIcons = () => (inv.hand || []).reduce((sum, code) => sum + (isWeakness(code) ? 0 : iconsOf(code)), 0)
        if (handIcons() < 2) {
          api.info(`${inv.name} 手牌上的智力图标不足 2 个。`)
          return
        }
        // 图标已校验 ≥2，逐张弃到足额；不再提供「放弃」分支（避免白弃牌）。
        let icons = 0
        let guard = 0
        while (icons < 2 && guard++ < 16) {
          const discardable = (inv.hand || [])
            .map((code, index) => ({ code, index, intellect: iconsOf(code) }))
            .filter(entry => !isWeakness(entry.code))
          if (!discardable.length) break
          const answer = api.choice({
            kind: 'discard', source: '05047', seat: inv.seat,
            prompt: `「杰罗姆·戴维斯」：弃掉手牌以取消这次显现（还需要 ${2 - icons} 个智力图标）。`,
            options: discardable.map(entry => ({
              id: String(entry.index), cardCode: entry.code,
              label: `${api.cardName(entry.code)}（智力 ${entry.intellect}）`,
            })),
          })
          const index = Number(answer)
          if (!Number.isInteger(index) || index < 0 || index >= inv.hand.length) break
          const [code] = inv.hand.splice(index, 1)
          inv.discard.push(code)
          icons += iconsOf(code)
        }
        if (icons < 2) return
        context.cancelled = true
        api.info(`${inv.name} 弃掉手牌，取消了「${api.cardName(context.cardCode)}」的显现效果。`)
      },
    },
  ],
  modifiers: [],
}
