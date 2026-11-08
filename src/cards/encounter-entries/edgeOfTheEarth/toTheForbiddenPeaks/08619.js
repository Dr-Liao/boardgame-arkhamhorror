// 08619 小型收音机（Small Radio）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(3补给)。
//   你可以触发不在场上的探险队遭遇组的支援上的能力(仅限在剧本日志中没有划掉名字的支援)。
//   不支付该能力的非[action]费用，改为横置小型收音机并花费1补给。
//
// 读点：free 描述子（玩家窗口 / legalMoves）。「不在场上的 Expedition 支援」= 本章布置时
// 按「Supplies Recovered」放进放一边区的 7 件剧情支援（behavior.afterDeckSetup）。
// approximation: 引擎没有「在不在场的支援上触发能力」的通用原语，本卡结算为
//   「远程联络：把一件放一边的 Expedition 支援放置入场到你的地点」——保留「横置小型收音机
//   并花费 1 补给」的真实费用与真实目标来源；该近似已在 behavior.scenarioGaps 登记。
const EXPEDITION_ASSET_CODES = Object.freeze(['08614', '08615', '08616', '08617', '08618', '08619', '08620'])

export default {
  code: '08619',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  flags: { expedition: true },
  abilities: [{
    kind: 'free',
    actionKind: 'activate',
    label: '横置并花费 1 补给：远程联络一件不在场上的 Expedition 支援（近似：将其放置入场）',
    cost: { action: false, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const setAside = state.scenarioZones?.setAside || []
      const candidates = setAside.filter(code => EXPEDITION_ASSET_CODES.includes(String(code)))
      if (!candidates.length) {
        api.info('📻 小型收音机：没有可联络的 Expedition 支援。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0] : api.choice({
        kind: 'card', source: '08619', seat: inv.seat,
        prompt: '小型收音机：选择要远程联络的 Expedition 支援。',
        options: candidates.map(code => ({ id: String(code), cardCode: String(code), label: api.cardName(String(code)) })),
      })
      const code = candidates.includes(chosen) ? chosen : candidates[0]
      api.takeFromSetAside(code)
      api.storyAsset(code, inv.location)
      const hereName = state.locations.find(location => location.id === inv.location)?.name || inv.location
      api.info(`📻 小型收音机：联络到「${api.cardName(code)}」，它已到达「${hereName}」。`)
    },
  }],
}
