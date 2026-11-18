// 10102 幽灵利刃（Spectral Razor）· 神秘者事件 · 2 资源 · 2 经验 · [[法术]]
// 卡面：
//   攻击。本次攻击将你的 [willpower] 值加入你的技能值。本次攻击前，你可以立即与被攻击敌人交战。
//   本次攻击造成 +1 伤害（如果该敌人非 [[精英]]，改为造成 +2 伤害）。
//   如果本次攻击期间揭示了符号，当你回合结束时，将幽灵利刃返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 与 06201（等级 0 的同名卡）的关系：攻击部分沿用同一套读点，多出的只有最后一句符号去向。
//
// 读点（卡面 → 引擎）：
//   · 「攻击。」= played 描述子 countsAs:'fight'；目标过滤用 _shared.js 的 attackableEnemies
//     （与「攻击。」事件同一份冷漠口径），没有可攻击敌人时不能打出（playCondition）。
//   · 「将 [willpower] 加入技能值」= api.fight(..., { addSkill:'willpower' })（doFight 的 addSkill 读点）。
//   · 「攻击前可以立即与该敌人交战」= api.engage(enemy, seat)（主动交战唯一入口），可选。
//   · 「+1 伤害；非精英改为 +2」= doFight 的 damageBonus（基础伤害 1 + 加值）。
//   · 「揭示了符号」= 本次攻击的 result.drawn 与 _shared.js 的 CHAOS_SYMBOLS。
//
// 近似披露（simplified）：「当你回合结束时返回手牌」没有事件卡延迟去向读点（09074 同一缺口），
// 按「结算后立即返回手牌」近似；keepOnPlay 接管默认弃置。见 primitive-requests/10102.json。
import { attackableEnemies, CHAOS_SYMBOLS } from './_shared.js'

const CODE = '10102'

const isSymbol = token => CHAOS_SYMBOLS.includes(String(token))

export default {
  code: CODE,
  name: '幽灵利刃',
  keepOnPlay: true,
  simplified: true,
  note: 'approximation: 「当你回合结束时返回手牌」没有事件卡延迟去向读点（09074 同一缺口），'
    + '按「结算后立即返回手牌」近似；见 primitive-requests/10102.json。',
  playCondition: [{
    when: ({ state, inv }) => attackableEnemies(state, inv).length > 0,
    message: '你所在地点没有可以攻击的敌人',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'fight',
      label: '攻击：加入意志值、可先交战，+1 伤害（非精英 +2）；揭示符号则返回手牌',
      resolve: ({ state, inv, api }) => {
        const candidates = attackableEnemies(state, inv)
        if (!candidates.length) {
          api.info('「幽灵利刃」：这里没有可以攻击的敌人。')
          api.putIntoDiscard(inv.seat, CODE)
          return
        }
        const answer = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '「幽灵利刃」：选择要攻击的敌人。',
          options: candidates.map(item => ({ id: item.id, label: item.name })),
        })
        const enemy = candidates.find(item => item.id === answer) || candidates[0]
        if (!enemy) return
        // 「本次攻击前，你可以立即与被攻击敌人交战。」
        if (enemy.engagedSeat !== inv.seat && enemy.massive !== true) {
          const engage = api.choice({
            kind: 'effect', source: CODE, seat: inv.seat, canSkip: true,
            prompt: `「幽灵利刃」：是否立即与「${enemy.name}」交战？`,
            options: [{ id: 'engage', label: '交战' }, { id: 'skip', label: '不交战' }],
          })
          if (engage === 'engage') api.engage(enemy, inv.seat)
        }
        const result = api.fight(inv.seat, enemy.id, {
          noSpend: true,
          source: CODE,
          sourceCode: CODE,
          skill: 'combat',
          addSkill: 'willpower',
          damageBonus: enemy.elite ? 1 : 2,
        })
        // 「揭示了符号」= 本次攻击期间揭示的标记（非精英/精英不影响这条）。
        if ((result?.drawn || []).some(isSymbol)) {
          if (!(inv.hand || []).includes(CODE)) api.putInHand(inv.seat, CODE)
          api.info('🔪 「幽灵利刃」：本次攻击揭示了符号，返回你的手牌。')
          return
        }
        api.putIntoDiscard(inv.seat, CODE)
      },
    },
  ],
  modifiers: [],
}
