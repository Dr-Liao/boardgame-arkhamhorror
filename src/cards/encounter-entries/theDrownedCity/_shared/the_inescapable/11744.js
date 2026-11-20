// 11744 穷途异魔（The Inescapable）· 敌人 · 共享遭遇组 the_inescapable（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/the_inescapable。
// 卡面（cards-data 11744）：
//   猎手。无情。
//   生成 - 任意连接地点(尽可能为空地点)。
//   强制 - 每轮中，混乱袋首次揭示[elder_thing]标记时：重整穷途异魔并结算其猎手关键词(其不攻击)。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；猎手/无情由章节 encounterDefinitions 解析；
//   · 「任意连接地点（尽可能为空地点）」= enemySpawn 窗口（enemies.js#spawnEnemy 的
//     reactionWindow 在自动交战前派发，context 带 enemy/seat/location）。条目在该窗口把敌人
//     移动到抽牌者地点的连接地点：优先无人地点，没有则任意连接地点；移动用 api.moveEnemy
//     （relocateEnemy 的剧本/能力写点）。移动后引擎的「同地点才交战」判定自然不再生效；
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
    trigger: 'enemySpawn',
    silent: true,
    label: '生成：改为在抽牌者地点的连接地点生成（尽可能为空地点）',
    criteria: ({ state, source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id
      && Number.isInteger(context?.seat) && Boolean(state.investigators?.[context.seat]?.location),
    resolve: ({ state, source, context, api }) => {
      const inv = state.investigators[context.seat]
      const origin = state.locations?.find(location => location.id === inv.location)
      const connected = [...new Set(origin?.connections || [])]
        .filter(id => id !== inv.location && state.locations?.some(location => location.id === id))
      if (!connected.length) return
      const empty = connected.filter(id => !(state.investigators || []).some(other =>
        !other.defeated && !other.resigned && other.location === id)
        && !(state.enemies || []).some(enemy => enemy !== source && enemy.location === id))
      const candidates = empty.length ? empty : connected
      const chosen = candidates.length === 1 ? candidates[0] : (api.choice({
        kind: 'location', source: CODE, seat: inv.seat,
        prompt: '「穷途异魔」：选择它生成的连接地点（尽可能为空地点）。',
        options: candidates.map(id => ({ id, label: api.locName?.(id) || id })),
      }) || candidates[0])
      api.moveEnemy?.(source, chosen)
      api.info?.(`💀 「穷途异魔」在「${api.locName?.(chosen) || chosen}」生成（尽可能为空地点）。`)
    },
  }, {
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
  note: '生成位置用 enemySpawn 窗口（在自动交战前）把敌人改放到抽牌者地点的连接地点，优先无人地点；'
    + '猎手/无情来自印刷正文解析。每轮首次 elder_thing 的强制效果走 chaosTokenRevealed + perRound(group) 上限：'
    + '重整后结算一次 hunterStep 移动，不进入攻击。近似：生成位置在引擎里是「先生成再移动」，'
    + '没有直接指定连接地点的印刷生成点读点（span 生成窗口内完成，最终位置正确）。',
}
