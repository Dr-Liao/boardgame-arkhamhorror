// 05326 命运之轮·X（毁灭 4）
// 推进背面：弃掉全部异教徒敌人并把毁灭移到阿撒托斯；抽取魔鬼的笛声；
// 每位调查员在宇宙中向左移动一次或把所在地点向左移动一次（有吉尔曼日志可跳过）。
// 效果全部是数据，behavior.agendaReveal 按 agendaRule.advance 分派。
export default {
  code: '05326',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    advance: {
      ritualSuicide: true,
      daemonicPiping: true,
      moveLeft: true,
      skipMemento: 'gilmensJournal',
    },
  },
}