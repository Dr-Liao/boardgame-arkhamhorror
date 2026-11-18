// 10049 “用书砸它！”（"Throw the Book at Them!"）· 探求者事件 · 0 经验 · 费用 1 · 策略/即兴。
//
// 卡面：攻击。选择一个你控制的[[书籍]]支援。你本次攻击得到 +X[战斗]，其中 X 为该支援的印刷费用。
//       如果你检定成功，你可以自动躲避被攻击的敌人，或者你可以在攻击结束后结算所选支援上的一个
//       [action] 或 [fast] 能力（忽略其 [action] 费用，如有）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 「攻击。」= played 描述子 `countsAs: 'fight'`（tests/card-entries.test.mjs 的粗体行动指示守卫）；
//     攻击本身走 api.fight（combat.js#doFight，与基础攻击同一份规则/日志）。
//   · 「选择一个你控制的[[书籍]]支援」→ resolve 里从 inv.assets 只读枚举印刷特性含 Tome 的支援，
//     印刷费用读 cards-data（ALL_CARDS[code].cost，与 10001 的印刷费用口径相同）。
//   · +X[战斗] → api.fight 的 combatBonus（本次攻击的固定技能加值）。
//   · 「自动躲避被攻击的敌人」→ api.autoEvadeEnemy（enemies.js#autoEvadeEnemy，横置并解除交战）；
//     被这一击击败的敌人没有可躲避的对象，因此只在敌人仍存活时给出该选项。
//   · 「结算所选支援上的一个 [action] 或 [fast] 能力（忽略 [action] 费用）」→
//     api.cardAbilityOptions + api.resolveCardAbility（api-card.js 的唯一读点，
//     `ignoreActionCost: true` 只免除行动点，横置/充能等其它费用照付；与 10002/09076 同一套原语）。
//   · 打出条件：控制至少一本[[书籍]]支援，且所在地点有可攻击敌人（与 _shared.attackableEnemies 同口径）。
//   · 口径：+X 走 api.fight 的 combatBonus（引擎既有的「本次攻击加值」读点），
//     不另造状态字段；若同一窗口里另有改变本次检定的效果，仍由引擎统一的修正管线结算。
import { ALL_CARDS } from '../../cards/cards-data.js'
import { attackableEnemies } from './_shared.js'

const CODE = '10049'

const traitsOf = code => (ALL_CARDS[code]?.traits || []).map(trait => String(trait).toLowerCase())
const isTome = code => traitsOf(code).includes('tome')
const printedCost = code => {
  const def = ALL_CARDS[code]
  return def && Number.isFinite(def.cost) ? def.cost : 0
}

// 本人控制的未附属[[书籍]]支援（附属在别的卡上的支援不参与选择，与 10002 同一过滤）。
const tomeAssets = inv => (inv?.assets || []).filter(asset => !asset.attachedToAsset && isTome(asset.code))

export default {
  code: CODE,
  playCondition: [
    {
      when: ({ inv }) => tomeAssets(inv).length > 0,
      message: '你没有控制的[[书籍]]支援',
    },
    {
      when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
      message: '所在地点没有可攻击的敌人',
    },
  ],
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      label: '攻击：选择一本[[书籍]]，+X[战斗]（X=印刷费用）；成功后自动躲避或结算该书的一个能力',
      resolve: ({ state, inv, api }) => {
        const tomes = tomeAssets(inv)
        if (!tomes.length) {
          api.info('「用书砸它！」：你没有控制的[[书籍]]支援。')
          return
        }
        const pickedTomeId = tomes.length === 1 ? tomes[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择要用来攻击的[[书籍]]支援（X = 它的印刷费用）。',
          options: tomes.map(asset => ({ id: asset.id, label: `${api.cardName(asset.code)}（印刷费用 ${printedCost(asset.code)}）` })),
        })
        const tome = tomes.find(asset => asset.id === pickedTomeId) || tomes[0]
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('「用书砸它！」：所在地点没有可攻击的敌人。')
          return
        }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '选择本次攻击的对象。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        if (!enemy) return
        const bonus = printedCost(tome.code)
        api.info(`📖 ${inv.name} 举起「${api.cardName(tome.code)}」砸向「${enemy.name}」（+${bonus}[战斗]）。`)
        const result = api.fight(inv.seat, enemy.id, { combatBonus: bonus, sourceCode: CODE })
        if (!result?.success) return
        // 攻击结束后：自动躲避被攻击的敌人，或结算所选支援上的一个能力（忽略行动点费用）。
        const survivor = state.enemies.find(item => item.id === enemy.id)
        const abilityOptions = tome && (inv.assets || []).some(asset => asset.id === tome.id)
          ? api.cardAbilityOptions(inv.seat, tome, { ignoreActionCost: true })
          : []
        const modes = []
        if (survivor) modes.push({ id: 'evade', label: `自动躲避「${survivor.name}」` })
        if (abilityOptions.length) modes.push({ id: 'ability', label: `结算「${api.cardName(tome.code)}」上的一个 [action]/[fast] 能力` })
        if (!modes.length) return
        const mode = modes.length === 1 ? modes[0].id : api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '检定成功：选择自动躲避，或结算所选[[书籍]]上的一个能力。',
          options: [...modes, { id: 'skip', label: '不结算' }],
        })
        if (mode === 'skip') return
        if (mode === 'evade') {
          if (api.autoEvadeEnemy(survivor)) api.info(`💨 「用书砸它！」：自动躲避「${survivor.name}」。`)
          return
        }
        const chosen = abilityOptions.length === 1 ? abilityOptions[0] : (() => {
          const answer = api.choice({
            kind: 'ability', source: CODE, seat: inv.seat,
            prompt: `选择「${api.cardName(tome.code)}」要结算的能力（忽略其 [action] 费用）。`,
            options: abilityOptions.map(option => ({ id: String(option.index), label: option.label })),
          })
          return abilityOptions.find(option => String(option.index) === String(answer)) || abilityOptions[0]
        })()
        if (!chosen) return
        api.resolveCardAbility(inv.seat, tome, { abilityIndex: chosen.index, ignoreActionCost: true })
      },
    },
  ],
  modifiers: [],
}
