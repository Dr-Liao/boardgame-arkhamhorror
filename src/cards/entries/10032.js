// 10032 恢复元气（Second Wind）· 守护者事件 · 2 经验 · 0 资源 · 灵魂/无畏
// 卡面：只能作为你的第一个行动打出。
//       治愈 2 点伤害（如果你本轮抽取了一张诡计卡牌，改为治愈 3 点伤害）。抽取 1 张卡牌。
//
// 读点（卡面 → 引擎）：
//   · 「只能作为你的第一个行动」= playCondition[ownFirstAction()]（matcher.js 读
//     inv.actionsTakenThisTurn === 0；与旧 firstActionOnly 字段同一 predicate）。
//   · 「本轮抽取了一张诡计卡牌」= inv.drewTreacheryRound === state.round：
//     encounter.js#drawEncounter 在结算诡计时记录（唯一写点），与「本轮」同轮口径。
//   · 治疗只走 api.healDamage（harm-threat#healDamageFrom，威胁区 threatDamageSink 也从这里承接）；
//     抽牌走 api.drawCards。治疗量受剩余伤害限制，日志用实际治疗量。

// 「只能作为本回合第一个行动打出」的纯判据（与 engine/matcher.js#ownFirstAction 同口径）。
const ownFirstAction = () => ctx => ((ctx?.inv?.actionsTakenThisTurn || 0) === 0)


const CODE = '10032'

function secondWind({ state, inv, api }) {
  const drewTreachery = inv.drewTreacheryRound === state.round
  const amount = drewTreachery ? 3 : 2
  const healed = api.healDamage(inv.seat, amount, { log: false }) || 0
  const drawn = api.drawCards(inv.seat, 1) || []
  api.info(`💨 恢复元气：${inv.name} 治愈 ${healed} 点伤害${drewTreachery ? '（本轮抽到诡计，改为 3 点）' : ''}并抽取 ${drawn.length} 张牌。`)
}

export default {
  code: CODE,
  name: 'Second Wind',
  playCondition: [{ when: ownFirstAction(), message: '只能作为你的第一个行动打出' }],
  abilities: [
    { kind: 'played', label: '治愈 2 点伤害（本轮抽到诡计则 3 点）并抽 1 张牌', resolve: secondWind },
  ],
  modifiers: [],
}
