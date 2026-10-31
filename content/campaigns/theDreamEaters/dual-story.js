// 食梦者（The Dream-Eaters）· 双线尾声：16 段结局矩阵、特殊结局子步骤与 flow 接线（P8）。
//
// 事实源：参考实现 `Campaigns/TheDreamEaters.hs` C:736-832 与锁定英文包
// `参考资源/.../locales/en/theDreamEaters/base.json`：
//   · A4《神居之所》的 4 种最终态（4 条记录）× B4《编织宇宙》的 4 种最终态（4 条记录）
//     = 16 段尾声（Epilogue 1–16），正文键 `theDreamEaters.flavorText.epilogue<n>`；
//   · 矩阵本身是 locale 里的一张静态表（`epilogueMatrix`，靠 `data-selected` / `count`
//     高亮当前格），不是运行时拼的；
//   · 特殊子步骤：Epilogue 5 → 所有 A 线调查员被击杀（Part 5）；Epilogue 13 → 所有 A 线
//     调查员发疯（Part 13）；随后统一进入 Part 17——若存在「被俘且未出局」的调查员，
//     念 `brokeTheLawOfUlthar` 绿字并击杀，然后 GameOver（C:822-832）；
//   · 单线（仅 A / 仅 B）参考实现直接 `GameOver`，**不播放任何尾声正文**（C:738）。
//
// 与 `src/campaign/epilogue-matrix.js` 的契约：矩阵形状 `{ a:[{id,title}], b:[{id,title}],
// entries:{ 'aId|bId': { title, textKey } } }`；本文件只存英文 `textKey` 与结构，
// **不写中文摘要**（P8-T 统一翻译；`pendingTranslation` 标记未译状态）。
// 剧情正文的落点是后续 P8-T 的 `story-text.js`（键名与本文件一致）。
import { epilogueFor, normalizeEpilogueMatrix } from '../../../src/campaign/epilogue-matrix.js'

const FLAVOR = 'theDreamEaters.flavorText'

// A 轴：A4《神居之所》的 4 种最终态（顺序同参考实现 C:740-743 的读取顺序）。
export const TDE_EPILOGUE_A_AXIS = Object.freeze([
  Object.freeze({
    id: 'nyarlathotepsInvasionHasBegun',
    record: 'nyarlathotepsInvasionHasBegun',
    title: "Nyarlathotep's invasion has begun",
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
  Object.freeze({
    id: 'theDreamersAwoke',
    record: 'theDreamersAwoke',
    title: 'The dreamers awoke',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
  Object.freeze({
    id: 'theDreamersStayedInTheDreamlandsForever',
    record: 'theDreamersStayedInTheDreamlandsForever',
    title: 'The dreamers stayed in the Dreamlands forever',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
  Object.freeze({
    id: 'theDreamersTraveledBeneathTheMonastery',
    record: 'theDreamersTraveledBeneathTheMonastery',
    title: 'The dreamers traveled beneath the monastery',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
])

// B 轴：B4《编织宇宙》的 4 种最终态（顺序同 C:744-747，也是矩阵表的列顺序）。
export const TDE_EPILOGUE_B_AXIS = Object.freeze([
  Object.freeze({
    id: 'theBridgeWasCompleted',
    record: 'theBridgeWasCompleted',
    title: 'The bridge was completed',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
  Object.freeze({
    id: 'theInvestigatorsReturnedToReality',
    record: 'theInvestigatorsReturnedToReality',
    title: 'The investigators returned to reality',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
  Object.freeze({
    id: 'theInvestigatorsNeverEscaped',
    record: 'theInvestigatorsNeverEscaped',
    title: 'The investigators never escaped',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
  Object.freeze({
    id: 'theInvestigatorsAreStillInTheDreamlands',
    record: 'theInvestigatorsAreStillInTheDreamlands',
    title: 'The investigators are still in the Dreamlands',
    titleKey: `${FLAVOR}.epilogueMatrix`,
  }),
])

// 4×4 编号表：行 = A 轴，列 = B 轴；值 = Epilogue 序号（与参考实现的 case 一一对应）。
export const TDE_EPILOGUE_GRID = Object.freeze(
  TDE_EPILOGUE_A_AXIS.map((a, rowIndex) =>
    Object.freeze(TDE_EPILOGUE_B_AXIS.map((b, columnIndex) => rowIndex * 4 + columnIndex + 1))),
)

/** Epilogue 序号 → 正文 textKey。 */
export function epilogueTextKey(number) {
  return `${FLAVOR}.epilogue${number}`
}

/** 某一格的结局条目（matrix.entries 的形状）；越界/未知组合返回 null。 */
export function tdeEpilogueEntry(aId, bId) {
  return epilogueFor(TDE_EPILOGUE_MATRIX, aId, bId)
}

function buildEntries() {
  const entries = {}
  TDE_EPILOGUE_A_AXIS.forEach((a, rowIndex) => {
    TDE_EPILOGUE_B_AXIS.forEach((b, columnIndex) => {
      const number = rowIndex * 4 + columnIndex + 1
      entries[`${a.id}|${b.id}`] = Object.freeze({
        title: `Epilogue ${number}`,
        number,
        textKey: epilogueTextKey(number),
        pendingTranslation: true,
      })
    })
  })
  return Object.freeze(entries)
}

/**
 * 16 段尾声矩阵（形状符合 `src/campaign/epilogue-matrix.js`）。
 * `textKey` 指向锁定英文包里的结局正文；中文由 P8-T 的 story-text 生成器补齐。
 */
export const TDE_EPILOGUE_MATRIX = Object.freeze({
  a: TDE_EPILOGUE_A_AXIS,
  b: TDE_EPILOGUE_B_AXIS,
  entries: buildEntries(),
  grid: TDE_EPILOGUE_GRID,
  matrixTextKey: `${FLAVOR}.epilogueMatrix`,
  pendingTranslation: true,
})

/** 矩阵完整性（16/16）；注册期与测试共用。 */
export function validateEpilogueMatrix() {
  return normalizeEpilogueMatrix(TDE_EPILOGUE_MATRIX)
}

// ---------------------------------------------------------------------------
// 特殊结局子步骤（C:814-832）
// ---------------------------------------------------------------------------
export const TDE_EPILOGUE_STEPS = Object.freeze({
  // Epilogue 5：A 线「入梦者醒来」+ B 线「桥梁已建成」→ 所有 A 线调查员被击杀。
  killCampaignA: Object.freeze({
    step: 5, cell: 5, part: 'A', investigatorStatus: 'killed', textKey: epilogueTextKey(5),
  }),
  // Epilogue 13：A 线「入梦者进入隐修院底下」+ B 线「桥梁已建成」→ 所有 A 线调查员发疯。
  driveCampaignAInsane: Object.freeze({
    step: 13, cell: 13, part: 'A', investigatorStatus: 'insane', textKey: epilogueTextKey(13),
  }),
  // Part 17：所有分支的终点。找「被俘且未出局」的调查员 → 念 brokeTheLawOfUlthar → 击杀 → GameOver。
  brokeTheLawOfUlthar: Object.freeze({
    step: 17,
    record: 'wasCaptured',
    textKey: `${FLAVOR}.brokeTheLawOfUlthar`,
    investigatorStatus: 'killed',
    pendingTranslation: true,
    // 参考实现判 WasCaptured；HasBrokenTheLawOfUlthar 从不写入（见 P8-CAMPAIGN-FACTS §9）。
    note: 'C:823 读的是 wasCaptured（逐调查员集合），不是 hasBrokenTheLawOfUlthar。',
  }),
  matrixTextKey: `${FLAVOR}.epilogueMatrix`,
})

/** 单线（仅 A / 仅 B）：官方无尾声正文，直接 GameOver（C:738）。 */
export const TDE_SINGLE_LINE_EPILOGUE = Object.freeze({
  hasText: false,
  endsWith: 'gameOver',
  note: '单线（singleA / singleB）按参考实现直接结束战役，不播放任何尾声正文；没有 16 段矩阵。',
})

/** 某个 Epilogue 序号的机制分支（5 → 杀 A 线；13 → A 线发疯；其余只有 Part 17）。 */
export function tdeEpilogueMechanics(number) {
  return Object.freeze({
    number,
    killPart: number === TDE_EPILOGUE_STEPS.killCampaignA.cell ? 'A' : null,
    insanePart: number === TDE_EPILOGUE_STEPS.driveCampaignAInsane.cell ? 'A' : null,
    brokeTheLawOfUlthar: true,
    finalStep: TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.step,
  })
}

// ---------------------------------------------------------------------------
// 查表 helper：从两条线的最终态记录定位到 1/16 段
// ---------------------------------------------------------------------------

/** 在某条线的记录里找命中的轴结局 id；没有命中返回 null。 */
export function axisIdFor(records, axis) {
  const keys = axis === 'b' || axis === 'B' ? TDE_EPILOGUE_B_AXIS : TDE_EPILOGUE_A_AXIS
  const source = records || {}
  const hit = keys.find(entry => Boolean(source[entry.record]))
  return hit ? hit.id : null
}

/**
 * 从两条线的最终态记录定位结局：
 *   `partRecords = { A: {...A 线记录}, B: {...B 线记录} }`
 * 返回 `{ a, b, number, entry, mechanics }`；任一条线缺少最终态记录时返回 null
 * （参考实现会 error "invalid"：四个 B 结果必须恰有一个为真，A 侧同理）。
 */
export function tdeEpilogueFor(partRecords = {}) {
  const a = axisIdFor(partRecords.A, 'A')
  const b = axisIdFor(partRecords.B, 'B')
  if (!a || !b) return null
  const entry = tdeEpilogueEntry(a, b)
  if (!entry) return null
  return Object.freeze({ a, b, number: entry.number, entry, mechanics: tdeEpilogueMechanics(entry.number) })
}

/** 被俘的调查员 id 列表（Part 17 的 `wasCaptured` 集合）。 */
export function tdeCapturedInvestigators(partRecords = {}) {
  const captured = partRecords.A?.wasCaptured
  return Array.isArray(captured) ? [...captured] : []
}

// ---------------------------------------------------------------------------
// flow 接线：最后一对章完成的 gate → 16 段尾声矩阵 → Part 17 → end
// ---------------------------------------------------------------------------
//
// 纯数据、无函数：节点类型与 `src/campaign/campaign-flow.js` 对齐。
// 说明（P8 口径）：16 个 option 的 when 读「当前线的 campaign.records」。参考实现是
// `getHasRecord part`（可读另一线的 log）；跨 part 的最终态合并读取属 P9.5 的接线点，
// 本层把两条线的最终态记录键都写进条件，接线时按 part 作用域求值即可。
export function attachEpilogue(flow) {
  const nodes = { ...flow.nodes }
  // 已经接好尾声时原样返回（重复接线会让最后一对 gate 的出口指向尾声入口，语义相同但会重复建节点）。
  if (nodes.epilogueMatrix) return flow
  // 双线 flow 的最后一对 gate 出口原本是 end；改成尾声入口。
  const terminal = Object.entries(nodes).find(([, node]) => node?.type === 'partGate' && node.next === 'end')
  if (!terminal) throw new Error('attachEpilogue 需要以 end 结尾的双线 flow（最后一对章对 gate）')
  nodes[terminal[0]] = { ...terminal[1], next: 'epilogueMatrix' }

  nodes.epilogueMatrix = {
    type: 'branch',
    title: 'Epilogue',
    textKey: TDE_EPILOGUE_MATRIX.matrixTextKey,
    pendingTranslation: true,
    options: TDE_EPILOGUE_A_AXIS.flatMap(a => TDE_EPILOGUE_B_AXIS.map(b => {
      const entry = tdeEpilogueEntry(a.id, b.id)
      return {
        id: `epilogueOption${entry.number}`,
        label: entry.title,
        when: { all: [{ record: a.record, equals: true }, { record: b.record, equals: true }] },
        next: `epilogueStory${entry.number}`,
      }
    })),
    next: 'epilogueStory1',
  }

  for (const a of TDE_EPILOGUE_A_AXIS) {
    for (const b of TDE_EPILOGUE_B_AXIS) {
      const entry = tdeEpilogueEntry(a.id, b.id)
      const mechanics = tdeEpilogueMechanics(entry.number)
      const next = mechanics.killPart ? 'epilogueKillCampaignA'
        : mechanics.insanePart ? 'epilogueDriveCampaignAInsane' : 'epiloguePart17'
      nodes[`epilogueStory${entry.number}`] = {
        type: 'story',
        title: entry.title,
        epilogueNumber: entry.number,
        // P8-T 的 story-text.js 按「a 轴 id | b 轴 id」索引 16 段正文（`tdeEpilogueText(aId,bId)`）。
        storyCell: `${a.id}|${b.id}`,
        storySection: 'epilogue',
        textKey: entry.textKey,
        pendingTranslation: true,
        mechanics,
        next,
      }
    }
  }
  nodes.epilogueKillCampaignA = {
    type: 'story',
    title: 'Epilogue',
    epilogueStep: TDE_EPILOGUE_STEPS.killCampaignA.step,
    part: TDE_EPILOGUE_STEPS.killCampaignA.part,
    investigatorStatus: TDE_EPILOGUE_STEPS.killCampaignA.investigatorStatus,
    pendingTranslation: true,
    next: 'epiloguePart17',
  }
  nodes.epilogueDriveCampaignAInsane = {
    type: 'story',
    title: 'Epilogue',
    epilogueStep: TDE_EPILOGUE_STEPS.driveCampaignAInsane.step,
    part: TDE_EPILOGUE_STEPS.driveCampaignAInsane.part,
    investigatorStatus: TDE_EPILOGUE_STEPS.driveCampaignAInsane.investigatorStatus,
    pendingTranslation: true,
    next: 'epiloguePart17',
  }
  nodes.epiloguePart17 = {
    type: 'story',
    title: 'Epilogue',
    epilogueStep: TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.step,
    record: TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.record,
    storySection: 'epilogue',
    textKey: TDE_EPILOGUE_STEPS.brokeTheLawOfUlthar.textKey,
    pendingTranslation: true,
    next: 'end',
  }
  return { start: flow.start, nodes }
}
