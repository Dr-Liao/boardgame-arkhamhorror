// 09716b 结社特工（B）（Coterie Agent (B)）· 敌人 · crimson_conspiracy
// 卡面：隐匿 2。强制 - 在结社特工进入阴影后：在上面放置 1 个毁灭标记。
//   [reaction] 在结社特工揭露时：将其弃掉。
// 读点与近似同 09716a（enemySpawnRule.doomOnSpawn / tskExposed 窗口 / flags.concealed）。
const CODE = '09716b'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: { concealed: 2, coterie: true, agentLetter: 'B' },
  enemySpawnRule: { doomOnSpawn: 1 },
  abilities: [{
    kind: 'reaction',
    trigger: 'tskExposed',
    label: '结社特工被揭露时：将其弃掉',
    criteria: ({ source, context }) => Boolean(source) && source.defeated !== true
      && context?.decoy !== true && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ source, api }) => {
      api.discardEnemy?.(source)
      api.info?.('揭露「结社特工（B）」：将其弃掉。')
      return true
    },
  }],
  note: 'approximation: 同 09716a（隐匿 2 仅 flags、入场 doomOnSpawn 等价、揭露依赖 tskExposed 窗口）。',
}
