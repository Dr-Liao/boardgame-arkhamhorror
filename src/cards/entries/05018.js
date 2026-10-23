// 05018 神秘乐曲
// 卡面：玛丽·朗博牌库专用。
// 卡面：快速。在密谋将要因为达到毁灭阈值而推进时打出。
// 卡面：直到本阶段结束，密谋不能因为达到毁灭阈值而推进。将神秘乐曲从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 「将要因毁灭阈值推进」的窗口是 agendaWouldAdvance（src/engine/act-agenda.js 的 checkAgenda）；
// 锁定状态由同一处读 state.agendaDoomLock（本轮/本阶段）。

export default {
  code: '05018',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'agendaWouldAdvance',
      exileAfterPlay: true,
      label: '本阶段密谋不能因毁灭阈值推进',
      resolve: ({ inv, state, api }) => {
        state.agendaDoomLock = { round: state.round, phase: state.phase }
        api.info(`${inv.name} 奏起神秘乐曲：本阶段密谋不能因达到毁灭阈值而推进。`)
      },
    },
  ],
  modifiers: [],
}
