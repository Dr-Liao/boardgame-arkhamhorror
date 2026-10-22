// 02044 野兽出笼
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：强制-在本密谋将因达到毁灭阈值而推进时：改为移除场上所有的毁灭标记，并将实验体朝宿舍移动一个地点。
// 卡面：目标-如果实验体进入宿舍，推进。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02044', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api) {
      for (const inv of state.investigators.filter(item => !item.defeated && !item.resigned)) api.horror(inv.seat, 3)
      api.finish('r4')
    },
  },
}
