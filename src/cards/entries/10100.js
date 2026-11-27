// 10100 缥缈灵体（Ethereal Form）· 神秘者事件 · 2 资源 · 2 经验 · [[法术]]
// 卡面：
//   躲避。你本次躲避尝试将你的 [willpower] 值加入你的技能值。如果你检定成功，和其他每个与你交战的
//   敌人解除交战，且你视为无形（敌人不能与你交战，你不能攻击敌人也不能对敌人造成伤害），直到本轮结束。
//   如果本次躲避尝试期间揭示了符号，当你回合结束时，将缥缈灵体返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 与 06164（等级 0 的同名卡）的关系：两者卡面只差最后一句「揭示符号 → 回合结束返回手牌」，
// 因此基础躲避/无形部分沿用 06164 的同一套读点，符号去向由本条目自己结算。
//
// 读点（卡面 → 引擎）：
//   · 「躲避。」= played 描述子 countsAs:'evade'（借机攻击/行动指示读点）。
//   · 「将 [willpower] 加入技能值」= api.evade(seat, { addSkill: 'willpower' })（doEvade 的
//     addSkill 读点：把该属性当前值并入本次技能值）。
//   · 「解除其他交战」= doEvade 的 onSuccess → api.disengageAll（解除全部交战的唯一入口）。
//   · 「无形」= api.addEffect({ duration:'endOfRound', modifiers:[capability:*] })：
//     capability:fight / capability:engage / capability:dealEnemyDamage 分别封住「攻击」「交战」
//     （自己与敌人都不能交战：enemies.js / moves.js 的 capabilityBlocked 同一读点）与「对敌人造成伤害」。
//   · 「揭示了符号」= 本次检定的 result.drawn（B3 契约）与 _shared.js 的 CHAOS_SYMBOLS
//     （骷髅/教徒/石板/古神/自动失败，与本仓 03034/03197/05033 同一口径）。

// · 符号的回合末去向由 api.returnPlayedEventAtEndOfTurn 登记。
import { CHAOS_SYMBOLS } from './_shared.js'

const CODE = '10100'

const engagedWithMe = (state, inv) => (state.enemies || []).filter(enemy => enemy.engagedSeat === inv.seat)
const isSymbol = token => [...CHAOS_SYMBOLS, 'eldersign', 'bless', 'curse', 'frost'].includes(token)

export default {
  code: CODE,
  name: '缥缈灵体',
  playCondition: [{
    when: ({ state, inv }) => engagedWithMe(state, inv).length > 0,
    message: '没有与你交战的敌人，不能打出「缥缈灵体」',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'evade',
      label: '躲避：加入意志值；成功后解除交战并化为无形（本轮）；揭示符号则返回手牌',
      resolve: ({ state, inv, api, context }) => {
        const candidates = engagedWithMe(state, inv)
        if (!candidates.length) {
          api.info('「缥缈灵体」：没有可躲避的交战敌人。')
          return
        }
        const chosenId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「缥缈灵体」：选择要躲避的交战敌人。',
          options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const foe = candidates.find(enemy => enemy.id === chosenId) || candidates[0]
        const result = api.evade(inv.seat, {
          enemyId: foe.id,
          addSkill: 'willpower',
          onSuccess: () => {
            api.disengageAll(inv.seat)
            api.addEffect({
              duration: 'endOfRound',
              sourceCode: CODE,
              controllerSeat: inv.seat,
              label: '缥缈灵体：无形（本轮不能攻击、交战或伤害敌人）',
              modifiers: [{ target: 'capability:fight' }, { target: 'capability:engage' },
                { target: 'capability:dealEnemyDamage' }],
            })
            api.info('💨 你化为无形：解除所有交战，直到本轮结束不能攻击、交战或伤害敌人。')
          },
        })
        if ((result?.drawn || []).some(isSymbol)) api.returnPlayedEventAtEndOfTurn(context)
      },
    },
  ],
  modifiers: [],
}
