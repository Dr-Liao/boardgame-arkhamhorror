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
//   · 「查找牌库，把最多 3 张不同[[技巧]]卡牌附属」：api.attachCardFromDeck(host, code)
//     （api-misc.js；从牌库取走并写 host.attachments 的唯一写点，04021 爱丽同源），最后 api.shuffleDeck。
//   · 「与你进入交战状态时」：legacyReaction + trigger 'enemyEngaged'（enemies.js#engageEnemy 里
//     triggerReaction 的唯一派发点；react window 的提示与费用由 triggerReaction 统一结算）。
//     横置费写 `cost: { exhaust: true }`。
//   · 「抽取 1 张附属卡牌」：api.moveCard({ from: 'attached', to: 'hand' })（deck-ops.js 的 B6 搬运原语；
//     findZoneCard 会扫描宿主支援的 attachments，与「附属」写入端同一个存储形状）。
//   · 「查找牌库顶 9 张的同名卡牌并抽取」：api.topDeckCodes（只读牌库顶）+ api.moveCard 抽取 +
//     api.shuffleDeck；同名判定用 api.cardName（重名判等，与印刷「a copy」一致）。
//
// 显式简化（simplified，见 note）：
//   1. 附属的 3 张牌存在 host.attachments（引擎没有「压在支援下、正面朝下」的独立区域），因此它们在
//      牌桌/详情里是可见的，也会被 ability-rules#descriptorSources 当作宿主附属能力来源枚举；
//      印刷的「正面朝下」只是信息隐藏，规则效果（抽回手中）不受影响。
//   2. 第二模式用 topDeckCodes + moveCard 搬运，没有走 searchTop 的「查找窗口/抽牌管线」
//      （缺 searchTop 的按卡号/同名筛选参数）；见 primitive-requests/10079.json。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10079'
const MAX_ATTACHED = 3
const SEARCH_TOP_COUNT = 9

const cardDefOf = code => ALL_CARDS[code] || null
const nameOf = code => cardDefOf(code)?.name || code
const hasTrait = (code, wanted) => (cardDefOf(code)?.traits || [])
  .some(trait => String(trait).toLowerCase() === wanted)
const isTrick = code => hasTrait(code, 'trick')

const attachedCodes = host => (host?.attachments || []).map(card => card.code)

export default {
  code: CODE,
  name: 'Bewitching',
  passive: { permanent: true },
  simplified: true,
  note: 'simplified: 附属牌存 host.attachments（引擎无「正面朝下压在支援下」的独立区域，界面可见且会被当作能力来源）；第二模式用 topDeckCodes + moveCard 代替 searchTop（缺同名/卡号筛选参数），未开查找窗口、不走抽牌管线；见 primitive-requests/10079.json',
  abilities: [
    {
      kind: 'setup',
      label: '开局（抽取起始手牌前）：查找牌库，把最多 3 张不同的[[技巧]]卡牌附属到「摄魂抓魄」',
      resolve: ({ state, inv, source, api }) => {
        const host = source || (inv.assets || []).find(card => card.code === CODE)
        if (!host) return
        const chosenNames = new Set(attachedCodes(host).map(nameOf))
        for (let guard = 0; guard < 20 && attachedCodes(host).length < MAX_ATTACHED; guard++) {
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
            prompt: `「摄魂抓魄」：选择要附属的[[技巧]]卡牌（已选 ${attachedCodes(host).length}/${MAX_ATTACHED}）。`,
            options: [{ id: 'done', label: '完成附属' },
              ...candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) }))],
          })
          if (answer === 'done' || answer == null) break
          const picked = candidates.includes(answer) ? answer : candidates[0]
          if (!api.attachCardFromDeck(host, picked)) break
          chosenNames.add(nameOf(picked))
          api.info(`🎴 「摄魂抓魄」：将「${api.cardName(picked)}」正面朝下附属。`)
        }
        api.shuffleDeck(inv.seat)
        api.info(`🎴 「摄魂抓魄」：${attachedCodes(host).length} 张[[技巧]]卡牌附属在它上面，牌库已混洗。`)
      },
    },
    {
      kind: 'reaction',
      legacyReaction: true,
      trigger: 'enemyEngaged',
      label: '与敌人交战时横置：抽取 1 张附属牌，或查找牌库顶 9 张的同名卡牌并抽取',
      cost: { exhaust: true },
      // legacyReaction 的 criteria 必须是函数（descriptorReactionSpec 只把函数转成 criteriaFn）。
      criteria: ({ source }) => Boolean(source) && attachedCodes(source).length > 0,
      resolve: ({ state, inv, source, api }) => {
        const host = source || (inv.assets || []).find(card => card.code === CODE)
        if (!host) return
        const attached = attachedCodes(host)
        if (!attached.length) {
          api.info('「摄魂抓魄」：上面没有附属卡牌。')
          return
        }
        const attachedNames = new Set(attached.map(nameOf))
        const topNine = api.topDeckCodes(inv.seat, SEARCH_TOP_COUNT)
        const copies = [...new Set(topNine.filter(code => attachedNames.has(nameOf(code))))]
        const modes = [{ id: 'draw', label: '抽取 1 张附属的卡牌' }]
        if (copies.length) {
          modes.push({ id: 'search', label: `查找牌库顶 ${SEARCH_TOP_COUNT} 张，找出一张附属卡牌的同名卡并抽取` })
        }
        const mode = modes.length === 1 ? 'draw' : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '「摄魂抓魄」：选择结算方式。', options: modes,
        })
        if (mode === 'search') {
          const picked = copies.length === 1 ? copies[0] : api.choice({
            kind: 'card', source: CODE, seat: inv.seat,
            prompt: '「摄魂抓魄」：选择要抽取的同名卡牌。',
            options: copies.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
          })
          const code = copies.includes(picked) ? picked : copies[0]
          if (!api.moveCard({ code, from: 'deck', to: 'hand', ownerSeat: inv.seat })) return
          api.shuffleDeck(inv.seat)
          api.info(`🎴 「摄魂抓魄」：从牌库顶 ${SEARCH_TOP_COUNT} 张里找出并抽取「${api.cardName(code)}」，牌库已混洗。`)
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
        if (!api.moveCard({ code, from: 'attached', to: 'hand', ownerSeat: inv.seat })) return
        api.info(`🎴 「摄魂抓魄」：抽取附属卡牌「${api.cardName(code)}」。`)
      },
    },
  ],
  modifiers: [],
}
