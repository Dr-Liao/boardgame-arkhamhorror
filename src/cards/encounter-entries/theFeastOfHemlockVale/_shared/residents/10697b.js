// 10697b 瑞玟·霍桑 · 敌人（瑞玟·霍桑的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Aloof. Hunter.
//   The first treachery drawn at River Hawthorne's location each round gains surge.
//   [action]: Parley. Test [willpower] (5). If you succeed, set River Hawthorne aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10697 的背面）。
//
// 印刷数值（战斗 1 / 躲避 4 / 生命 3 / 伤害 0 / 恐惧 1 / 胜利 0 / 特性）由 cards-data 提供；
// Aloof / Hunter 由章节 encounterDefinitions 从英文正文解析。
// 读点：
//   · 谈判 = abilities 的 action/parley（parley.js 枚举同地点敌人），成功后 api.scenario.setEnemyAside；
//   · 每轮在瑞玟所在地抽到第一张诡计时，为该次遭遇结算授予涌动。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '10697b'
const RESIDENT = 'riverHawthorne'
const NAME = '瑞玟·霍桑'

// 「放到一边，位于场外」= 引擎 api.scenario.setEnemyAside（唯一读点：scenario-runtime.js）。
const setAside = (enemy, api) => {
  const removed = api.scenario?.setEnemyAside?.(enemy)
  api.info?.(removed ? `「${NAME}」被放到一边（场外）。` : `「${NAME}」不在场上，无需放到一边。`)
  return Boolean(removed)
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: {
    resident: RESIDENT,
    assetCode: '10697',
    keywords: ['aloof', 'hunter'],
    firstTreacherySurge: true,
    victory: 0,
    parleySetAside: { skill: 'willpower', difficulty: 5 },
  },
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[意志](5)，成功则把瑞玟·霍桑放到一边',
    cost: { action: 1 },
    resolve: ({ inv, source, api }) => api.test(inv.seat, 'willpower', 5, {
      source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
      actionKind: 'parley',
      resolve: result => { if (result.success) setAside(source, api) },
    }),
  }, {
    kind: 'forced',
    trigger: 'encounterDrawn',
    silent: true,
    label: '每轮在瑞玟所在地抽到的第一张诡计获得涌动',
    limit: { scope: 'perRound', owner: 'instance' },
    criteria: ({ source, context }) => source.location === context.location
      && ALL_CARDS[context.cardCode]?.type === 'treachery',
    resolve: ({ context, api }) => api.grantEncounterDrawSurge(context),
  }],
}
