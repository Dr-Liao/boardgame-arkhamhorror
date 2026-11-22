// 12061 幸运符（Lucky Charm）
// 卡面：使用(4充能)。
//       [fast] 花费1充能并横置幸运符：将 1 点伤害或 1 点恐惧从你所在地点的一张卡牌移动到
//       你控制的一张卡牌上（该卡牌须有生命或神智值）。
//
// 读点：
//   · 充能 → uses/usesType；花费 → cost.uses；横置 → cost.exhaust；
//   · 伤害/恐惧搬运 → api.moveHarm（api-misc 的 moveHarmBetween 唯一写点，端点为 { seat, assetId? }）；
//   · 「你所在地点的一张卡牌」= 同地点的调查员与在场上（各调查员控制）的支援；
//     「你控制、且有生命或神智值」= 你自己（调查员）或你控制、卡面带 health/sanity 的支援。
//     只允许在调查员/支援之间搬运（api.moveHarm 的端点形状；敌人的伤害不在该原语内，见近似说明）。
import { ALL_CARDS } from '../cards-data.js'

const CODE = '12061'
const KIND = { INVESTIGATOR: 'investigator', ASSET: 'asset', ENEMY: 'enemy' }

function sideOf(seat, kind, assetId = null) {
  return kind === KIND.INVESTIGATOR ? { seat, kind } : { seat, kind, assetId }
}

function labelOf(side) {
  if (side.kind === KIND.INVESTIGATOR) return `调查员（座位 ${side.seat}）`
  const def = ALL_CARDS[side.code]
  return def?.nameZh || def?.name || side.assetId
}

export default {
  code: CODE,
  uses: 4,
  usesType: 'charges',
  abilities: [
    {
      kind: 'free',
      cost: { uses: 1, exhaust: true },
      label: '花 1 充能并横置：把 1 点伤害/恐惧从你所在地点的一张牌移到你控制的一张牌上',
      resolve: ({ state, inv, api }) => {
        const here = inv.location
        // 来源：你所在地点的调查员与在场上支援。
        const sources = []
        for (const owner of state.investigators) {
          if (owner.location !== here) continue
          if ((owner.damage || 0) > 0 || (owner.horror || 0) > 0) {
            sources.push({ side: sideOf(owner.seat, KIND.INVESTIGATOR), damage: owner.damage || 0,
              horror: owner.horror || 0, label: owner.name })
          }
          for (const asset of owner.assets || []) {
            if ((asset.damage || 0) > 0 || (asset.horror || 0) > 0) {
              sources.push({ side: sideOf(owner.seat, KIND.ASSET, asset.id), damage: asset.damage || 0,
                horror: asset.horror || 0, code: asset.code, label: labelOf({ seat: owner.seat, kind: KIND.ASSET, assetId: asset.id, code: asset.code }) })
            }
          }
        // 批次 3（12061）：敌人身上的伤害也可作为来源（api.moveHarm 已支持 enemyId 端点）。
        for (const enemy of state.enemies || []) {
          if (enemy.location !== here || enemy.defeated) continue
          if ((enemy.damageTaken || 0) > 0) {
            sources.push({ side: { seat: inv.seat, kind: KIND.ENEMY, enemyId: enemy.id },
              damage: enemy.damageTaken || 0, horror: 0, label: enemy.name })
          }
        }
        }
        if (!sources.length) {
          api.info('你所在地点没有可搬运伤害/恐惧的卡牌。')
          return
        }
        const sourceId = sources.length === 1 ? '0' : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要搬走伤害/恐惧的卡牌（你所在地点）。',
          options: sources.map((source, index) => ({ id: String(index),
            label: `${source.label}（伤害 ${source.damage}／恐惧 ${source.horror}）` })),
        })
        const source = sources[Number(sourceId)] || sources[0]
        const kinds = []
        if (source.damage > 0) kinds.push('damage')
        if (source.horror > 0) kinds.push('horror')
        if (!kinds.length) return
        let kind = kinds[0]
        if (kinds.length > 1) {
          kind = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '搬运哪种伤害？',
            options: [{ id: 'damage', label: '1 点伤害' }, { id: 'horror', label: '1 点恐惧' }],
          })
          if (kind !== 'damage' && kind !== 'horror') return
        }
        // 目的地：你（调查员）或你控制、卡面带生命/神智的支援；按要搬运的类型过滤容量。
        const destinations = []
        for (const asset of inv.assets || []) {
          const def = ALL_CARDS[asset.code]
          if (!def) continue
          if (kind === 'damage' && !(Number(def.health) > 0)) continue
          if (kind === 'horror' && !(Number(def.sanity) > 0)) continue
          destinations.push({ side: sideOf(inv.seat, KIND.ASSET, asset.id), label: labelOf({ seat: inv.seat, kind: KIND.ASSET, assetId: asset.id, code: asset.code }) })
        }
        destinations.push({ side: sideOf(inv.seat, KIND.INVESTIGATOR), label: inv.name })
        let destination = destinations[0]
        if (destinations.length > 1) {
          const destinationId = api.choice({
            kind: 'target', source: CODE, seat: inv.seat,
            prompt: '选择要承受伤害/恐惧的卡牌（你控制、有生命或神智值）。',
            options: destinations.map((entry, index) => ({ id: String(index), label: entry.label })),
          })
          destination = destinations[Number(destinationId)] || destinations[0]
        }
        const from = source.side
        const to = destination.side
        if (from.seat === to.seat && from.kind === to.kind && from.assetId === to.assetId) return
        const amounts = kind === 'damage' ? { damage: 1 } : { horror: 1 }
        const moved = api.moveHarm(
          from.kind === KIND.ENEMY ? { seat: inv.seat, kind: 'enemy', enemyId: from.enemyId }
            : { seat: from.seat, ...(from.kind === KIND.ASSET ? { assetId: from.assetId } : {}) },
          { seat: to.seat, ...(to.kind === KIND.ASSET ? { assetId: to.assetId } : {}) },
          amounts,
        )
        if (moved && (moved.damage || moved.horror)) {
          api.info(`🍀「幸运符」：移动 ${moved.damage || 0} 点伤害、${moved.horror || 0} 点恐惧到「${destination.label}」。`)
        }
      },
    },
  ],
  modifiers: [],
}
