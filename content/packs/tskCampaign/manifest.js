// 绯红密钥 · 战役内容包（P0/M0 catalog-only）。
//
// 归属规则（与 audit/tsk-scope.json 的 tskCampaign 分区一致）：
//   · 卡表 pack=tskc 的 311 条印刷记录（10 张剧本参考卡 + 幕/议程/地点/敌人/诡计/剧情/
//     双面绯红密钥 + 关联面）全部归战役包；
//   · 26 个遭遇组（10 章节组 + 16 共享组）在清单里登记 id，供 P7 逐章接线；
//   · P5–P8 验收前 rulesImplemented=false、deckbuilding=false，战役不可启动。
import { catalogPack } from '../../campaigns/theScarletKeys/shared.js'

export const manifest = catalogPack('tskCampaign', '绯红密钥 · 战役内容', [
  { from: '09501', to: '09770' },
  { from: '09519a', to: '09770b' },
])
