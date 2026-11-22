// 60165 拘留（Restrained）
// 卡面：快速。一个非[[精英]]敌人攻击你后打出。自动躲避该敌人并把拘留附属到该敌人。被附属的敌人不能重整。
// 强制 - 在一轮结束时，如果所附属敌人非[[类人]]：弃掉拘留。
// 读点：played fast + trigger enemyAttacked；api.autoEvadeEnemy + api.attachSelfTo（敌人附属唯一写点）；
// api.preventEnemyReady（09035 同原语）；forced trigger roundEnds（phases.js 窗口）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '60165'
const isHumanoid = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'humanoid')

export default {
  code: CODE,
  keepOnPlay: true,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttacked',
      label: '非精英敌人攻击你后：自动躲避并附属拘留，敌人不能重整',
      criteria: [({ inv, context }) => context?.seat === inv.seat && context?.enemy && !context.enemy.elite
        && context.attackCancelled !== true],
      resolve: ({ inv, context, api }) => {
        const enemy = context.enemy
        api.autoEvadeEnemy(enemy)
        api.attachSelfTo(CODE, enemy.id)
        api.preventEnemyReady(enemy)
        api.info('「' + enemy.name + '」被拘留：不能重整。')
      },
    },
    {
      kind: 'forced',
      trigger: 'roundEnds',
      label: '轮末：所附属敌人非[[类人]]时弃掉拘留',
      criteria: [({ source }) => Boolean(source?.hostEnemyCode) && !isHumanoid(source.hostEnemyCode)],
      resolve: ({ api }) => { api.discardSelf(CODE) },
    },
  ],
  note: 'approximation: 敌人附属的来源上下文有 hostEnemyCode 时按卡面轮末弃牌；引擎 player-card 附属敌人的 host 上下文命名见 ability-rules.js（如实际字段不同则退化为不触发，已在探针验证 60165 的攻击后附属与横置路径）。',
  modifiers: [],
}
