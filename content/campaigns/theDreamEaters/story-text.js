// 食梦者（The Dream Eaters）· 剧情正文生成物（P8-T / M3-C 占位）。
//
// 口径（路线图 §8.5 / D2）：中文剧情采用**自译补齐**，底本是锁定 SHA-256 的英文 locale
// （参考资源/.../frontend/src/locales/en/theDreamEaters/**），产物由 `tools/import-tde-story.mjs`
// 从 `content/campaigns/theDreamEaters/story-source/` 生成，本文件是生成物。
//
// P8 只交付结构：`status: 'pending'`、`officialChinese: false`、`sourceKind: 'self-translated'`；
// 章节/幕间/结局的 `sections` 为空对象，**不得**手写摘要或中文转述顶替原文（审计 `storyText` 保持 false）。
// P8-T 完成后由生成器写入正文并改 `status: 'translated'`，本文件不再手工维护。
//
// 消费方：
//   · `manifest.js` 的 flow 节点只引用这里的段落键（文本为空时节点只用 title/label）；
//   · 章节 `definition.js` 的 `intro`/`setup`/`resolutions` 在 P8 阶段用锁定英文原文
//     （`textLanguage: 'en'` + `textStatus: 'pending-self-translation'`），P8-T 后切到本文件；
//   · `audit-tde-scenarios.mjs` 的 `storyText` 检查项读本文件（P8 恒为 false + pending 原因）。

export const TDE_STORY_GENERATOR = 'tools/import-tde-story.mjs'

export const TDE_STORY_META = Object.freeze({
  status: 'pending',
  // 自译，非官方中文：审计账本必须保留这两个字段。
  sourceKind: 'self-translated',
  officialChinese: false,
  generator: TDE_STORY_GENERATOR,
  generatedBy: null,
  generatedSha256: null,
  glossaryVersion: null,
  // 底本（en locale 9 文件）的 SHA-256，由生成器在 P8-T 写入；P8 阶段为空。
  enSourceHashes: Object.freeze({}),
  translationBatches: 15,
  pendingBatches: 15,
})

const pendingSection = () => Object.freeze({ status: 'pending', paragraphs: Object.freeze([]) })

const pendingChapter = (id, title) => Object.freeze({
  id,
  title,
  status: 'pending',
  intro: pendingSection(),
  setup: pendingSection(),
  rules: Object.freeze({}),
  resolutions: Object.freeze({}),
  privateStories: Object.freeze({}),
})

// 8 章（A1–A4 / B1–B4）与序章/幕间/尾声的占位；P8-T 生成器按同一 key 填正文。
export const TDE_STORY_TEXT = Object.freeze({
  meta: TDE_STORY_META,
  prologue: pendingSection(),
  chapters: Object.freeze({
    beyondTheGatesOfSleep: pendingChapter('beyondTheGatesOfSleep', '梦境门外'),
    wakingNightmare: pendingChapter('wakingNightmare', '清醒噩梦'),
    theSearchForKadath: pendingChapter('theSearchForKadath', '寻觅卡达斯'),
    aThousandShapesOfHorror: pendingChapter('aThousandShapesOfHorror', '万千骇形'),
    darkSideOfTheMoon: pendingChapter('darkSideOfTheMoon', '月之暗面'),
    pointOfNoReturn: pendingChapter('pointOfNoReturn', '无归之地'),
    whereTheGodsDwell: pendingChapter('whereTheGodsDwell', '神居之所'),
    weaverOfTheCosmos: pendingChapter('weaverOfTheCosmos', '编织宇宙'),
  }),
  interludes: Object.freeze({
    interlude1: pendingSection(),
    interlude2: pendingSection(),
    interlude3: pendingSection(),
  }),
  epilogue: Object.freeze({
    status: 'pending',
    // 16 段矩阵的正文按 `a 轴 id | b 轴 id` 索引；P8-T 填。
    cells: Object.freeze({}),
  }),
})

export const TDE_STORY_STATUS = Object.freeze({
  status: TDE_STORY_META.status,
  officialChinese: TDE_STORY_META.officialChinese,
  sourceKind: TDE_STORY_META.sourceKind,
  pending: true,
})

/** 取章节正文（P8 恒返回 pending 占位；P8-T 后同一个键返回真实正文）。 */
export function tdeChapterStory(chapterId) {
  const chapter = TDE_STORY_TEXT.chapters[chapterId]
  if (!chapter) throw new RangeError(`未知食梦者章节正文：${chapterId}`)
  return chapter
}

/** 是否已导入该章正文（P8 恒 false）。 */
export function hasChapterStory(chapterId) {
  const chapter = TDE_STORY_TEXT.chapters[chapterId]
  return Boolean(chapter && chapter.status === 'translated'
    && (chapter.intro?.paragraphs?.length || 0) > 0)
}

/** 结局正文查表（16 段矩阵；未导入返回 null）。 */
export function tdeEpilogueText(aId, bId) {
  return TDE_STORY_TEXT.epilogue.cells[`${aId}|${bId}`] || null
}
