// 04114 三种命运
// 归属：关卡专用 · threadsOfFate（失落的时代 · 命运之线）
// 遭遇组：threads_of_fate
// 卡面：[action]：撤退。你不想花费过多时间来冒险，因此你带着搜集到的信息安全返回。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 118 轮：命运之线（失落时代第三章）的密谋背面、敌人脚本与三张遭遇卡。
// 幕牌库计数直接读 state.scenarioFlags.actDecks（与章节 actsInPlay 同源）。

import { threadActDecksInPlay } from '../../_shared.js'

export default {
  code: '04114', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      api.shuffleDiscard?.()
      const decks = threadActDecksInPlay(state)
      const doom = decks === 2 ? 1 : 0
      if (doom) api.addDoom?.(doom)
    },
  },
}
