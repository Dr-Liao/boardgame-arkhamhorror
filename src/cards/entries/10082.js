// 10082 假证（Fake Credentials）· 潜袭（Rogue）资产 · 2 资源 · 4 经验 · 手部槽位 · [[道具]]/[[违法]]
//
// 卡面：
//   [action] 选择你所在地点的一个敌人：谈判。检定 [intellect](0)。假证上每有 1 疑点，本次检定难度 +1。
//   如果你检定成功，发现你所在地点或一个连接地点的 1 个线索。如果你没有成功至少 2 点，
//   在假证上放置 1 资源，作为疑点。如果你检定失败，将假证返回你的手牌。
//
// 一条行为的读点（卡面 → 引擎）：
//   · 「[action] 谈判」：kind:'action' + actionKind:'parley' + cost:{ action: true }；
//     目标写 `target: { kind: 'enemy' }`（同地点敌人，legalMoves / validateMove / 执行共用同一份枚举）。
//   · 「检定 [intellect](0)，每有 1 疑点难度 +1」：api.test(seat, 'intellect', suspicion) ——
//     performTest 是唯一检定入口，难度就是本次检定的 difficulty。
//   · 「成功：在你所在地点或一个连接地点发现 1 个线索」：api.discoverClue(seat, 1, locationId)
//     （locations.js#discoverClueAt 的唯一写点；连接地点由 state.locations 的连接图给出）。
//   · 「没有成功至少 2 点 → 放置 1 资源作为疑点」：结果契约的 successBy
//     （docs/card-model.md §6.1：result.summary.successBy = value - difficulty），
//     失败时 successBy 视为不足 2（与「did not succeed by 2 or more」一致）。疑点存在卡实例的
//     数值位上（api.addUses），见 note。
//   · 「检定失败 → 返回手牌」：api.returnAssetToHand(seat, card)（api-misc.js：leaveAsset + putInHand，
//     支援离场钩子照常结算的唯一返回手牌原语）。
//
// 疑点由具名卡牌资源计数器记录。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10082'

const nameOf = code => ALL_CARDS[code]?.name || code
const suspicionOf = card => Math.max(0, Number(card?.useTokens?.suspicion ?? card?.uses) || 0)

export default {
  code: CODE,
  name: 'Fake Credentials',
  abilities: [
    {
      kind: 'action',
      actionKind: 'parley',
      countsAs: 'parley',
      label: '谈判：检定[智力]（难度 = 疑点数），成功发现线索；未超出 2 点则放置疑点；失败返回手牌',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ state, inv, source, context, api }) => {
        const card = source || (inv.assets || []).find(asset => asset.code === CODE)
        if (!card) return
        const enemies = api.enemiesAt(inv.location)
        const picked = (context?.targetId != null && enemies.find(enemy => enemy.id === context.targetId))
          || enemies[0]
        if (!picked) {
          api.info('「假证」：你所在地点没有敌人。')
          return
        }
        const suspicion = suspicionOf(card)
        const result = api.test(inv.seat, 'intellect', suspicion, {
          source: { type: 'effect', enemyId: picked.id, code: CODE, label: `假证（${nameOf(CODE)}）` },
          actionKind: 'parley',
        })
        const summary = result?.summary || {}
        if (summary.success) {
          const here = (state.locations || []).find(location => location.id === inv.location)
          const connections = [...new Set(here?.connections || [])]
            .filter(id => (state.locations || []).some(location => location.id === id))
          const destinations = [inv.location, ...connections]
          const locationId = destinations.length === 1 ? destinations[0] : api.choice({
            kind: 'location', source: CODE, seat: inv.seat,
            prompt: '「假证」：在你所在地点或一个连接地点发现 1 个线索。',
            options: destinations.map(id => ({ id, label: api.scenario.locationName(id) })),
          })
          const target = destinations.includes(locationId) ? locationId : destinations[0]
          const got = api.discoverClue(inv.seat, 1, target)
          api.info(got
            ? `🪪 「假证」：在「${api.scenario.locationName(target)}」发现 1 个线索。`
            : `🪪 「假证」：「${api.scenario.locationName(target)}」没有可发现的线索。`)
        }
        // 「If you did not succeed by 2 or more, place 1 resource on Fake Credentials, as suspicion.」
        if (!summary.success || Number(summary.successBy) < 2) {
          const next = suspicion + 1
          api.placeUse(card, 'suspicion', card.useTokens?.suspicion == null ? next : 1)
          api.info(`🪪 「假证」：在它上面放置 1 个疑点（当前 ${next}，之后每次检定难度 +${next}）。`)
        }
        if (!summary.success) {
          if (api.returnAssetToHand(inv.seat, card)) {
            api.info('🪪 「假证」：检定失败，假证返回你的手牌。')
          }
        }
      },
    },
  ],
  modifiers: [],
}
