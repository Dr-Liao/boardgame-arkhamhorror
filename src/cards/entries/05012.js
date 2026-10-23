// 05012 秘社“债务”
// 卡面：将秘社“债务”从游戏中移除。
// 卡面：强制 - 在游戏结束或你退场时，如果秘社“债务”仍在你手牌中：你承受1点精神创伤。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// simplified：本引擎的弱点在抽到时立即结算（不会留在手里到游戏结束），所以「仍在手牌里」这条
// 强制效果没有可达状态；这里只落实「从游戏中移除」。该差异登记在账本的 remaining 里。

export default {
  code: '05012',
  simplified: true,
  note: '「游戏结束时仍在你手牌中则承受 1 点精神创伤」在本引擎里没有可达状态（弱点抽到即结算），只实现「移出游戏」。',
  abilities: [
    {
      kind: 'weakness',
      label: '秘社“债务”：移出游戏',
      weakness: { type: 'lodgeDebts' },
      resolve: ({ inv, state, api }) => {
        state.removedFromGame ||= []
        state.removedFromGame.push('05012')
        api.info(`${inv.name} 把「秘社“债务”」移出游戏。`)
      },
    },
  ],
  modifiers: [],
}
