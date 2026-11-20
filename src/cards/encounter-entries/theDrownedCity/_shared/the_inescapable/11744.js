// 11744 穷途异魔（The Inescapable）· 敌人 · 共享遭遇组 the_inescapable（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/the_inescapable。
// 卡面（cards-data 11744）：
//   猎手。无情。
//   生成 - 任意连接地点(尽可能为空地点)。
//   强制 - 每轮中，混乱袋首次揭示[elder_thing]标记时：重整穷途异魔并结算其猎手关键词(其不攻击)。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；猎手/无情由章节 encounterDefinitions 解析；
//   · 「生成 - 任意连接地点（尽可能为空地点）」= 条目 enemyRule.spawnLocation（第七轮新读点，
//     读点 enemies.js#spawnEnemy：排在 behavior.spawnLocation 之后、redirect 之前；优先空地点、
//     按到默认落点的图距离取最近；kind 'nearestEmptyConnecting' 只在默认落点的直接连接地点里选）；
//   · 「每轮首次揭示 elder_thing」= chaosTokenRevealed 窗口 + limit { perRound, group }；
//   · 「重整」= api.scenario.readyEnemy；「结算猎手关键词（不攻击）」= api.scenario.hunterStep
//     取下一步目标后 api.moveEnemy（不进入敌人攻击循环）。
const CODE = '11744'
const TOKEN = 'elderthing'

export default {
  code: CODE,
  name: '穷途异魔',
  scope: 'enemy',
  implemented: true,
  // 印刷「无情」：读点 turn.js#resolveEnemyPhase 的 registeredEntry(...).enemyRule.relentless。
  // 「生成 - 任意连接地点（尽可能为空地点）」：条目级生成落点声明，读点 enemies.js#spawnEnemy。
  enemyRule: { relentless: true, spawnLocation: { kind: 'nearestEmptyConnecting' } },
  flags: {
    traits: ['Monster', 'Star Spawn', 'Elite'],
    quantity: 1,
    fight: 4,
    evade: 2,
    health: 6,
    damage: 2,
    horror: 0,
    victory: 0,
    hunter: true,
    relentless: true,
    spawnConnectedEmpty: true,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'chaosTokenRevealed',
    silent: true,
    limit: { scope: 'perRound', owner: 'group' },
    label: '每轮首次揭示 elder_thing：重整并结算猎手关键词（不攻击）',
    criteria: ({ state, source, context }) => context?.token === TOKEN
      && Boolean(source?.id) && (state?.enemies || []).some(enemy => enemy.id === source.id),
    resolve: ({ state, source, api }) => {
      api.scenario?.readyEnemy?.(source)
      if (source.engagedSeat == null && !source.exhausted) {
        const target = api.scenario?.hunterStep?.(source)
        if (target && target !== source.location) api.moveEnemy?.(source, target)
      }
      api.info?.('💀 「穷途异魔」：本轮首次揭示旧神标记，重整并结算一次猎手移动（不发动攻击）。')
    },
  }],
  note: '生成落点走条目级 enemyRule.spawnLocation: { kind: \'nearestEmptyConnecting\' }'
    + '（读点 enemies.js#spawnEnemy：在默认落点的直接连接地点里优先空地点、按图距离取最近；'
    + '由引擎在生成瞬间直接落到该地点，没有「先生成再移动」的窗口顺序差异）。'
    + '猎手/无情来自印刷正文解析。每轮首次 elder_thing 的强制效果走 chaosTokenRevealed + perRound(group) 上限：'
    + '重整后结算一次 hunterStep 移动，不进入攻击。无近似项。',
}
