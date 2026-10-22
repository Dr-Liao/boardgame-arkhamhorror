// 04191 古代遗物
// 卡面：[free]横置古代遗物：检定[willpower]或[intellect](4)。如果你检定成功，移除当前密谋上的1个毁灭标记。如果你检定失败，在古代遗物上增加1个毁灭标记。(每场游戏最多一次成功。)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04191 古代遗物：横置，检定意志或智识(4)。成功移除当前密谋 1 个毁灭（每局最多成功一次），
// 失败在遗物上放 1 个毁灭。旧实现把「成功过一次」记在 inv.tfaRelicDoomSuccess，
// 现在换成调查员级的通用标记 inv.gameFlags。

export default {
  code: '04191',
  abilities: [
    {
      kind: 'free', label: '横置：检定意志或智识(4)，成功移除密谋 1 毁灭',
      cost: { action: false, exhaust: true },
      resolve: ({ inv, source, api }) => {
        if (api.gameFlag(inv.seat, 'relicDoomSuccess')) {
          api.info('本场游戏已经成功使用过一次「古代遗物」。')
          return
        }
        const picked = api.choice({ kind: 'skill', source: '04191', seat: inv.seat,
          prompt: '选择意志还是智识检定。',
          options: [{ id: 'willpower', label: '意志(4)' }, { id: 'intellect', label: '智识(4)' }] })
        const skill = picked === 'intellect' ? 'intellect' : 'willpower'
        api.startTest({
          seat: inv.seat, skill, difficulty: 4,
          resolve: result => {
            if (result.success) {
              api.setGameFlag(inv.seat, 'relicDoomSuccess')
              if (api.removeDoom(1) > 0) {
                api.info(`🏺 古代遗物：移除当前密谋上的 1 个毁灭（当前 ${api.doom()}）。`)
              } else {
                api.info('🏺 古代遗物：当前密谋上没有毁灭可移除。')
              }
              return
            }
            api.placeDoomOnCard(source, 1)
            api.info(`🏺 古代遗物：检定失败，在遗物上放置 1 个毁灭（当前 ${source?.doom || 0}）。`)
          },
        })
      },
    },
  ],
  modifiers: [

  ],
}
