// 10115 阴差阳错（Wrong Place, Right Time）· 潜袭者事件 · 0 经验 · 0 资源 · 精怪/Double
// 卡面：作为打出阴差阳错的额外费用，花费一个行动。
//       将你调查员上最多 5 点伤害和/或恐惧移动到你所在地点的调查员控制的支援上。
//       每有一个支援被此效果击败，抽取 1 张卡牌。将阴差阳错从游戏中移除。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「Double：额外花费 1 行动」= played.cost.action: 1（ability.js#playedActionCost）。
//   · 「移动伤害/恐惧到支援」= api.moveHarm({ seat }, { seat, assetId }, { damage|horror: 1 })
//     （harm-transfer.js 的唯一「移动」原语：不触发受到伤害窗口、受目标容量限制，
//     并在目标支援达到上限时调 asset-defeat.js#checkAssetDefeated）。
//   · 容量枚举 = api.harmRoomOf({ seat, assetId })（与 moveHarm 同一份 harmRoom 口径）。
//   · 「被此效果击败 → 抽 1」= moveHarm 后目标不在控制者 assets 里即被击败（asset-defeat.js
//     的离场/弃置路径），此时 api.drawCards(seat, 1)。
//   · 「从游戏中移除」= 条目 removeAfterPlay（doPlay 收尾段的唯一去向读点）。
//   · 交互：每次移动 1 点，最多 5 次；每次列出「对某支援造成 1 伤害 / 1 恐惧 / 停止」。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10115'
const MAX_HARM = 5

function holdersHere(state, inv) {
  return (state.investigators || []).filter(owner => owner.location === inv.location
    && !owner.defeated && !owner.resigned)
}

function candidates(state, inv, api) {
  return holdersHere(state, inv).flatMap(owner => (owner.assets || []).map(asset => ({
    owner, asset, room: api.harmRoomOf({ seat: owner.seat, assetId: asset.id }),
  })))
}

// playCondition 拿不到 api：用卡面的 health/sanity 粗判「有支援能承接伤害/恐惧」，
// 精确的剩余容量在 resolve 里用 api.harmRoomOf 读取（与 moveHarm 同一份 harmRoom 口径）。
function hasRoomCandidate(state, inv) {
  return holdersHere(state, inv).some(owner => (owner.assets || []).some(asset => {
    const def = ALL_CARDS[asset.code]
    return (Number(def?.health) || 0) > 0 || (Number(def?.sanity) || 0) > 0
  }))
}

export default {
  code: CODE,
  name: 'Wrong Place, Right Time',
  removeAfterPlay: true,
  playCondition: [{
    when: ({ state, inv }) => ((Number(inv.damage) || 0) + (Number(inv.horror) || 0)) > 0 && hasRoomCandidate(state, inv),
    message: '你身上没有伤害/恐惧，或同地点没有可承接伤害/恐惧的支援',
  }],
  abilities: [
    {
      kind: 'played',
      cost: { action: 1 },
      label: 'Double：额外花费 1 行动；把你身上最多 5 点伤害/恐惧移到同地点调查员控制的支援上；每击败一个支援抽 1 张，然后移出游戏',
      resolve: ({ state, inv, api }) => {
        let remaining = Math.min(MAX_HARM, (Number(inv.damage) || 0) + (Number(inv.horror) || 0))
        let defeated = 0
        while (remaining > 0) {
          const pool = candidates(state, inv, api).filter(entry => entry.room.damage > 0 || entry.room.horror > 0)
          const options = []
          if ((Number(inv.damage) || 0) > 0) {
            for (const { owner, asset, room } of pool) {
              if (room.damage <= 0) continue
              options.push({ id: `damage:${asset.id}`, label: `对${owner.name}的「${api.cardName(asset.code)}」移动 1 点伤害（还可承受 ${room.damage}）` })
            }
          }
          if ((Number(inv.horror) || 0) > 0) {
            for (const { owner, asset, room } of pool) {
              if (room.horror <= 0) continue
              options.push({ id: `horror:${asset.id}`, label: `对${owner.name}的「${api.cardName(asset.code)}」移动 1 点恐惧（还可承受 ${room.horror}）` })
            }
          }
          options.push({ id: 'stop', label: '停止移动' })
          if (options.length === 1) break
          const pick = api.choice({
            kind: 'target', source: CODE, seat: inv.seat,
            prompt: `「阴差阳错」：还可移动 ${remaining} 点伤害/恐惧，选择目标（或停止）。`,
            options,
          })
          if (pick === 'stop') break
          const [kind, assetId] = String(pick || '').split(':')
          if (!['damage', 'horror'].includes(kind)) break
          const picked = pool.find(entry => entry.asset.id === assetId)
          if (!picked) break
          const applied = api.moveHarm(
            { seat: inv.seat },
            { seat: picked.owner.seat, assetId: picked.asset.id },
            kind === 'damage' ? { damage: 1 } : { horror: 1 },
          )
          if (!(applied?.damage || applied?.horror)) break
          remaining -= 1
          if (!(picked.owner.assets || []).includes(picked.asset)) {
            defeated += 1
            api.drawCards(inv.seat, 1)
            api.info(`🃏 「阴差阳错」：「${api.cardName(picked.asset.code)}」被击败，你抽取 1 张卡牌。`)
          }
        }
        if (defeated > 0) api.info(`🃏 「阴差阳错」：共击败 ${defeated} 个支援。`)
      },
    },
  ],
  modifiers: [],
}
