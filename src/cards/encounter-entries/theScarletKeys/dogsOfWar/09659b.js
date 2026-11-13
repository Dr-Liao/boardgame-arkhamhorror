// 09659b 法罗斯之光（The Light of Pharos · Coral Prism / 珊瑚棱镜）· 绯红密钥 · [[Unstable]] 面
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09659a（[[Stable]] 面）。
// 卡面（中）：变换 - 每位调查员必须随机弃掉自己 2 张非弱点手牌。然后，如果是调查员变换了本钥匙，
//   将其翻至[[稳定]]面。
//
// 密钥契约（同 09659a）：
//   · 实体登记在 `campaign.tsk.keys`（id `09659`）；Shift 声明在 `assetRule.keyShift`；
//   · 结算入口 behavior.resolveKeyShift：先调本条 resolve 结算「每位调查员弃 2 张非弱点手牌」，
//     再由 content 决定翻面（调查员变换 → 翻回稳定面；敌人强制变换 → 不翻回）；
//   · 「随机弃掉」用 api.discardOneFromHand 两次近似：引擎的弃手牌入口是选择式（没有「随机」参数），
//     见 primitive-requests/09659b.json。
const CODE = '09659b'
const KEY_ID = '09659'
const DISCARD_COUNT = 2

/** 变换效果：每位调查员弃 2 张非弱点手牌（引擎没有随机弃手牌入口，用弃手牌入口近似）。 */
function resolveFace({ state, api }) {
  const victims = (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
  const discarded = []
  for (const inv of victims) {
    for (let index = 0; index < DISCARD_COUNT; index += 1) {
      const code = typeof api?.discardOneFromHand === 'function'
        ? api.discardOneFromHand(inv.seat, { source: CODE })
        : null
      if (code) discarded.push({ seat: inv.seat, code })
    }
  }
  api?.info?.(`🔑 「法罗斯之光」（动荡面）：${victims.length} 位调查员各弃掉最多 ${DISCARD_COUNT} 张手牌`
    + `（实际弃掉 ${discarded.length} 张）。`)
  return { discarded }
}

export default {
  code: CODE,
  name: '法罗斯之光',
  scope: 'storyAsset',
  implemented: true,
  flags: { scarletKey: true, keyTitle: KEY_ID, keyFace: 'unstable', pairCode: '09659a' },
  assetRule: {
    keyShift: {
      keyId: KEY_ID,
      face: 'unstable',
      trigger: 'investigatorFastWindow',
      effect: { kind: 'discardRandomFromHand', count: DISCARD_COUNT },
      resolve: ({ state, api }) => resolveFace({ state, api }),
    },
  },
  note: 'approximation: 「随机弃掉 2 张非弱点手牌」用 api.discardOneFromHand ×2 近似（引擎的弃手牌入口是'
    + '选择式，没有随机参数，弱点由该入口跳过）；「如是调查员变换则翻回稳定面」由 behavior.resolveKeyShift 的'
    + ' by="investigator" 分支完成（敌人强制变换只结算效果）。见 primitive-requests/09659b.json。',
}
