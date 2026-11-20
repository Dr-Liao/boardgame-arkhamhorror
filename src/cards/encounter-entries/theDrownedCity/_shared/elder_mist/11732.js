// 11732 腐蚀浓雾（Corrosive Fog）· 诡计 · 共享遭遇组 elder_mist（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/elder_mist。
// 卡面（cards-data 11732）：
//   显现 - 检定[intellect]或[combat](4)。如果你失败，受到1点伤害。
//          如果你低于难度至少3点失败，改为对你的调查员及你控制的每张有生命值[[盟友]]和[[道具]]支援各造成1点直接伤害。
//
// 读点（声明即接线）：
//   · 「检定智识或战斗」= 显现时 api.choice 选技能，再 api.test（scenarioRuntime 签名
//     (seat, skill, difficulty, resolve, bonus, source)）；
//   · 「受到 1 点伤害」= api.damage；「直接伤害」= api.directDamage；
//   · 支援伤害 = api.damageAsset（scenario-runtime 的资产伤害写入口），候选按 cards-data 的
//     traits（Ally/Item）与 health 过滤；伤害后由引擎在资产伤害结算内检查被击败。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '11732'
const DIFFICULTY = 4

const isAllyOrItemWithHealth = code => {
  const def = ALL_CARDS[code]
  if (!def) return false
  const traits = (def.traits || []).map(trait => String(trait).toLowerCase())
  return Number(def.health) > 0 && (traits.includes('ally') || traits.includes('item'))
}

export default {
  code: CODE,
  name: '腐蚀浓雾',
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Hazard'],
    quantity: 2,
    test: { skills: ['intellect', 'combat'], difficulty: DIFFICULTY },
    failDamage: 1,
    failBy3: { directDamage: 1, damageAssetsTraits: ['Ally', 'Item'] },
  },
  encounterResolve(state, inv, card, api) {
    const skill = String(api.choice({
      kind: 'effect', source: CODE, seat: inv.seat,
      prompt: '「腐蚀浓雾」：选择要进行的检定技能（智识或战斗）。',
      options: [
        { id: 'intellect', label: '智识(4)' },
        { id: 'combat', label: '战斗(4)' },
      ],
    }))
    const picked = ['intellect', 'combat'].includes(skill) ? skill : 'intellect'
    api.test(inv.seat, picked, DIFFICULTY, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「腐蚀浓雾」检定（${picked} ${result.value} vs ${DIFFICULTY}）。`)
        return
      }
      const failedBy = Math.max(0, Number(result?.difficulty ?? DIFFICULTY) - Number(result?.value ?? 0))
      if (failedBy < 3) {
        api.damage(inv.seat, 1)
        api.info?.(`🌫️ 「腐蚀浓雾」：${inv.name} 检定失败，受到 1 点伤害。`)
        return
      }
      api.directDamage(inv.seat, 1)
      api.info?.(`🌫️ 「腐蚀浓雾」：${inv.name} 低于难度 ${failedBy} 点失败，受到 1 点直接伤害。`)
      const owner = state.investigators?.[inv.seat]
      if (!owner || owner.defeated || owner.resigned) return
      for (const asset of owner.assets || []) {
        const ownCode = asset.originalCode || asset.code
        if (!isAllyOrItemWithHealth(ownCode)) continue
        api.damageAsset(inv.seat, asset.id, 1)
        api.info?.(`🌫️ 「腐蚀浓雾」：${inv.name} 的「${api.cardName?.(ownCode) || ownCode}」受到 1 点直接伤害。`)
      }
    }, 0, { code: CODE, label: '遭遇检定', name: '腐蚀浓雾' })
    return false
  },
  note: '技能二选一 + 显现检定 + 失败分支（<3 普通 1 伤害；≥3 直接伤害调查员与每张有生命值的'
    + '盟友/道具支援）全部自足实现；资产伤害走 api.damageAsset。'
    + '近似：直接伤害分支对每张符合印刷特性的支援各结算 1 点，顺序按当前资产列表；'
    + '资产被打满生命后由引擎的资产伤害结算处理（与参考每张各 1 damage 的口径一致）。',
}
