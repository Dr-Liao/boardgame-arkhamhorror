// 09106 整装待发（Making Preparations）· 幸存者事件 · 0 经验 · [[抉择]]
// 卡面：每轮最多 2 张[[抉择]]。
//       显现 - 选择两项技能（[willpower]、[intellect]、[combat] 或 [agility]）。
//       每位调查员得到所选的技能 +1，其他每项技能 -1，直到调查阶段结束。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 玩家的「显现」事件没有独立的显现通道（引擎只为弱点类型开显现）：本卡把 Revelation 实现为
//     手牌来源的强制能力，挂在 `cardDrawn` 窗口（抽到本卡的那次窗口，context.cardCode 命中）；
//   · 修正写进 api.addEffect（duration:'endOfPhase'，modifiers 用 audience:'all' 对每位调查员生效）。
// approximation: ①「每轮最多 2 张[[抉择]]」是特质作用域上限，条目只能声明本卡每轮 2 次；
//   ②「直到调查阶段结束」用 endOfPhase 到期（若在调查阶段外抽到会提前结束）。
const code = '09106'

const SKILLS = [['willpower', '意志'], ['intellect', '智力'], ['combat', '战斗'], ['agility', '敏捷']]

export default {
  code,
  note: 'approximation: 「每轮最多 2 张抉择」按本卡每轮 2 次近似（缺特质作用域上限）；「直到调查阶段结束」用 endOfPhase 到期。',
  playCondition: [{ when: () => false, message: '「整装待发」具有显现，只能在抽到时结算' }],
  abilities: [
    {
      kind: 'forced',
      fromHand: true,
      noPlayCost: true,
      trigger: 'cardDrawn',
      limit: { scope: 'perRound', owner: 'investigator', count: 2 },
      label: '显现：选择两项技能，所有调查员所选 +1、其余 -1 直到调查阶段结束',
      criteria: [({ inv, context }) => context?.cardCode === code && (inv.hand || []).includes(code)],
      resolve: ({ inv, api }) => {
        const chosen = []
        for (let pick = 0; pick < 2; pick++) {
          const options = SKILLS.filter(([id]) => !chosen.includes(id))
            .map(([id, label]) => ({ id, label }))
          const answer = api.choice({
            kind: 'effect', source: code, seat: inv.seat,
            prompt: `「整装待发」：选择第 ${pick + 1} 项技能。`, options,
          })
          if (answer) chosen.push(String(answer))
        }
        const modifiers = SKILLS.map(([id]) => ({
          target: `skill:${id}`, amount: chosen.includes(id) ? 1 : -1, audience: 'all',
        }))
        api.addEffect({
          duration: 'endOfPhase', sourceCode: code, controllerSeat: inv.seat,
          label: '整装待发：所选技能 +1，其余技能 -1',
          modifiers,
        })
        api.discardFromHand(inv.seat, code)
        const names = chosen.map(id => SKILLS.find(([key]) => key === id)?.[1] || id).join('、')
        api.info(`🧰 「整装待发」：所有调查员获得 ${names} +1，其余技能 -1（直到调查阶段结束）。`)
      },
    },
  ],
  modifiers: [],
}
