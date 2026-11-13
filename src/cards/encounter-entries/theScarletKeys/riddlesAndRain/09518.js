// 09518 戴红手套的男子（The Red-Gloved Man） · 敌人 · riddlesAndRain
// 归属：关卡专用 · theScarletKeys/riddlesAndRain（riddles_and_rain 组）。
// 卡面：隐匿 1[per_investigator]。反击。（另有胜利 1 点，来自印刷数据；生命值 2/调查员。）
// 场景 4「当场抓获」还给他：
//   [action]：谈判。检定[willpower]或[intellect](5)以盘问戴红手套的男子。如果你检定成功，在他上面放置 1 资源。
//
// 读点：
//   · 隐匿 → enemyScript.concealed（behavior.spawnForbiddenAt / spawnFailed / distributeConcealedEnemy
//     按 `perInvestigator` 分配迷你卡；未注册条目时回落到 definition 的 CONCEALED_DECOYS_PER_INVESTIGATOR）；
//   · 谈判 → entityActionDescriptors（actionKind:'parley'，range:'here'，只在场景 4 出现）；
//   · 资源 → api.addCardCounter(source, 'bounty', 1)（引擎的「敌人资源」只有剧本运行时入口
//     api.setEnemyResources，卡条目面没有；通用卡计数器是卡条目唯一可写入口。近似 6：
//     behavior.parleyResources 同时读 enemy.resources 与 bounty 计数，见 primitive-requests/09518.json）。
const CODE = '09518'
const PARLEY_COUNTER = 'bounty'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  note: 'approximation: 谈判资源改记通用卡计数器 bounty（behavior.parleyResources 同时读 enemy.resources）',
  enemyScript: {
    concealed: { perInvestigator: 1 },
    parleyResourcesGoal: 1,
    parleyOnlyActNumber: 4,
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    range: 'here',
    cost: { action: 1 },
    // 「戴红手套的男子获得…」只在场景 4（actIndex 3）有效。
    criteria: [({ state }) => Number(state?.actIndex) === 3],
    label: '谈判 意志/智力(5)：盘问戴红手套的男子（成功在其上放置 1 资源）',
    resolve: ({ inv, source, api }) => {
      const skills = ['willpower', 'intellect']
      const chosen = typeof api.choose === 'function'
        ? api.choose({ kind: 'choice', seat: inv.seat, source: 'tskRedGlovedManParley',
          prompt: '选择技能：意志或智力。',
          options: [{ id: 'willpower', label: '意志' }, { id: 'intellect', label: '智力' }] })
        : 'willpower'
      const skill = skills.includes(chosen) ? chosen : 'willpower'
      api.test(inv.seat, skill, 5, {
        source: { type: 'scenario', action: 'parley', code: CODE, ability: true },
        resolve: result => {
          if (!result?.success) return
          api.addCardCounter(source, PARLEY_COUNTER, 1)
          api.info('🕵️ 「盘问」成功：戴红手套的男子上放置 1 个资源。')
        },
      })
    },
  }],
}
