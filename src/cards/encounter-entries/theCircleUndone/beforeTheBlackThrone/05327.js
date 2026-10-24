// 05327 它在等待（毁灭 6）
// 推进背面：弃异教徒 + 抽魔鬼的笛声；每人意志 4 检定，失败受到 1 伤害 1 恐惧（有破旧十字架可跳过）。
// 检定与失败效果是数据。
export default {
  code: '05327',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    advance: {
      ritualSuicide: true,
      daemonicPiping: true,
      skipMemento: 'wornCrucifix',
      tests: [{ skill: 'willpower', difficulty: 4, fail: { damage: 1, horror: 1 } }],
    },
  },
}