// 10104 所罗门之钥（The Key of Solomon · 未知秘密）· 神秘者支援 · 2 资源 · 4 经验 · 手部
//   [[道具]]/[[书籍]]/[[祝福]]/[[诅咒萦绕]] · 独一无二
// 卡面：
//   [fast] 如果混乱袋中 [bless] 标记多于 [curse] 标记：从混乱袋中移除 1 个 [bless] 标记并横置所罗门之钥：
//          治愈你所在地点的一位调查员或一个 [[盟友]] 支援最多 2 点伤害和/或恐惧。
//   [fast] 如果混乱袋中 [curse] 标记多于 [bless] 标记：从混乱袋中移除 1 个 [curse] 标记并横置所罗门之钥：
//          获得 2 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「[fast]」= kind:'free'（descriptorCost 把 free 的行动费压成 0；legalMoves / 玩家窗口同一读点），
//     费用「横置」= cost.exhaust（ability-rules.js#payAbilityCost）。
//   · 「袋中 [bless] 多于 [curse]」= 读 state.chaosBag 的计数，写进描述子 criteria
//     （不可用时该能力不出现，与卡面「如果……」一致）。
//   · 「从混乱袋中移除 1 个 [bless]/[curse]」= api.chaosTokens.pay(token, 1)
//     （chaos-token-pool.js#payPoolTokens 是袋内标记移除的唯一写点）。
//   · 「治愈最多 2 点伤害和/或恐惧」= api.healDamage / api.healHorror（调查员）与 api.healAsset
//     （支援，harm-threat.js 的统一治疗入口），逐点选择目标与类型（伤害/恐惧）。
//   · 「一位调查员或一个 [[盟友]] 支援，在你所在地点」= 目标枚举按 inv.location 过滤；
//     [[盟友]] 特性用卡面数据 traits 判定（与 10024 同一口径）。
//   · 「获得 2 资源」= api.gainResources。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10104'
const BLESS = 'bless'
const CURSE = 'curse'

const bagCount = (state, token) => (state.chaosBag || []).filter(face => face === token).length
const moreBless = state => bagCount(state, BLESS) > bagCount(state, CURSE)
const moreCurse = state => bagCount(state, CURSE) > bagCount(state, BLESS)

const isAlly = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'ally')

// 「你所在地点的一位调查员或一个 [[盟友]] 支援」：只列仍有伤害/恐惧可治愈的目标。
function healTargets(state, inv) {
  const here = (state.investigators || []).filter(other => !other.defeated && !other.resigned
    && other.location === inv.location)
  const targets = []
  for (const other of here) {
    const damage = Number(other.damage) || 0
    const horror = Number(other.horror) || 0
    if (damage > 0 || horror > 0) {
      targets.push({
        id: `seat:${other.seat}`, seat: other.seat, damage, horror,
        label: `${other.name}（伤害 ${damage}／恐惧 ${horror}）`,
      })
    }
    for (const card of other.assets || []) {
      if (!isAlly(card.code)) continue
      const cardDamage = Number(card.damage) || 0
      const cardHorror = Number(card.horror) || 0
      if (!cardDamage && !cardHorror) continue
      targets.push({
        id: `asset:${card.id}`, asset: card, owner: other, damage: cardDamage, horror: cardHorror,
        label: `${ALL_CARDS[card.code]?.nameZh || ALL_CARDS[card.code]?.name || card.code}（伤害 ${cardDamage}／恐惧 ${cardHorror}）`,
      })
    }
  }
  return targets
}

function healUpToTwo(state, inv, api) {
  let healed = 0
  for (let point = 0; point < 2; point++) {
    const targets = healTargets(state, inv)
    if (!targets.length) break
    const picked = targets.length === 1 ? targets[0].id : api.choice({
      kind: 'target', source: CODE, seat: inv.seat, canSkip: true,
      prompt: `所罗门之钥：选择要治愈的目标（第 ${point + 1} 点）。`,
      options: [{ id: 'skip', label: '不再治疗' },
        ...targets.map(target => ({ id: target.id, label: target.label }))],
    })
    if (picked === 'skip') break
    const target = targets.find(item => item.id === picked)
    if (!target) break
    let kind = target.damage > 0 && target.horror > 0 ? null : target.damage > 0 ? 'damage' : 'horror'
    if (!kind) {
      kind = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: `所罗门之钥：治愈「${target.label}」1 点伤害还是 1 点恐惧？`,
        options: [{ id: 'damage', label: '伤害' }, { id: 'horror', label: '恐惧' }],
      }) === 'horror' ? 'horror' : 'damage'
    }
    if (target.asset) {
      api.healAsset(target.asset, { [kind]: 1, owner: target.owner })
    } else if (kind === 'damage') api.healDamage(target.seat, 1)
    else api.healHorror(target.seat, 1)
    api.info(`🗝️ 「所罗门之钥」：治愈 ${target.label} 1 点${kind === 'damage' ? '伤害' : '恐惧'}。`)
    healed += 1
  }
  if (!healed) api.info('🗝️ 「所罗门之钥」：所在地点没有可治愈的目标。')
}

export default {
  code: CODE,
  name: '所罗门之钥',
  abilities: [
    {
      kind: 'free',
      label: '快速：袋中祝福多于诅咒，移除 1 个祝福并横置：治愈 2 点伤害/恐惧',
      cost: { action: false, exhaust: true },
      criteria: [({ state }) => moreBless(state)],
      resolve: ({ state, inv, api }) => {
        if (api.chaosTokens.pay(BLESS, 1) !== 1) {
          api.info('「所罗门之钥」：混乱袋中没有可移除的祝福标记。')
          return
        }
        api.info('🗝️ 「所罗门之钥」：移除 1 个祝福标记，治愈所在地点的调查员或[[盟友]]。')
        healUpToTwo(state, inv, api)
      },
    },
    {
      kind: 'free',
      label: '快速：袋中诅咒多于祝福，移除 1 个诅咒并横置：获得 2 资源',
      cost: { action: false, exhaust: true },
      criteria: [({ state }) => moreCurse(state)],
      resolve: ({ inv, api }) => {
        if (api.chaosTokens.pay(CURSE, 1) !== 1) {
          api.info('「所罗门之钥」：混乱袋中没有可移除的诅咒标记。')
          return
        }
        api.gainResources(inv.seat, 2)
        api.info('🗝️ 「所罗门之钥」：移除 1 个诅咒标记，获得 2 资源。')
      },
    },
  ],
  modifiers: [],
}
