// 绯红密钥 · 一般玩家卡包（P0/M0 catalog-only）。
//
// 归属：tskp 里除 6 位调查员与 14 张专属依赖之外的 108 张主卡（09021–09128），
// 含 16 张定制升级卡与 5 张基础弱点（09124–09128）；重印 canonical 映射见 audit/tsk-scope.json
// （P6 只保留一份实现）。P6 逐卡验收后再改为真实清单。
import { catalogPack } from '../../campaigns/theScarletKeys/shared.js'

export const manifest = catalogPack('tskPlayer', '绯红密钥 · 玩家卡', [
  { from: '09021', to: '09128' },
])
