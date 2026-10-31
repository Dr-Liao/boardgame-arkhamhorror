// 万千骇形（06168）· 混乱标记的逐章取值与失败后果（参考 AThousandShapesOfHorror.hs:51-165）。
//
// 卡面（en locale tokens）：
//   简单/普通：skull -1（位于[[墓地]]地点时 -3）；cultist 无修正（再揭示一个标记，失败且不可名状之物在场时它攻击你）；
//            tablet +2（成功时选择并躲避任意地点一个攻击值 ≤ 成功点数的敌人）；elder_thing -2（失败：放 1 线索或 1 伤害）。
//   困难/专家：skull -2（墓地 -4）；tablet +1；elder_thing -3。
// `behavior.resolveChaosToken` 只算数值；后果放 `behavior.afterTest`（引擎在自动失败/正常路径各调一次，按 result 幂等）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'

const originalOf = card => card?.originalCode || card?.code
const hardSide = state => state?.difficulty === 'hard' || state?.difficulty === 'expert'
const THE_UNNAMABLE = '06169b'

function traitsOfLocation(state, inv) {
  const location = (state.locations || []).find(item => item.id === inv?.location)
  if (!location) return []
  return (location.traits || ALL_CARDS[originalOf(location)]?.traits || []).map(trait => String(trait).toLowerCase())
}

const atGraveyard = (state, inv) => traitsOfLocation(state, inv).includes('graveyard')

export function tshChaosToken(state, inv, token) {
  const hard = hardSide(state)
  switch (token) {
    case 'skull': {
      const graveyard = atGraveyard(state, inv)
      return graveyard ? (hard ? -4 : -3) : (hard ? -2 : -1)
    }
    case 'cultist':
      return null // 无修正；「再揭示一个标记 + 失败时不可名状之物攻击」在 afterTest 结算。
    case 'tablet':
      return hard ? 1 : 2
    case 'elder_thing':
      return hard ? -3 : -2
    default:
      return null
  }
}

// 技能检定后的后果（参考 FailedSkillTest / PassedSkillTest 分支）。
export function tshChaosAfterTest(state, inv, result, api) {
  if (!result || !inv) return
  if (result.tshChaosHandled) return
  result.tshChaosHandled = true
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  const has = token => tokens.includes(token)
  const failed = !result.success

  // [cultist]：再揭示一个标记（引擎没有剧本级的额外揭示原语，记 simplified）；失败且不可名状之物在场 → 它攻击你。
  if (failed && has('cultist')) {
    const unnamable = (state.enemies || []).find(enemy => String(originalOf(enemy)) === THE_UNNAMABLE && !enemy.defeated)
    if (unnamable) {
      api.attack?.(unnamable, inv)
      api.info?.(`👁️ [cultist]：不可名状之物攻击 ${inv.name}（无论其当前地点）。`)
    }
  }

  // [elder_thing]：失败 → 你必须将你的 1 个线索放到你所在地点，或受到 1 点伤害。
  if (failed && has('elder_thing')) {
    const options = []
    if ((inv.clues || 0) > 0 && inv.location) options.push({ id: 'clue', label: '将你的 1 个线索放到你所在地点' })
    options.push({ id: 'damage', label: '受到 1 点伤害' })
    const answer = options.length === 1 ? options[0].id : api.choice?.({
      kind: 'cost', source: '06168-elderthing', seat: inv.seat,
      prompt: '[elder_thing]：将 1 个线索放到你所在地点，或受到 1 点伤害。', options,
    })
    if (answer === 'clue' && (inv.clues || 0) > 0) {
      api.spendClues?.(inv.seat, 1)
      api.addCluesToLocation?.(inv.location, 1)
      api.info?.(`🧿 [elder_thing]：${inv.name} 把 1 个线索放到了所在地点。`)
    } else {
      api.damage?.(inv.seat, 1)
      api.info?.(`🧿 [elder_thing]：${inv.name} 受到 1 点伤害。`)
    }
  }

  // [tablet]：成功 → 选择并躲避任意地点一个攻击值 ≤ 成功点数的敌人。
  if (result.success && has('tablet')) {
    const successBy = Math.max(0, Number(result.value || 0) - Number(result.difficulty || 0))
    if (successBy <= 0) return
    const candidates = (state.enemies || []).filter(enemy => {
      if (enemy.defeated) return false
      const fight = Number(api.enemyFight?.(enemy, inv.seat) ?? enemy.fight ?? 0)
      return fight >= 0 && fight <= successBy
    })
    if (!candidates.length) return
    const pick = api.choice?.({
      kind: 'enemy', source: '06168-tablet', seat: inv.seat,
      prompt: `[tablet]：黑猫掩护你，选择并躲避任意地点一个攻击值 ≤ ${successBy} 的敌人。`,
      options: [
        { id: 'skip', label: '不躲避' },
        ...candidates.map(enemy => ({ id: String(enemy.id), label: `${enemy.name}（攻击 ${api.enemyFight?.(enemy, inv.seat) ?? enemy.fight ?? 0}）` })),
      ],
    })
    const enemy = candidates.find(candidate => String(candidate.id) === String(pick))
    if (!enemy) return
    api.evadeEnemy?.(enemy)
    api.info?.(`🐈 [tablet]：${inv.name} 选择并躲避了「${enemy.name}」。`)
  }
}
