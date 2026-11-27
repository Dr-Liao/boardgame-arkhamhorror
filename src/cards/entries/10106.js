// 10106 钥匙看管者（Keeper of the Key · 苍穹结界）· 晨曦 · 神秘者支援 · 0 费 · 无槽位 · [[召唤]] ·
//   独一无二 · 绑定（上古封印 10105）· 神智 4
// 卡面：
//   绑定（上古封印）。
//   [reaction] 在你地点的技能检定期间揭示 [bless] 标记时：对钥匙看管者造成 1 点恐惧并发现你所在地点
//   或一个连接地点的 1 个线索。
//   强制 - 在钥匙看管者将要离场时：将其放在一边，位于场外。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自卡面数据 `bondedTo: 'Seal of the Elders'`（src/engine/bonded.js），条目不需要字段。
//   · 「在你地点的技能检定期间揭示 [bless] 标记时」= reaction + trigger:'chaosTokenResolved'
//     （tests.js ST.4 之后的窗口，context = { when, seat, location, token, tokenIndex, modifier }；
//     07191/07116 是同一窗口的既有条目），criteria 核对 token 与「你的地点」。
//   · 同一次揭示只触发一次：resolve 里写一条 endOfTest 标记效果（sourceInstanceId 带 tokenIndex），
//     criteria 见到该标记就不再列出——引擎的能力窗口会在同一窗口内重新枚举候选，没有这个标记
//     同一张卡会被反复询问（不新造状态字段，标记随本次检定结束过期）。
//   · 「对钥匙看管者造成 1 点恐惧」= api.placeAssetHarm(source, { horror: 1 })（支援伤恐的唯一入口，
//     达到神智上限会走 checkAssetDefeated 离场）。
//   · 「发现你所在地点或一个连接地点的线索」= api.discoverClue(seat, 1, locationId)
//     （发现线索的唯一入口，只列仍有线索的地点）。
// 离场时通过绑定区的回收入口放在一边。
const CODE = '10106'
const MAIN = '10105'
const BLESS = 'bless'

const markedThisToken = (state, tokenIndex) => (state.effects || []).some(effect =>
  effect.sourceCode === CODE && effect.sourceInstanceId === `${CODE}:token:${tokenIndex}`)

const markToken = (api, inv, tokenIndex) => api.addEffect({
  duration: 'endOfTest',
  sourceCode: CODE,
  sourceInstanceId: `${CODE}:token:${tokenIndex}`,
  controllerSeat: inv.seat,
  label: '钥匙看管者：本次揭示的祝福标记已结算',
})

// 「你所在地点或一个连接地点」：只列仍有线索的地点。
function clueLocations(state, inv) {
  const here = (state.locations || []).find(location => location.id === inv.location)
  const ids = [inv.location, ...(here?.connections || [])]
  return [...new Set(ids)]
    .map(id => (state.locations || []).find(location => location.id === id))
    .filter(location => location && (location.clues || 0) > 0)
}

export default {
  code: CODE,
  name: '钥匙看管者',
  zoneReplacement: { discard: 'bonded' },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'chaosTokenResolved',
      label: '揭示祝福标记后：对钥匙看管者造成 1 点恐惧，发现你地点或连接地点的 1 个线索',
      criteria: [({ state, inv, source, context }) => {
        if (!source || context?.when !== 'chaosTokenResolved') return false
        if (context.token !== BLESS || context.location !== inv.location) return false
        return !markedThisToken(state, context.tokenIndex ?? 0)
      }],
      resolve: ({ state, inv, source, context, api }) => {
        api.placeAssetHarm(source, { horror: 1 })
        api.info(`🗝️ 「钥匙看管者」：受到 1 点恐惧（${source.horror || 0}/${source.sanity ?? 4}）。`)
        markToken(api, inv, context?.tokenIndex ?? 0)
        const candidates = clueLocations(state, inv)
        if (!candidates.length) {
          api.info('🗝️ 「钥匙看管者」：你所在地点与连接地点都没有线索。')
          return
        }
        const id = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'location', source: CODE, seat: inv.seat,
          prompt: '「钥匙看管者」：选择发现线索的地点。',
          options: candidates.map(location => ({ id: location.id, label: api.locationName(location.id) })),
        })
        const found = api.discoverClue(inv.seat, 1, id)
        api.info(`🗝️ 「钥匙看管者」：在「${api.locationName(id)}」${found ? '发现 1 个线索' : '没有发现线索'}。`)
      },
    },
    {
      kind: 'leavesPlay',
      label: '离场：放在一边，位于场外（收回场外绑定集合）',
      resolve: ({ inv, source, api }) => {
        if (!api.bonded.returnAsset(inv.seat, source)) return
        api.info('🗝️ 「钥匙看管者」：放在一边，位于场外。')
      },
    },
  ],
  modifiers: [],
}
