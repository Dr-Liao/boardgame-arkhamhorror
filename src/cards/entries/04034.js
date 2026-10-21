// 04034 狗屎运
// 卡面：快速。你对非[[精英]]敌人进行躲避尝试期间，技能检定失败且低于难度2点及以内后打出。
// 卡面：将该敌人放到遭遇牌库顶。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04034 狗屎运：刚躲避失败的非精英敌人放回遭遇牌库顶。

export default {
  code: '04034',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'evadeFail',
      criteria: { nonElite: true, failedByAtMost: 2, selfOnly: true },
      label: '狗屎运',
      resolve: ({ api }) => {
        const context = api.reactionContext()
        const enemy = context?.enemy
        if (!enemy || !api.removeEnemy) { api.info('没有可放回遭遇牌库的敌人。'); return }
        api.shuffleEnemyToEncounterTop(enemy)
        api.info(`🍀 「${api.cardName('04034')}」把「${enemy.name}」放回遭遇牌库顶。`)
      },
    },
  ],
  modifiers: [

  ],
}
