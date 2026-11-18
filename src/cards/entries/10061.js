// 10061 饥饿霉菌（Ravenous Myconid · 滋长菌株 Nurturing Strain）· 探寻者资产 · 4 经验 · 2 资源
// 卡面：
//   研究完成。每套牌库仅限 1 张。
//   [fast]：查找你的绑定卡牌，找出诡异疯长，并将其加入你的手牌。（每轮仅限一次。）
//   [fast] 移除饥饿霉菌上所有的生长：治愈饥饿霉菌上同等数量的伤害和/或恐惧，或者从你所在地点的
//   调查员或[[盟友]]支援身上，将同等数量的伤害和/或恐惧移动到饥饿霉菌上。
//
// 读点（卡面 → 引擎）：
//   · 生长标记 = 资产实例的 uses（usesType 'growth'）；读写只经 api.addUses。
//   · 「查找绑定卡牌」= api.bonded.retrieve；每轮一次 = limit 'oncePerRound'。
//   · 治愈自身 = api.healAsset（healDamageFrom / healHorrorFrom 统一入口，会开 damageHealed/
//     horrorHealed 窗口）；分配顺序与参考实现同序：伤害与恐惧总量不超过 N 时全部治愈，
//     否则逐点询问「伤害 / 恐惧」。
//   · 移动伤害/恐惧 = api.moveHarm（harm-transfer.js#moveHarm 的唯一读点；受目标剩余
//     health/sanity 容量限制，支援满值后走 asset-defeat 判定）。来源枚举 = 所在地点调查员 +
//     他们控制的[[盟友]]支援；目标固定为本卡。
//   · 研究完成 = 条目级 researchRequirement（campaign.js#researchRequirementFor 的唯一读点）；
//     记录键 'classifiedNewSpecies' 与基础卡 10044 的 api.recordResearch 写点同源（FHV P7 战役日志）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10061'
const GROWTH = 'growth'
const UNCANNY_GROWTH = '10045'

const growthOf = source => Math.max(0, Number(source?.uses) || 0)
const defOf = code => ALL_CARDS[code] || {}

const roomOf = source => ({
  damage: Math.max(0, (Number(defOf(source?.code).health) || 0) - (Number(source?.damage) || 0)),
  horror: Math.max(0, (Number(defOf(source?.code).sanity) || 0) - (Number(source?.horror) || 0)),
})

const isAllyCode = code => (defOf(code).traits || [])
  .some(trait => String(trait).toLowerCase() === 'ally')

// 所在地点可搬运的伤/恐来源（调查员本人与队友 + 他们控制的[[盟友]]支援）。
function harmSources(state, inv) {
  const out = []
  const here = (state.investigators || []).filter(other => !other.defeated && !other.resigned
    && other.location === inv.location)
  for (const other of here) {
    if ((other.damage || 0) + (other.horror || 0) > 0) {
      out.push({ key: `i${other.seat}`, label: other.name, spec: { seat: other.seat }, entity: other })
    }
    for (const asset of other.assets || []) {
      if (!isAllyCode(asset.code)) continue
      if ((asset.damage || 0) + (asset.horror || 0) <= 0) continue
      out.push({
        key: `a${asset.id}`, label: defOf(asset.code).nameZh || defOf(asset.code).name || asset.code,
        spec: { seat: other.seat, assetId: asset.id }, entity: asset,
      })
    }
  }
  return out
}

function searchUncannyGrowth({ inv, api }) {
  const taken = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
  if (taken.length) api.info(`🍄 饥饿霉菌：查找绑定卡牌，把「${api.cardName(UNCANNY_GROWTH)}」加入手牌。`)
  else api.info('🍄 饥饿霉菌：绑定卡牌「诡异疯长」不在场外集合里。')
}

// 治愈自身：N 点总量，按「伤害优先、剩余给恐惧」逐点分配；两种都有且预算不够时询问。
function healMyconid({ seat, source, api, budget }) {
  let remaining = budget
  let damage = 0
  let horror = 0
  while (remaining > 0) {
    const currentDamage = Math.max(0, Number(source.damage) || 0) - damage
    const currentHorror = Math.max(0, Number(source.horror) || 0) - horror
    if (currentDamage + currentHorror <= 0) break
    if (currentDamage + currentHorror <= remaining) {
      damage += currentDamage
      horror += currentHorror
      remaining = 0
      break
    }
    if (currentDamage === 0) { horror += Math.min(remaining, currentHorror); remaining = 0; break }
    if (currentHorror === 0) { damage += Math.min(remaining, currentDamage); remaining = 0; break }
    const kind = api.choice({
      kind: 'effect', source: CODE, seat,
      prompt: `饥饿霉菌：选择第 ${budget - remaining + 1} 点治愈合的伤害或恐惧。`,
      options: [{ id: 'damage', label: '治愈 1 点伤害' }, { id: 'horror', label: '治愈 1 点恐惧' }],
    })
    if (kind === 'horror') horror += 1
    else damage += 1
    remaining -= 1
  }
  if (damage || horror) api.healAsset(source, { damage, horror })
  api.info(`💚 饥饿霉菌：治愈自身 ${damage} 点伤害、${horror} 点恐惧。`)
}

// 把同地点调查员/盟友身上的伤害或恐惧搬到本卡上（逐点选择来源与类型）。
function moveHarmToMyconid({ state, inv, source, api, budget }) {
  const room = api.harmRoomOf({ seat: inv.seat, assetId: source.id })
  let remaining = budget
  let movedDamage = 0
  let movedHorror = 0
  while (remaining > 0) {
    const options = []
    for (const entry of harmSources(state, inv)) {
      const damage = Math.max(0, Number(entry.entity.damage) || 0)
      const horror = Math.max(0, Number(entry.entity.horror) || 0)
      if (damage > 0 && movedDamage < room.damage) {
        options.push({ id: `${entry.key}:damage`, label: `从「${entry.label}」移动 1 点伤害` })
      }
      if (horror > 0 && movedHorror < room.horror) {
        options.push({ id: `${entry.key}:horror`, label: `从「${entry.label}」移动 1 点恐惧` })
      }
    }
    if (!options.length) break
    const pick = options.length === 1 ? options[0].id : api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '饥饿霉菌：选择要移动到它身上的伤害或恐惧。',
      options: [...options, { id: 'stop', label: '停止移动' }],
    })
    if (pick === 'stop') break
    const separator = pick.lastIndexOf(':')
    const key = pick.slice(0, separator)
    const kind = pick.slice(separator + 1)
    const entry = harmSources(state, inv).find(item => item.key === key)
    if (!entry || (kind !== 'damage' && kind !== 'horror')) break
    const applied = api.moveHarm(entry.spec, { seat: inv.seat, assetId: source.id }, { [kind]: 1 })
    const count = applied?.[kind] || 0
    if (!count) break
    if (kind === 'damage') movedDamage += count
    else movedHorror += count
    remaining -= count
  }
  api.info(`🍄 饥饿霉菌：从同地点调查员/盟友身上移来 ${movedDamage} 点伤害、${movedHorror} 点恐惧。`)
}

export default {
  code: CODE,
  name: 'Ravenous Myconid (Nurturing Strain)',
  researchRequirement: 'classifiedNewSpecies',
  uses: 0,
  usesType: GROWTH,
  abilities: [
    {
      kind: 'free',
      fast: true,
      label: '查找绑定卡牌，找出诡异疯长加入手牌（每轮一次）',
      limit: 'oncePerRound',
      cost: { action: false },
      criteria: [({ inv, helpers }) => helpers.bondedAvailable(inv.seat, CODE, UNCANNY_GROWTH) > 0],
      resolve: searchUncannyGrowth,
    },
    {
      kind: 'free',
      fast: true,
      label: '移除全部生长：治愈自身等量伤/恐，或把同地点调查员/盟友的等量伤/恐移到它身上',
      cost: { action: false },
      criteria: [({ state, inv, source }) => {
        if (growthOf(source) <= 0) return false
        if ((Number(source?.damage) || 0) + (Number(source?.horror) || 0) > 0) return true
        const room = roomOf(source)
        if (room.damage <= 0 && room.horror <= 0) return false
        return harmSources(state, inv).some(entry => ((entry.entity.damage || 0) > 0 && room.damage > 0)
          || ((entry.entity.horror || 0) > 0 && room.horror > 0))
      }],
      resolve: ({ state, inv, source, api }) => {
        const budget = growthOf(source)
        api.addUses(source, -budget)
        const canHeal = (Number(source?.damage) || 0) + (Number(source?.horror) || 0) > 0
        const room = api.harmRoomOf({ seat: inv.seat, assetId: source.id })
        const canMove = (room.damage > 0 || room.horror > 0)
          && harmSources(state, inv).some(entry => ((entry.entity.damage || 0) > 0 && room.damage > 0)
            || ((entry.entity.horror || 0) > 0 && room.horror > 0))
        const options = []
        if (canHeal) options.push({ id: 'heal', label: `治愈饥饿霉菌自身 ${budget} 点伤害/恐惧` })
        if (canMove) options.push({ id: 'move', label: `把同地点调查员/盟友的至多 ${budget} 点伤害/恐惧移到饥饿霉菌上` })
        if (!options.length) {
          api.info('🍄 饥饿霉菌：移除全部生长，但没有可治愈或可移动的伤害/恐惧。')
          return
        }
        const mode = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `饥饿霉菌：移除 ${budget} 个生长，选择结算方式。`, options,
        })
        if (mode === 'heal') healMyconid({ seat: inv.seat, source, api, budget })
        else moveHarmToMyconid({ state, inv, source, api, budget })
      },
    },
  ],
  modifiers: [],
}