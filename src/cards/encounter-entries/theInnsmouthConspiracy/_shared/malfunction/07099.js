// 07099 机械故障（Malfunction）· 印斯茅斯 · 诡计（遭遇组 malfunction）
//
// 归属：本章卡同时出现在第四章魔鬼礁石（devilReef）与第五章全速恐惧（horrorInHighGear），
//   遭遇组 malfunction 不是任何单章的章节组（content/campaigns/theInnsmouthConspiracy/manifest.js:9
//   的 sharedEncounterGroupIds 会把它算作共享组），因此归属算法给出
//   `theInnsmouthConspiracy/_shared/malfunction/07099.js`（tools/encounter-entry-placement.mjs
//   resolvePlacement 实测）。不要放到 devilReef/ 或 horrorInHighGear/ 下，否则
//   tests/encounter-entries.test.mjs:53 的文件路径守卫会红。
//
// 印刷（中文）：
//   显现 - 附属到最近的[[载具]]剧情支援。
//   附属支援上的「[action]」能力不能触发。
//   [action]：检定[智力](3)。如果你检定成功，弃掉机械故障。
//
// 印刷（英文）：
//   Revelation - Attach to the nearest [[Vehicle]] story asset.
//   "[action]" abilities on attached asset cannot be triggered.
//   [action]: Test [intellect] (3). If you succeed, discard Malfunction.
//
// 引擎读点：
//   · 显现附属：`api.scenario.attachEncounterToStoryAsset('07099', <storyAssetId>)`
//     （scenario-runtime.js，写宿主 `host.attachments`，encounterAttached:true）。
//     「最近的[[载具]]剧情支援」：候选 = `state.storyAssets` 里带 [[Vehicle]] 特性的实例；
//     距离用 `api.scenario.locationDistance(inv.location, [host.location])`（BFS，scenario-runtime.js:385），
//     -1 视为不可达；并列最近时由揭示者 `api.choose` 选一个（参考实现 chooseTargetM 同口径）。
//   · 宿主行动封锁：条目级 `treacheryRule.suppressesHostActions: true`，
//     读点 parley.js#parleyMoves（宿主的 action/free 描述子不再进入合法表；forced/reaction 照常）。
//   · 本卡自身行动：`treacheryRule.attachmentAbilities`（读点 parley.js#entityActionDescriptors 与
//     parleyMovesFor 的 encounterAttachment 枚举；执行走 ability-exec#doEntityAbility 的实体管线）。
//     成功弃掉本卡用 `api.scenario.detachEncounterAttachment(source)`（资源写入口）。
//   · 「载具」特性来自 cards-data（07178 渔船 / 07211-07212 两辆车都带 Vehicle）；
//     剧情支援宿主实例由章节 setup 放进 `state.storyAssets`（middle-setup.js 注册渔船与两辆车）。
//
// 实现状态：implemented:true（三条印刷条款全部接线）。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

import { hasTrait } from '../../../_shared.js'

const MALFUNCTION = '07099'

function nearestVehicleStoryAsset(state, inv, api) {
  const hosts = (state.storyAssets || []).filter(host => host && !host.removedFromGame
    && hasTrait(host, 'Vehicle') && host.location)
  if (!hosts.length) return null
  const steps = host => {
    const distance = api.scenario.locationDistance(inv.location, [host.location])
    return distance < 0 ? Infinity : distance
  }
  const ranked = hosts.map(host => ({ host, steps: steps(host) })).sort((left, right) => left.steps - right.steps)
  const pool = ranked.filter(item => item.steps === ranked[0].steps).map(item => item.host)
  if (pool.length === 1) return pool[0]
  const answer = api.choose({ kind: 'asset', source: MALFUNCTION, seat: inv.seat,
    prompt: '机械故障：选择最近的载具剧情支援作为宿主。',
    options: pool.map(host => ({ id: host.id, label: host.name || host.code, cardCode: host.code })) })
  return pool.find(host => String(host.id) === String(answer)) || pool[0]
}

export default {
  code: MALFUNCTION,
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    attachToNearestVehicleStoryAsset: true,
    suppressesHostActions: true,
    attachmentAbilities: [{
      kind: 'action',
      actionKind: 'activate',
      label: '检定智力(3)：成功则弃掉机械故障',
      resolve: ({ inv, source, api }) => {
        api.test(inv.seat, 'intellect', 3, result => {
          if (result.success) api.scenario.detachEncounterAttachment(source)
        })
      },
    }],
  },
  encounterResolve(state, inv, card, api) {
    const host = nearestVehicleStoryAsset(state, inv, api)
    if (!host) {
      api.info?.('🔧 「机械故障」：场上没有可附属的载具剧情支援，效果不结算。')
      return false
    }
    api.attachEncounterToStoryAsset(MALFUNCTION, host.id)
    api.info?.(`🔧 「机械故障」附属到最近的载具剧情支援「${host.name || host.code}」：其 [action] 能力不能触发。`)
    return true
  },
}
