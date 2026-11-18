// 10024 赦免（Absolution）· 守卫者事件 · 0 经验 · 法术/祝福萦绕 · 费用 X
// 卡面：从混乱袋中随机揭示 3 个标记和额外 X 个标记。
//       每揭示一个非符号标记，在混乱袋里加入 1 个 [bless] 标记。每揭示一个 [bless] 标记，治愈你
//       所在地点的调查员或 [[盟友]] 支援 1 点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · X 费用：cards-data 的 cost < 0 表示动态费用；条目声明 `chooseResourceCostOnPlay: true`
//     （actions.js#payPlayCost 支付前询问 X 并扣除 X 资源），实际支付的 X 从 played 描述子的
//     `context.playCost.cost` 读回（09087/02010 同一读点）。
//   · 「不生成检定的随机揭示 N 个标记」：`api.revealChaosTokens(n)`（api-card.js 的一次性揭示
//     原语：beginChaosTest → drawChaosToken × n → endChaosTest，返回实际揭示的标记面）。
//   · 非符号标记 = 数字标记（+N / 0 / -N）；符号标记是骷髅/教徒/石板/古神/旧印/自动失败/祝福/诅咒/
//     霜寒，故「非符号」只匹配数字面。
//   · 加入祝福：`api.chaosTokens.add('bless', n)`（标记池唯一写点）。
//   · 治愈 1 点恐惧：调查员走 `api.healHorror(seat, 1)`，[[盟友]]支援走 `api.healAsset(asset,
//     { horror: 1, owner })`（harm-threat.js 的统一治疗入口）；目标按卡面枚举「你所在地点」的
//     调查员与盟友支援，逐点选择。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10024'
const BLESS = 'bless'
const NUMERIC = /^[+-]?\d+$/

const isNumericToken = token => NUMERIC.test(String(token))
const isAlly = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'ally')

// 「你所在地点的调查员或 [[盟友]] 支援」：只收仍可被治愈恐惧的目标。
function healTargets(state, inv) {
  const here = (state.investigators || []).filter(other => !other.defeated && !other.resigned
    && other.location === inv.location)
  const targets = []
  for (const other of here) {
    if ((other.horror || 0) > 0) {
      targets.push({ id: `seat:${other.seat}`, seat: other.seat, label: `${other.name}（${other.horror} 点恐惧）` })
    }
    for (const card of other.assets || []) {
      if (!isAlly(card.code) || (card.horror || 0) <= 0) continue
      targets.push({ id: `asset:${card.id}`, asset: card, owner: other, label: `${ALL_CARDS[card.code]?.nameZh || ALL_CARDS[card.code]?.name || card.code}（${card.horror} 点恐惧）` })
    }
  }
  return targets
}

export default {
  code: CODE,
  name: 'Absolution',
  chooseResourceCostOnPlay: true,
  abilities: [
    {
      kind: 'played',
      label: '揭示 3+X 个标记：非符号标记转为祝福；每揭示 1 个祝福治愈 1 点恐惧',
      resolve: ({ state, inv, context, api }) => {
        const x = Math.max(0, Number(context?.playCost?.cost ?? 0))
        const tokens = api.revealChaosTokens(3 + x) || []
        const numeric = tokens.filter(isNumericToken).length
        if (numeric > 0) {
          const added = api.chaosTokens.add(BLESS, numeric)
          api.info(`🕯️ 赦免：揭示 ${tokens.length} 个标记，其中 ${numeric} 个非符号标记 → 加入 ${added} 个祝福标记。`)
        }
        const blesses = tokens.filter(token => token === BLESS).length
        let healed = 0
        for (let index = 0; index < blesses; index++) {
          const targets = healTargets(state, inv)
          if (!targets.length) {
            api.info('🕯️ 赦免：所在地点没有可治愈恐惧的调查员或[[盟友]]支援。')
            break
          }
          const picked = targets.length === 1 ? targets[0].id : api.choice({
            kind: 'target', source: CODE, seat: inv.seat, canSkip: true,
            prompt: `赦免：选择要治愈 1 点恐惧的目标（剩余祝福 ${blesses - index} 个）。`,
            options: [{ id: 'skip', label: '不治愈' }, ...targets.map(target => ({ id: target.id, label: target.label }))],
          })
          const target = targets.find(item => item.id === picked)
          if (!target) break
          if (target.asset) api.healAsset(target.asset, { horror: 1, owner: target.owner })
          else api.healHorror(target.seat, 1)
          healed += 1
        }
        if (blesses > 0) api.info(`🕯️ 赦免：揭示 ${blesses} 个祝福标记，共治愈 ${healed} 点恐惧。`)
      },
    },
  ],
  modifiers: [],
}
