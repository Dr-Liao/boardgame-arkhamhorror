// 09659a 法罗斯之光（The Light of Pharos · Coral Prism / 珊瑚棱镜）· 绯红密钥 · [[Stable]] 面
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09659b（[[Unstable]] 面）。
// 卡面（中）：变换 - 打出你的 1 张手牌，其费用 -3。将本钥匙翻至[[动荡]]面。
//
// 密钥契约（docs/campaign/theScarletKeys/primitives.md §2 tsk-scarlet-keys + 同循环 globetrotting 密钥）：
//   · 密钥实体登记在 `campaign.tsk.keys`（id `09659`，stableFace `09659a` / unstableFace `09659b`）；
//   · 密钥卡不是场景在场实体，条目字段只能是注册表允许的键，因此 Shift 声明放在 `assetRule.keyShift`；
//   · 结算入口是章节 behavior.resolveKeyShift：先调本条的 `assetRule.keyShift.resolve({state,api,inv,keyId})`
//     结算效果，再由 content 决定翻面（调查员变换 → 翻到动荡面；敌人强制变换 → 只结算效果、不翻面）；
//   · 本条 resolve 只结算「打出一张手牌，费用 -3」：候选是手中卡牌，走引擎的
//     api.playCardFromHandFree（折扣 3，仍走正常打出/入场/反应窗口与费用支付）；弱点由引擎的
//     打出规则拒绝（`doPlay` 直接返回），因此不需要在这里另做卡表查询。
const CODE = '09659a'
const KEY_ID = '09659'
const DISCOUNT = 3

function handCards(inv) {
  return [...new Set(inv?.hand || [])]
}

/** 变换效果：选择手牌，费用 -3 打出。 */
function resolveFace({ inv, api }) {
  const candidates = handCards(inv)
  if (!candidates.length) {
    api?.info?.('「法罗斯之光」（稳定面）：你手里没有可以打出的卡牌。')
    return { played: null }
  }
  const answer = candidates.length === 1 ? candidates[0] : api?.choice?.({
    kind: 'card', source: CODE, seat: inv?.seat ?? 0,
    prompt: '「法罗斯之光」（稳定面）：选择 1 张手牌，费用 -3 打出。',
    options: candidates.map(code => ({ id: code, cardCode: code, label: api?.cardName?.(code) || code })),
  })
  const chosen = candidates.includes(answer) ? answer : candidates[0]
  const played = typeof api?.playCardFromHandFree === 'function'
    ? api.playCardFromHandFree(inv?.seat ?? 0, chosen, { discount: DISCOUNT })
    : false
  api?.info?.(`🔑 「法罗斯之光」（稳定面）：以费用 -3 打出「${api?.cardName?.(chosen) || chosen}」`
    + `（${played ? '已打出' : '未能打出，折扣不保留'}）。`)
  return { played: played ? chosen : null }
}

export default {
  code: CODE,
  name: '法罗斯之光',
  scope: 'storyAsset',
  implemented: true,
  flags: { scarletKey: true, keyTitle: KEY_ID, keyFace: 'stable', pairCode: '09659b' },
  assetRule: {
    keyShift: {
      keyId: KEY_ID,
      face: 'stable',
      trigger: 'investigatorFastWindow',
      effect: { kind: 'playFromHandDiscounted', discount: DISCOUNT },
      resolve: ({ state, api, inv }) => resolveFace({ state, api, inv }),
    },
  },
  note: 'approximation: 密钥不作为在场实体进入卡表（引擎只在 `campaign.tsk.keys` 记持有者与朝向），'
    + '「打出 1 张手牌费用 -3」用 api.playCardFromHandFree({discount:3}) 近似：'
    + '若该牌在当前时机不能打出，折扣不保留（卡面也不保留）；候选列表不预筛弱点（由引擎的打出规则拒绝）。'
    + '见 primitive-requests/09659a.json。',
}
