// 10079 摄魂抓魄（Bewitching）· 潜袭（Rogue）资产 · 3 经验 · 永久 · 卓越 · [[天赋]]/[[技巧]]
//
// 卡面：
//   永久。卓越。
//   [reaction] 你抽取起始手牌前：查找你的牌库，找出最多 3 张不同的 [[技巧]] 卡牌，将其正面朝下
//     附属到摄魂抓魄。混洗你的牌库。
//   [reaction] 在你与敌人进入交战状态时，横置摄魂抓魄：抽取 1 张附属的卡牌，或者查找你牌库顶
//     9 张卡牌，找出一张附属卡牌的同名卡牌，将其抽取并混洗你的牌库。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「永久」：cards-data 的 permanent 字段 + 条目 `passive.permanent`；开局循环把牌库里的永久卡
//     直接放进场（setup.js），随后结算 `setup` 描述子（与 03264 原定计划同一条读点）。
// 正面朝下存放在本卡下方。抽取底牌和查找牌库都通过对应的引擎入口。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10079'
const MAX_ATTACHED = 3
const SEARCH_TOP_COUNT = 9

const cardDefOf = code => ALL_CARDS[code] || null
const nameOf = code => cardDefOf(code)?.name || code
const hasTrait = (code, wanted) => (cardDefOf(code)?.traits || [])
  .some(trait => String(trait).toLowerCase() === wanted)
const isTrick = code => hasTrait(code, 'trick')

const attachedCodes = ({ seat }, host, api) => api.commitOrigins.beneath(seat, host.id)

export default {
  code: CODE,
  name: 'Bewitching',
  passive: { permanent: true },
  abilities: [
    {
      kind: 'setup',
      label: '开局（抽取起始手牌前）：查找牌库，把最多 3 张不同的[[技巧]]卡牌附属到「摄魂抓魄」',
      resolve: ({ inv, source, api }) => {
        const host = source || (inv.assets || []).find(card => card.code === CODE)
        if (!host) return
        const chosenNames = new Set(attachedCodes(inv, host, api).map(nameOf))
        while (attachedCodes(inv, host, api).length < MAX_ATTACHED) {
          const candidates = []
          const seen = new Set()
          for (const code of inv.deck || []) {
            if (!isTrick(code) || chosenNames.has(nameOf(code)) || seen.has(code)) continue
            seen.add(code)
            candidates.push(code)
          }
          if (!candidates.length) break
          const answer = api.choice({
            kind: 'card', source: CODE, seat: inv.seat, canSkip: true,
            prompt: `「摄魂抓魄」：选择要附属的[[技巧]]卡牌（已选 ${attachedCodes(inv, host, api).length}/${MAX_ATTACHED}）。`,
            options: [{ id: 'done', label: '完成附属' },
              ...candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))],
          })
          if (answer === 'done' || answer == null) break
          const picked = candidates.includes(answer) ? answer : candidates[0]
          if (!api.commitOrigins.store(inv.seat, host.id, picked, { from: 'deck', capacity: MAX_ATTACHED })) break
          chosenNames.add(nameOf(picked))
          api.info(`🎴 「摄魂抓魄」：将「${api.cardName(picked)}」正面朝下附属。`)
        }
        api.shuffleDeck(inv.seat)
        api.info(`🎴 「摄魂抓魄」：${attachedCodes(inv, host, api).length} 张[[技巧]]卡牌附属在它上面，牌库已混洗。`)
      },
    },
    {
      kind: 'reaction',
      legacyReaction: true,
      trigger: 'enemyEngaged',
      label: '与敌人交战时横置：抽取 1 张附属牌，或查找牌库顶 9 张的同名卡牌并抽取',
      cost: { exhaust: true },
      // legacyReaction 的 criteria 必须是函数（descriptorReactionSpec 只把函数转成 criteriaFn）。
      criteria: ({ source, state, inv }) => Boolean(state.scenarioFlags?.mechanics?.beneath?.[inv.seat]?.[source?.id]?.length),
      resolve: ({ state, inv, source, api }) => {
        const host = source || (inv.assets || []).find(card => card.code === CODE)
        if (!host) return
        const attached = attachedCodes(inv, host, api)
        if (!attached.length) {
          api.info('「摄魂抓魄」：上面没有附属卡牌。')
          return
        }
        const attachedNames = new Set(attached.map(nameOf))
        const modes = [
          { id: 'draw', label: '抽取 1 张附属卡牌' },
          { id: 'search', label: '查找牌库顶 9 张卡牌中的一张同名卡牌并抽取' },
        ]
        const mode = modes.length === 1 ? 'draw' : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「摄魂抓魄」：选择结算方式。', options: modes,
        })
        if (mode === 'search') {
          api.searchTop(inv.seat, {
            amount: SEARCH_TOP_COUNT, source: CODE, names: [...attachedNames],
            prompt: '「摄魂抓魄」：选择与附属牌同名的卡牌并抽取。',
          })
          return
        }
        // 附属里可能有同名多张：按 attachments 的顺序询问要抽回哪一张（同码副本效果等价）。
        const unique = [...new Set(attached)]
        const picked = unique.length === 1 ? unique[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '「摄魂抓魄」：选择要抽回手中的附属卡牌。',
          options: unique.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = unique.includes(picked) ? picked : unique[0]
        if (!api.commitOrigins.take(inv.seat, host.id, code, 'deck')) return
        api.drawCards(inv.seat, 1)
        api.info(`🎴 「摄魂抓魄」：抽取附属卡牌「${api.cardName(code)}」。`)
      },
    },
  ],
  modifiers: [],
}
