// 09538 拉辛·法瑞（复生的工匠）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：警戒。猎手。反击。强制 - 任意密钥变换后：若拉辛·法瑞已横置，重整他；否则他对交战调查员发动一次即时攻击。
//
// 一张卡一个文件：behavior.shiftLastBlossom 在每次密钥变换后调用 razinReactsToKeyShift，
// 读取 razin 标记决定「重整 / 即时攻击」。玩家经 P4 交互发起的 Shift 目前没有变换后窗口
// （见 primitive-requests/09538.json），本条目覆盖剧本发起的变换。
export default {
  code: '09538',
  scope: 'enemy',
  implemented: true,
  flags: {
    razin: true,
    reactsToKeyShift: true,
    readyOrAttackAfterShift: true,
  },
  note: '近似：只接剧本发起的密钥变换（阿玛兰斯强制变换）；P4 玩家 Shift 无全局 keyShifted 窗口。',
}
