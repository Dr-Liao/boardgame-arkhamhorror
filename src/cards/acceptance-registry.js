// 逐单元验收账本的集中登记处（docs/test/ACCEPTANCE-ORDER.md）。
//
// 历史四个循环（core / dunwich / carcosa / tfa 调查员+玩家）在 import-cards.mjs 里按各自账本
// 接线；2026-11-24 起的逐单元验收不再往 import-cards 里加分支，而是把生成的账本模块登记在
// 这里：账本模块是唯一事实来源（含 SHA-256），import-cards 只按 verified(code) 提升目录状态。
//
// 新增单元时：
//   1. node tools/audit-card-unit.mjs <unitId> --write  生成 audit/<unit>-acceptance.json 与 src/cards/<unit>-acceptance.js
//   2. 在本文件 import 该模块并追加 { profile, verified }
//   3. node tools/import-cards.mjs --write && node tools/build-presentation.mjs --write
import { RCORE_ACCEPTANCE_PROFILE, rcoreCardVerified } from './rcore-acceptance.js'
import { TFA_SHARD1_ACCEPTANCE_PROFILE, tfaShard1CardVerified } from './tfa-shard1-acceptance.js'
import { TFA_SHARD2_ACCEPTANCE_PROFILE, tfaShard2CardVerified } from './tfa-shard2-acceptance.js'
import { TFA_SHARD3_ACCEPTANCE_PROFILE, tfaShard3CardVerified } from './tfa-shard3-acceptance.js'
import { TCU_SHARD1_ACCEPTANCE_PROFILE, tcuShard1CardVerified } from './05-a-1-acceptance.js'
import { TCU_SHARD2_ACCEPTANCE_PROFILE, tcuShard2CardVerified } from './05-a-2-acceptance.js'
import { TCU_SHARD3_ACCEPTANCE_PROFILE, tcuShard3CardVerified } from './05-a-3-acceptance.js'
import { TCU_SHARD4_ACCEPTANCE_PROFILE, tcuShard4CardVerified } from './05-a-4-acceptance.js'
import { TCU_SHARD5_ACCEPTANCE_PROFILE, tcuShard5CardVerified } from './05-a-5-acceptance.js'
import { TCU_SHARD6_ACCEPTANCE_PROFILE, tcuShard6CardVerified } from './05-a-6-acceptance.js'
import { TCU_SHARD7_ACCEPTANCE_PROFILE, tcuShard7CardVerified } from './05-a-7-acceptance.js'
import { TCU_SHARD8_ACCEPTANCE_PROFILE, tcuShard8CardVerified } from './05-a-8-acceptance.js'
import { TDE_SHARD1_ACCEPTANCE_PROFILE, tdeShard1CardVerified } from './06-a-1-acceptance.js'
import { TDE_SHARD2_ACCEPTANCE_PROFILE, tdeShard2CardVerified } from './06-a-2-acceptance.js'
import { TDE_SHARD3_ACCEPTANCE_PROFILE, tdeShard3CardVerified } from './06-a-3-acceptance.js'
import { TDE_SHARD4_ACCEPTANCE_PROFILE, tdeShard4CardVerified } from './06-a-4-acceptance.js'
import { TDE_SHARD5_ACCEPTANCE_PROFILE, tdeShard5CardVerified } from './06-a-5-acceptance.js'
import { TDE_SHARD6_ACCEPTANCE_PROFILE, tdeShard6CardVerified } from './06-a-6-acceptance.js'
import { TDE_SHARD7_ACCEPTANCE_PROFILE, tdeShard7CardVerified } from './06-a-7-acceptance.js'
import { TDE_SHARD8_ACCEPTANCE_PROFILE, tdeShard8CardVerified } from './06-a-8-acceptance.js'
import { TDE_SHARD9_ACCEPTANCE_PROFILE, tdeShard9CardVerified } from './06-a-9-acceptance.js'

import { TIC_SHARD1_ACCEPTANCE_PROFILE, ticShard1CardVerified } from './07-a-1-acceptance.js'
import { TIC_SHARD2_ACCEPTANCE_PROFILE, ticShard2CardVerified } from './07-a-2-acceptance.js'
import { TIC_SHARD3_ACCEPTANCE_PROFILE, ticShard3CardVerified } from './07-a-3-acceptance.js'
import { TIC_SHARD4_ACCEPTANCE_PROFILE, ticShard4CardVerified } from './07-a-4-acceptance.js'
import { TIC_SHARD5_ACCEPTANCE_PROFILE, ticShard5CardVerified } from './07-a-5-acceptance.js'
import { TIC_SHARD6_ACCEPTANCE_PROFILE, ticShard6CardVerified } from './07-a-6-acceptance.js'
import { TIC_SHARD7_ACCEPTANCE_PROFILE, ticShard7CardVerified } from './07-a-7-acceptance.js'
import { TIC_SHARD8_ACCEPTANCE_PROFILE, ticShard8CardVerified } from './07-a-8-acceptance.js'

import { EOTE_SHARD1_ACCEPTANCE_PROFILE, eoteShard1CardVerified } from './08-a-1-acceptance.js'
import { EOTE_SHARD2_ACCEPTANCE_PROFILE, eoteShard2CardVerified } from './08-a-2-acceptance.js'
import { EOTE_SHARD3_ACCEPTANCE_PROFILE, eoteShard3CardVerified } from './08-a-3-acceptance.js'
import { EOTE_SHARD4_ACCEPTANCE_PROFILE, eoteShard4CardVerified } from './08-a-4-acceptance.js'
import { EOTE_SHARD5_ACCEPTANCE_PROFILE, eoteShard5CardVerified } from './08-a-5-acceptance.js'
import { EOTE_SHARD6_ACCEPTANCE_PROFILE, eoteShard6CardVerified } from './08-a-6-acceptance.js'
import { EOTE_SHARD7_ACCEPTANCE_PROFILE, eoteShard7CardVerified } from './08-a-7-acceptance.js'
import { EOTE_SHARD8_ACCEPTANCE_PROFILE, eoteShard8CardVerified } from './08-a-8-acceptance.js'
import { EOTE_SHARD9_ACCEPTANCE_PROFILE, eoteShard9CardVerified } from './08-a-9-acceptance.js'

import { TSK_SHARD1_ACCEPTANCE_PROFILE, tskShard1CardVerified } from './09-a-1-acceptance.js'
import { TSK_SHARD2_ACCEPTANCE_PROFILE, tskShard2CardVerified } from './09-a-2-acceptance.js'
import { TSK_SHARD3_ACCEPTANCE_PROFILE, tskShard3CardVerified } from './09-a-3-acceptance.js'
import { TSK_SHARD4_ACCEPTANCE_PROFILE, tskShard4CardVerified } from './09-a-4-acceptance.js'
import { TSK_SHARD5_ACCEPTANCE_PROFILE, tskShard5CardVerified } from './09-a-5-acceptance.js'
import { TSK_SHARD6_ACCEPTANCE_PROFILE, tskShard6CardVerified } from './09-a-6-acceptance.js'
import { TSK_SHARD7_ACCEPTANCE_PROFILE, tskShard7CardVerified } from './09-a-7-acceptance.js'
import { TSK_SHARD8_ACCEPTANCE_PROFILE, tskShard8CardVerified } from './09-a-8-acceptance.js'
import { TSK_SHARD9_ACCEPTANCE_PROFILE, tskShard9CardVerified } from './09-a-9-acceptance.js'
import { TSK_SHARD10_ACCEPTANCE_PROFILE, tskShard10CardVerified } from './09-a-10-acceptance.js'

import { FHV_SHARD1_ACCEPTANCE_PROFILE, fhvShard1CardVerified } from './10-a-1-acceptance.js'
import { FHV_SHARD2_ACCEPTANCE_PROFILE, fhvShard2CardVerified } from './10-a-2-acceptance.js'
import { FHV_SHARD3_ACCEPTANCE_PROFILE, fhvShard3CardVerified } from './10-a-3-acceptance.js'
import { FHV_SHARD4_ACCEPTANCE_PROFILE, fhvShard4CardVerified } from './10-a-4-acceptance.js'
import { FHV_SHARD5_ACCEPTANCE_PROFILE, fhvShard5CardVerified } from './10-a-5-acceptance.js'
import { FHV_SHARD6_ACCEPTANCE_PROFILE, fhvShard6CardVerified } from './10-a-6-acceptance.js'
import { FHV_SHARD7_ACCEPTANCE_PROFILE, fhvShard7CardVerified } from './10-a-7-acceptance.js'
import { FHV_SHARD8_ACCEPTANCE_PROFILE, fhvShard8CardVerified } from './10-a-8-acceptance.js'
import { FHV_SHARD9_ACCEPTANCE_PROFILE, fhvShard9CardVerified } from './10-a-9-acceptance.js'
import { FHV_SHARD10_ACCEPTANCE_PROFILE, fhvShard10CardVerified } from './10-a-10-acceptance.js'
import { FHV_SHARD11_ACCEPTANCE_PROFILE, fhvShard11CardVerified } from './10-a-11-acceptance.js'

import { TDC_SHARD1_ACCEPTANCE_PROFILE, tdcShard1CardVerified } from './11-a-1-acceptance.js'
import { TDC_SHARD2_ACCEPTANCE_PROFILE, tdcShard2CardVerified } from './11-a-2-acceptance.js'
import { TDC_SHARD3_ACCEPTANCE_PROFILE, tdcShard3CardVerified } from './11-a-3-acceptance.js'
import { TDC_SHARD4_ACCEPTANCE_PROFILE, tdcShard4CardVerified } from './11-a-4-acceptance.js'
import { TDC_SHARD5_ACCEPTANCE_PROFILE, tdcShard5CardVerified } from './11-a-5-acceptance.js'
import { TDC_SHARD6_ACCEPTANCE_PROFILE, tdcShard6CardVerified } from './11-a-6-acceptance.js'
import { TDC_SHARD7_ACCEPTANCE_PROFILE, tdcShard7CardVerified } from './11-a-7-acceptance.js'
import { TDC_SHARD8_ACCEPTANCE_PROFILE, tdcShard8CardVerified } from './11-a-8-acceptance.js'
import { TDC_SHARD9_ACCEPTANCE_PROFILE, tdcShard9CardVerified } from './11-a-9-acceptance.js'
import { TDC_SHARD10_ACCEPTANCE_PROFILE, tdcShard10CardVerified } from './11-a-10-acceptance.js'

import { CORE2026_SHARD1_ACCEPTANCE_PROFILE, core2026Shard1CardVerified } from './12-a-1-acceptance.js'
import { CORE2026_SHARD2_ACCEPTANCE_PROFILE, core2026Shard2CardVerified } from './12-a-2-acceptance.js'
import { CORE2026_SHARD3_ACCEPTANCE_PROFILE, core2026Shard3CardVerified } from './12-a-3-acceptance.js'
import { CORE2026_SHARD4_ACCEPTANCE_PROFILE, core2026Shard4CardVerified } from './12-a-4-acceptance.js'
import { CORE2026_SHARD5_ACCEPTANCE_PROFILE, core2026Shard5CardVerified } from './12-a-5-acceptance.js'
import { RETURN_SERIES_ACCEPTANCE_PROFILE, returnSeriesCardVerified } from './50-a-acceptance.js'
import { STARTER_INVESTIGATORS_ACCEPTANCE_PROFILE, starterInvestigatorPackCardVerified } from './60-a-acceptance.js'

export const CARD_ACCEPTANCE_REGISTRY = Object.freeze([
  { profile: RCORE_ACCEPTANCE_PROFILE, verified: rcoreCardVerified, ledger: 'audit/rcore-acceptance.json' },
  { profile: TFA_SHARD1_ACCEPTANCE_PROFILE, verified: tfaShard1CardVerified, ledger: 'audit/tfa-shard1-acceptance.json' },
  { profile: TFA_SHARD2_ACCEPTANCE_PROFILE, verified: tfaShard2CardVerified, ledger: 'audit/tfa-shard2-acceptance.json' },
  { profile: TFA_SHARD3_ACCEPTANCE_PROFILE, verified: tfaShard3CardVerified, ledger: 'audit/tfa-shard3-acceptance.json' },
  { profile: TCU_SHARD1_ACCEPTANCE_PROFILE, verified: tcuShard1CardVerified, ledger: 'audit/05-a-1-acceptance.json' },
  { profile: TCU_SHARD2_ACCEPTANCE_PROFILE, verified: tcuShard2CardVerified, ledger: 'audit/05-a-2-acceptance.json' },
  { profile: TCU_SHARD3_ACCEPTANCE_PROFILE, verified: tcuShard3CardVerified, ledger: 'audit/05-a-3-acceptance.json' },
  { profile: TCU_SHARD4_ACCEPTANCE_PROFILE, verified: tcuShard4CardVerified, ledger: 'audit/05-a-4-acceptance.json' },
  { profile: TCU_SHARD5_ACCEPTANCE_PROFILE, verified: tcuShard5CardVerified, ledger: 'audit/05-a-5-acceptance.json' },
  { profile: TCU_SHARD6_ACCEPTANCE_PROFILE, verified: tcuShard6CardVerified, ledger: 'audit/05-a-6-acceptance.json' },
  { profile: TCU_SHARD7_ACCEPTANCE_PROFILE, verified: tcuShard7CardVerified, ledger: 'audit/05-a-7-acceptance.json' },
  { profile: TCU_SHARD8_ACCEPTANCE_PROFILE, verified: tcuShard8CardVerified, ledger: 'audit/05-a-8-acceptance.json' },
  { profile: TDE_SHARD1_ACCEPTANCE_PROFILE, verified: tdeShard1CardVerified, ledger: 'audit/06-a-1-acceptance.json' },
  { profile: TDE_SHARD2_ACCEPTANCE_PROFILE, verified: tdeShard2CardVerified, ledger: 'audit/06-a-2-acceptance.json' },
  { profile: TDE_SHARD3_ACCEPTANCE_PROFILE, verified: tdeShard3CardVerified, ledger: 'audit/06-a-3-acceptance.json' },
  { profile: TDE_SHARD4_ACCEPTANCE_PROFILE, verified: tdeShard4CardVerified, ledger: 'audit/06-a-4-acceptance.json' },
  { profile: TDE_SHARD5_ACCEPTANCE_PROFILE, verified: tdeShard5CardVerified, ledger: 'audit/06-a-5-acceptance.json' },
  { profile: TDE_SHARD6_ACCEPTANCE_PROFILE, verified: tdeShard6CardVerified, ledger: 'audit/06-a-6-acceptance.json' },
  { profile: TDE_SHARD7_ACCEPTANCE_PROFILE, verified: tdeShard7CardVerified, ledger: 'audit/06-a-7-acceptance.json' },
  { profile: TDE_SHARD8_ACCEPTANCE_PROFILE, verified: tdeShard8CardVerified, ledger: 'audit/06-a-8-acceptance.json' },
  { profile: TDE_SHARD9_ACCEPTANCE_PROFILE, verified: tdeShard9CardVerified, ledger: 'audit/06-a-9-acceptance.json' },
  { profile: TIC_SHARD1_ACCEPTANCE_PROFILE, verified: ticShard1CardVerified, ledger: 'audit/07-a-1-acceptance.json' },
  { profile: TIC_SHARD2_ACCEPTANCE_PROFILE, verified: ticShard2CardVerified, ledger: 'audit/07-a-2-acceptance.json' },
  { profile: TIC_SHARD3_ACCEPTANCE_PROFILE, verified: ticShard3CardVerified, ledger: 'audit/07-a-3-acceptance.json' },
  { profile: TIC_SHARD4_ACCEPTANCE_PROFILE, verified: ticShard4CardVerified, ledger: 'audit/07-a-4-acceptance.json' },
  { profile: TIC_SHARD5_ACCEPTANCE_PROFILE, verified: ticShard5CardVerified, ledger: 'audit/07-a-5-acceptance.json' },
  { profile: TIC_SHARD6_ACCEPTANCE_PROFILE, verified: ticShard6CardVerified, ledger: 'audit/07-a-6-acceptance.json' },
  { profile: TIC_SHARD7_ACCEPTANCE_PROFILE, verified: ticShard7CardVerified, ledger: 'audit/07-a-7-acceptance.json' },
  { profile: TIC_SHARD8_ACCEPTANCE_PROFILE, verified: ticShard8CardVerified, ledger: 'audit/07-a-8-acceptance.json' },
  { profile: EOTE_SHARD1_ACCEPTANCE_PROFILE, verified: eoteShard1CardVerified, ledger: 'audit/08-a-1-acceptance.json' },
  { profile: EOTE_SHARD2_ACCEPTANCE_PROFILE, verified: eoteShard2CardVerified, ledger: 'audit/08-a-2-acceptance.json' },
  { profile: EOTE_SHARD3_ACCEPTANCE_PROFILE, verified: eoteShard3CardVerified, ledger: 'audit/08-a-3-acceptance.json' },
  { profile: EOTE_SHARD4_ACCEPTANCE_PROFILE, verified: eoteShard4CardVerified, ledger: 'audit/08-a-4-acceptance.json' },
  { profile: EOTE_SHARD5_ACCEPTANCE_PROFILE, verified: eoteShard5CardVerified, ledger: 'audit/08-a-5-acceptance.json' },
  { profile: EOTE_SHARD6_ACCEPTANCE_PROFILE, verified: eoteShard6CardVerified, ledger: 'audit/08-a-6-acceptance.json' },
  { profile: EOTE_SHARD7_ACCEPTANCE_PROFILE, verified: eoteShard7CardVerified, ledger: 'audit/08-a-7-acceptance.json' },
  { profile: EOTE_SHARD8_ACCEPTANCE_PROFILE, verified: eoteShard8CardVerified, ledger: 'audit/08-a-8-acceptance.json' },
  { profile: EOTE_SHARD9_ACCEPTANCE_PROFILE, verified: eoteShard9CardVerified, ledger: 'audit/08-a-9-acceptance.json' },
  { profile: TSK_SHARD1_ACCEPTANCE_PROFILE, verified: tskShard1CardVerified, ledger: 'audit/09-a-1-acceptance.json' },
  { profile: TSK_SHARD2_ACCEPTANCE_PROFILE, verified: tskShard2CardVerified, ledger: 'audit/09-a-2-acceptance.json' },
  { profile: TSK_SHARD3_ACCEPTANCE_PROFILE, verified: tskShard3CardVerified, ledger: 'audit/09-a-3-acceptance.json' },
  { profile: TSK_SHARD4_ACCEPTANCE_PROFILE, verified: tskShard4CardVerified, ledger: 'audit/09-a-4-acceptance.json' },
  { profile: TSK_SHARD5_ACCEPTANCE_PROFILE, verified: tskShard5CardVerified, ledger: 'audit/09-a-5-acceptance.json' },
  { profile: TSK_SHARD6_ACCEPTANCE_PROFILE, verified: tskShard6CardVerified, ledger: 'audit/09-a-6-acceptance.json' },
  { profile: TSK_SHARD7_ACCEPTANCE_PROFILE, verified: tskShard7CardVerified, ledger: 'audit/09-a-7-acceptance.json' },
  { profile: TSK_SHARD8_ACCEPTANCE_PROFILE, verified: tskShard8CardVerified, ledger: 'audit/09-a-8-acceptance.json' },
  { profile: TSK_SHARD9_ACCEPTANCE_PROFILE, verified: tskShard9CardVerified, ledger: 'audit/09-a-9-acceptance.json' },
  { profile: TSK_SHARD10_ACCEPTANCE_PROFILE, verified: tskShard10CardVerified, ledger: 'audit/09-a-10-acceptance.json' },
  { profile: FHV_SHARD1_ACCEPTANCE_PROFILE, verified: fhvShard1CardVerified, ledger: 'audit/10-a-1-acceptance.json' },
  { profile: FHV_SHARD2_ACCEPTANCE_PROFILE, verified: fhvShard2CardVerified, ledger: 'audit/10-a-2-acceptance.json' },
  { profile: FHV_SHARD3_ACCEPTANCE_PROFILE, verified: fhvShard3CardVerified, ledger: 'audit/10-a-3-acceptance.json' },
  { profile: FHV_SHARD4_ACCEPTANCE_PROFILE, verified: fhvShard4CardVerified, ledger: 'audit/10-a-4-acceptance.json' },
  { profile: FHV_SHARD5_ACCEPTANCE_PROFILE, verified: fhvShard5CardVerified, ledger: 'audit/10-a-5-acceptance.json' },
  { profile: FHV_SHARD6_ACCEPTANCE_PROFILE, verified: fhvShard6CardVerified, ledger: 'audit/10-a-6-acceptance.json' },
  { profile: FHV_SHARD7_ACCEPTANCE_PROFILE, verified: fhvShard7CardVerified, ledger: 'audit/10-a-7-acceptance.json' },
  { profile: FHV_SHARD8_ACCEPTANCE_PROFILE, verified: fhvShard8CardVerified, ledger: 'audit/10-a-8-acceptance.json' },
  { profile: FHV_SHARD9_ACCEPTANCE_PROFILE, verified: fhvShard9CardVerified, ledger: 'audit/10-a-9-acceptance.json' },
  { profile: FHV_SHARD10_ACCEPTANCE_PROFILE, verified: fhvShard10CardVerified, ledger: 'audit/10-a-10-acceptance.json' },
  { profile: FHV_SHARD11_ACCEPTANCE_PROFILE, verified: fhvShard11CardVerified, ledger: 'audit/10-a-11-acceptance.json' },
  { profile: TDC_SHARD1_ACCEPTANCE_PROFILE, verified: tdcShard1CardVerified, ledger: 'audit/11-a-1-acceptance.json' },
  { profile: TDC_SHARD2_ACCEPTANCE_PROFILE, verified: tdcShard2CardVerified, ledger: 'audit/11-a-2-acceptance.json' },
  { profile: TDC_SHARD3_ACCEPTANCE_PROFILE, verified: tdcShard3CardVerified, ledger: 'audit/11-a-3-acceptance.json' },
  { profile: TDC_SHARD4_ACCEPTANCE_PROFILE, verified: tdcShard4CardVerified, ledger: 'audit/11-a-4-acceptance.json' },
  { profile: TDC_SHARD5_ACCEPTANCE_PROFILE, verified: tdcShard5CardVerified, ledger: 'audit/11-a-5-acceptance.json' },
  { profile: TDC_SHARD6_ACCEPTANCE_PROFILE, verified: tdcShard6CardVerified, ledger: 'audit/11-a-6-acceptance.json' },
  { profile: TDC_SHARD7_ACCEPTANCE_PROFILE, verified: tdcShard7CardVerified, ledger: 'audit/11-a-7-acceptance.json' },
  { profile: TDC_SHARD8_ACCEPTANCE_PROFILE, verified: tdcShard8CardVerified, ledger: 'audit/11-a-8-acceptance.json' },
  { profile: TDC_SHARD9_ACCEPTANCE_PROFILE, verified: tdcShard9CardVerified, ledger: 'audit/11-a-9-acceptance.json' },
  { profile: TDC_SHARD10_ACCEPTANCE_PROFILE, verified: tdcShard10CardVerified, ledger: 'audit/11-a-10-acceptance.json' },
  { profile: CORE2026_SHARD1_ACCEPTANCE_PROFILE, verified: core2026Shard1CardVerified, ledger: 'audit/12-a-1-acceptance.json' },
  { profile: CORE2026_SHARD2_ACCEPTANCE_PROFILE, verified: core2026Shard2CardVerified, ledger: 'audit/12-a-2-acceptance.json' },
  { profile: CORE2026_SHARD3_ACCEPTANCE_PROFILE, verified: core2026Shard3CardVerified, ledger: 'audit/12-a-3-acceptance.json' },
  { profile: CORE2026_SHARD4_ACCEPTANCE_PROFILE, verified: core2026Shard4CardVerified, ledger: 'audit/12-a-4-acceptance.json' },
  { profile: CORE2026_SHARD5_ACCEPTANCE_PROFILE, verified: core2026Shard5CardVerified, ledger: 'audit/12-a-5-acceptance.json' },
  { profile: RETURN_SERIES_ACCEPTANCE_PROFILE, verified: returnSeriesCardVerified, ledger: 'audit/50-a-acceptance.json' },
  { profile: STARTER_INVESTIGATORS_ACCEPTANCE_PROFILE, verified: starterInvestigatorPackCardVerified, ledger: 'audit/60-a-acceptance.json' },
])
