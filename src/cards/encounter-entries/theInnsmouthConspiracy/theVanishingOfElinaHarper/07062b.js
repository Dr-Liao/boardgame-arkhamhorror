// 愤怒暴民：猎杀、巨型、反击由印刷敌人定义提供；额外生命和借机攻击禁止在此读取。
export default {
  code: '07062b', scope: 'enemy', implemented: true,
  modifiers: [
    { target: 'enemyHealth', amount: ({ state }) => 4 * state.investigators.length },
    { target: 'cannot:opportunityAttack', amount: 1 },
  ],
}
