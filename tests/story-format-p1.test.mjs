// P1 回归：各战役剧情生成物的文本格式（story-0006/0007/0008/0009/0011/0012）。
//
// 这些检查锁在生成物上：根因分别在 tools/import-*-story.mjs 的清洗/补译逻辑，
// 故断言「重新生成后必须仍然成立」，避免下一次重生成把格式问题带回来。
import test from 'node:test'
import assert from 'node:assert/strict'
import { TFA_STORY_TEXT } from '../content/campaigns/theForgottenAge/story-text.js'
import { TCU_STORY_TEXT } from '../content/campaigns/theCircleUndone/story-text.js'
import { TDE_STORY_TEXT } from '../content/campaigns/theDreamEaters/story-text.js'
import { DUNWICH_STORY_TEXT } from '../content/campaigns/theDunwichLegacy/story-text.js'
import { EOTE_STORY_TEXT } from '../content/campaigns/edgeOfTheEarth/story-text.js'

const walkStrings = (value, visit) => {
  if (typeof value === 'string') return visit(value)
  if (Array.isArray(value)) return value.forEach(child => walkStrings(child, visit))
  if (value && typeof value === 'object') return Object.values(value).forEach(child => walkStrings(child, visit))
}

const RESOLUTION_LABEL = /^(?:结局|尾声|无结局)\s*\d*\s*[:：]/

test('P1 TFA 混乱标记使用方括号 token，不再泄漏花括号（story-0007）', () => {
  const leaked = []
  walkStrings(TFA_STORY_TEXT, text => {
    for (const match of text.matchAll(/\{(cultist|tablet|skull|elderSign|elderThing|autoFail)\}/g)) leaked.push(match[0])
  })
  assert.deepEqual(leaked, [], `仍有花括号 token：${leaked.join(', ')}`)
  assert.match(TFA_STORY_TEXT.interludes.interludeThree.sections.cultistCount.join(''), /\[cultist\]/)
})

test('P1 TCU 职阶占位与结局正文标签已清理（story-0008/0009）', () => {
  const intro3Mystic = TCU_STORY_TEXT.introductions.theSecretName.sections.intro3Mystic.join('\n')
  assert.doesNotMatch(intro3Mystic, /\(\{mystic\}\)/)
  assert.match(intro3Mystic, /^\[mystic\]/)
  for (const [chapterId, chapter] of Object.entries(TCU_STORY_TEXT.resolutions)) {
    for (const [key, paragraphs] of Object.entries(chapter)) {
      assert.doesNotMatch(paragraphs[0] || '', RESOLUTION_LABEL, `${chapterId}/${key} 正文重复结局标签`)
    }
  }
})

test('P1 TDE 结局/尾声正文不再重复「结局 N：」标签（story-0009）', () => {
  for (const [chapterId, chapter] of Object.entries(TDE_STORY_TEXT.chapters)) {
    for (const [key, value] of Object.entries(chapter.resolutions || {})) {
      const text = typeof value === 'string' ? value : value?.body
      if (typeof text === 'string') assert.doesNotMatch(text, RESOLUTION_LABEL, `${chapterId}/${key}`)
    }
  }
  for (const [key, value] of Object.entries(TDE_STORY_TEXT.localeKeys)) {
    if (!/epilogue\d+$/i.test(key)) continue
    const body = typeof value === 'string' ? value : value?.body
    if (typeof body === 'string') assert.doesNotMatch(body, RESOLUTION_LABEL, `localeKeys.${key}`)
  }
})

test('P1 Dunwich 结局正文不再重复「结局 N：」标签（story-0009）', () => {
  for (const [chapterId, chapter] of Object.entries(DUNWICH_STORY_TEXT.resolutions)) {
    for (const [key, paragraphs] of Object.entries(chapter)) {
      assert.doesNotMatch(paragraphs[0] || '', RESOLUTION_LABEL, `${chapterId}/${key}`)
    }
  }
})

test('P1 EOTE 无 [count] 占位、尾声分节标题可读（story-0011/0012）', () => {
  walkStrings(EOTE_STORY_TEXT.localeKeys, text => assert.doesNotMatch(text, /\[count\]/))
  walkStrings(EOTE_STORY_TEXT.campaign, text => assert.doesNotMatch(text, /\[count\]/))
  for (const section of EOTE_STORY_TEXT.epilogue.sections) {
    assert.doesNotMatch(section.title, /^epilogue\./, `尾声分节标题仍是 key：${section.title}`)
  }
})
