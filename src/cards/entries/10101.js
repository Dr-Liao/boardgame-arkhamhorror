// 10101 解读秘符（Read the Signs）· 神秘者事件 · 2 资源 · 2 经验 · [[法术]]
// 卡面：
//   调查。你本次调查将你的 [willpower] 值加入你的技能值。你可以忽略本次调查期间你所在地点将要触发的
//   任何效果和关键词。如果你检定成功，发现本地点额外 1 个线索。
//   如果本次调查期间揭示了符号，当你回合结束时，将解读秘符返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 与 06117（等级 0 的同名卡）的关系：基础调查部分沿用同一套读点，多出的只有最后一句符号去向。
//
// 读点（卡面 → 引擎）：
//   · 「调查。」= played 描述子 countsAs:'investigate'。
//   · 「将 [willpower] 加入技能值」= api.investigate(seat, { addSkill:'willpower' })
//     （actions.js#runInvestigate 的 addSkill 读点）。
//   · 「可以忽略你所在地点将要触发的任何效果和关键词」= api.investigate(..., { mayIgnoreLocationEffects: true })
//     （location-effect-scope.js 的唯一作用域通道：调查期间每次地点触发都会问「是否忽略」）。
//   · 「成功发现额外 1 个线索」= api.investigate(..., { clueBonus: 1 })（runInvestigate 的 gain 公式）。
//   · 「揭示了符号」= 本次检定的 result.drawn 与 _shared.js 的 CHAOS_SYMBOLS。
//
// 近似披露（simplified）：「当你回合结束时返回手牌」没有事件卡延迟去向读点（09074 同一缺口），
// 按「结算后立即返回手牌」近似；keepOnPlay 接管默认弃置。见 primitive-requests/10101.json。
import { CHAOS_SYMBOLS } from './_shared.js'

const CODE = '10101'

const isSymbol = token => CHAOS_SYMBOLS.includes(String(token))

export default {
  code: CODE,
  name: '解读秘符',
  keepOnPlay: true,
  simplified: true,
  note: 'approximation: 「当你回合结束时返回手牌」没有事件卡延迟去向读点（09074 同一缺口），'
    + '按「结算后立即返回手牌」近似；见 primitive-requests/10101.json。',
  abilities: [
    {
      kind: 'played',
      countsAs: 'investigate',
      label: '调查：加入意志值、可忽略地点效果/关键词、成功额外 1 线索；揭示符号则返回手牌',
      resolve: ({ inv, api }) => {
        const result = api.investigate(inv.seat, {
          addSkill: 'willpower',
          clueBonus: 1,
          mayIgnoreLocationEffects: true,
        })
        if ((result?.drawn || []).some(isSymbol)) {
          if (!(inv.hand || []).includes(CODE)) api.putInHand(inv.seat, CODE)
          api.info('🔎 「解读秘符」：本次调查揭示了符号，返回你的手牌。')
          return
        }
        api.putIntoDiscard(inv.seat, CODE)
      },
    },
  ],
  modifiers: [],
}
