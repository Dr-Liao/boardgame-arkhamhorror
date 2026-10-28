// 双线结局矩阵（P3 批次 3 原语 `campaign.epilogueMatrix`）。
//
// 食梦者的终局由两条线的最后一章共同决定：A4《梦境尽头》的分歧 × B4《编织宇宙》的分歧，
// 4 × 4 = 16 段结局。这里只做**矩阵数据 + 查表 + 完整性校验**；正文与分支接线属 P8-T。
//
// 矩阵形状（由剧本内容声明，纯数据）：
//   { a: [{ id, title }], b: [{ id, title }], entries: { 'aId|bId': { title, textKey } } }
// 口径：docs/tde-migration-roadmap.md §5.2 `campaign.epilogueMatrix`；账本 batch P3-3。

export const MATRIX_AXES = Object.freeze(['a', 'b'])

function cellKey(aId, bId) {
  if (!aId || !bId) throw new Error('结局矩阵需要两个轴的 id')
  return `${aId}|${bId}`
}

/** 矩阵是否成形（两轴非空、entries 为对象）。 */
export function isEpilogueMatrix(matrix) {
  return Boolean(matrix && Array.isArray(matrix.a) && Array.isArray(matrix.b)
    && matrix.entries && typeof matrix.entries === 'object')
}

/**
 * 完整性校验：每个格子都必须有结局；返回 `{ ok, expected, found, missing, extra }`。
 * `missing` 是 `aId|bId` 列表（顺序按 a 轴再 b 轴），由内容注册期拒绝。
 */
export function normalizeEpilogueMatrix(matrix) {
  if (!isEpilogueMatrix(matrix)) return { ok: false, expected: 0, found: 0, missing: [], extra: [], broken: true }
  const expectedKeys = []
  for (const a of matrix.a) for (const b of matrix.b) expectedKeys.push(cellKey(a.id, b.id))
  const foundKeys = Object.keys(matrix.entries)
  const missing = expectedKeys.filter(key => !foundKeys.includes(key))
  const extra = foundKeys.filter(key => !expectedKeys.includes(key))
  return {
    ok: missing.length === 0 && extra.length === 0,
    expected: expectedKeys.length,
    found: foundKeys.length,
    missing,
    extra,
    broken: false,
  }
}

/** 查表：未知组合返回 null（不抛错，便于 UI 显示「未定义」）。 */
export function epilogueFor(matrix, aId, bId) {
  if (!isEpilogueMatrix(matrix)) return null
  return matrix.entries[cellKey(aId, bId)] || null
}

/** 某条线某结局对应的全部结局（调试/验收用）。 */
export function epiloguesForA(matrix, aId) {
  if (!isEpilogueMatrix(matrix)) return []
  return matrix.b
    .map(b => ({ b: b.id, entry: epilogueFor(matrix, aId, b.id) }))
    .filter(item => Boolean(item.entry))
}

/** 把矩阵展开成扁平列表（16 条），顺序稳定：先 a 轴后 b 轴。 */
export function flattenEpilogueMatrix(matrix) {
  if (!isEpilogueMatrix(matrix)) return []
  const rows = []
  for (const a of matrix.a) {
    for (const b of matrix.b) {
      const entry = epilogueFor(matrix, a.id, b.id)
      if (entry) rows.push({ a: a.id, b: b.id, title: entry.title || null, textKey: entry.textKey || null })
    }
  }
  return rows
}

/** 反向：给一个结局 id 找它的轴坐标（用于「玩家打出了哪段」的记账）。 */
export function locateEpilogue(matrix, textKey) {
  if (!isEpilogueMatrix(matrix) || !textKey) return null
  for (const a of matrix.a) {
    for (const b of matrix.b) {
      const entry = epilogueFor(matrix, a.id, b.id)
      if (entry?.textKey === textKey) return { a: a.id, b: b.id }
    }
  }
  return null
}
