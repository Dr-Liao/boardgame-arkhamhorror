#!/usr/bin/env node
/**
 * 《地球边缘》(EOTE，08 号段) 卡面中文翻译审计扫描/复现脚本。
 *
 * 运行（在 Mod 根 `games/arkhamhorror/` 下）：
 *   node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs
 *       打印：范围统计、机械检查汇总、按分类/严重度的 findings 统计与逐条标题（复现 findings.json 数字）。
 *   node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --json
 *       stdout 输出完整 findings JSON。
 *   node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --dump
 *       额外写 cards/_dump.md（403 卡中英对照，供人工复核）。
 *   node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --write
 *       写 cards/findings.json（+ _dump.md）。若当前 shell 的文件沙箱拒绝写 cards/，自动回退写到
 *       workspace 根 `.eote-cards-staging/`（脚本会打印实际路径，供主进程拷入）。
 *   node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --write --notes-stats
 *       同上，并打印可直接粘进 notes.md 的统计片段。
 *
 * 数据与口径：
 *   - 本仓卡面：src/cards/cards-data.js（ALL_CARDS，pack=eoep/eoec 共 403 条，08 号段）。
 *   - 上游只读对照：参考资源/ArkhamHorror-main/frontend/public/cards_{en,zh-cn,zh}.json。
 *     本仓 zh 字段的生成规则见 tools/import-cards.mjs（逐字段优先简中 zh-cn、其次繁中 zh、最后英文回退，
 *     再经 stripHtml 去标签、traits 用 / 与 。切分）。本脚本按同一规则复算“期望值”，据此判定每个 zh
 *     字段是「上游简中继承」「上游繁中回退」还是「英文回退」；任何与本仓实际值不一致的差异 = 本仓改写。
 *   - 所有 findings 的 `location` 由本脚本的源码块索引实际定位（禁止手写行号）。
 *   - 只读审计：不修改 src/content 等既有文件；仅写 docs/edgeOfTheEarth/translate/{cards,tools}/ 下自己的产物。
 *
 * 复现说明：findings 由本脚本按固定规则从数据 + 脚本内的「人工裁定表」生成，因此
 * `node .../cards-scan.mjs` 打印的 byCategory/bySeverity/count 与 findings.json 完全一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '../../../../src/cards/cards-data.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD_ROOT = path.resolve(HERE, '../../../..');
const OUT_DIR = path.resolve(HERE, '../cards');
const STAGING_DIR = path.resolve(MOD_ROOT, '../..', '.eote-cards-staging');
const REF_DIR = path.resolve(HERE, '../../../../../../参考资源/ArkhamHorror-main/frontend/public');
const CARDS_DATA = path.join(MOD_ROOT, 'src/cards/cards-data.js');

const argv = new Set(process.argv.slice(2));
const ARG_WRITE = argv.has('--write');
const ARG_DUMP = argv.has('--dump') || ARG_WRITE;
const ARG_JSON = argv.has('--json');
const ARG_NOTES_STATS = argv.has('--notes-stats');

const TODAY = '2026-11-09';
const AREA = 'cards';
const AUDITOR = 'cards-audit';

// ---------------------------------------------------------------------------
// 0. 基础工具
// ---------------------------------------------------------------------------

/** 与 tools/import-cards.mjs 的 stripHtml 完全一致（用于复算期望值）。 */
function stripHtml(value) {
  return String(value ?? '')
    .replace(/<span\b[^>]*class=["'][^"']*icon-([\w-]+)[^"']*["'][^>]*>\s*<\/span>/gi, '[$1]')
    .replace(/<\/(?:p|div)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

const splitTerms = value => String(value ?? '').split(/\.\s*|。/).map(s => s.trim()).filter(Boolean);
const han = /[\u3400-\u9fff]/u;
const hasHan = s => han.test(String(s ?? ''));
const clamp = (s, n = 200) => {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n)}…` : str;
};
const countAll = (s, re) => (String(s ?? '').match(re) || []).length;
const digitTally = s => {
  const out = {};
  for (const d of String(s ?? '').match(/\d+/g) || []) out[d] = (out[d] || 0) + 1;
  return out;
};

/**
 * 写产物：优先写 cards/；若当前 shell 的文件沙箱只放行 workspace 根（Windows 下的子目录 ACL 缺失），
 * 自动回退到 workspace 根下的 staging 目录，由主进程/人工拷入 cards/。
 */
function writeArtifact(name, content) {
  const targets = [path.join(OUT_DIR, name), path.join(STAGING_DIR, name)];
  const errors = [];
  for (const target of targets) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
      return target;
    } catch (error) {
      if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error;
      errors.push(`${target}: ${error.code}`);
    }
  }
  throw new Error(`无法写入 ${name}（cards/ 与 staging/ 均被文件权限拒绝：${errors.join('; ')}）`);
}

// ---------------------------------------------------------------------------
// 1. 数据加载：本仓 403 张 + 上游三语卡表 + 本仓源码行号索引
// ---------------------------------------------------------------------------

const loadUpstream = name => {
  const file = path.join(REF_DIR, name);
  const stat = fs.statSync(file);
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    file,
    rel: path.relative(path.resolve(MOD_ROOT, '../..'), file).replaceAll('\\', '/'),
    bytes: stat.size,
    rows,
    map: new Map(rows.map(row => [row.code, row])),
  };
};

const upstream = {
  en: loadUpstream('cards_en.json'),
  cn: loadUpstream('cards_zh-cn.json'),
  tw: loadUpstream('cards_zh.json'),
};

const EOTE_CODES = Object.keys(ALL_CARDS)
  .filter(code => ALL_CARDS[code].pack === 'eoep' || ALL_CARDS[code].pack === 'eoec')
  .sort();

/** 逐记录块扫描源码，得到 code -> { start, end, fields: { fieldName: lineNumber } }。 */
function indexSourceLines() {
  const text = fs.readFileSync(CARDS_DATA, 'utf8');
  const lines = text.split('\n');
  const keyRe = /^\s{2}"(\d{5}[ab]?)": \{/;
  const fieldRe = /^\s{4}"([A-Za-z0-9_]+)": /;
  const starts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(keyRe);
    if (m) starts.push({ line: i + 1, code: m[1] });
  }
  const index = new Map();
  for (let i = 0; i < starts.length; i += 1) {
    const cur = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1].line - 1 : lines.length;
    const fields = {};
    for (let ln = cur.line; ln <= end; ln += 1) {
      const m = lines[ln - 1].match(fieldRe);
      if (m && !(m[1] in fields)) fields[m[1]] = ln;
    }
    index.set(cur.code, { start: cur.line, end, fields });
  }
  return { index, lineCount: lines.length };
}

const source = indexSourceLines();

const lineOf = (code, field) => {
  const block = source.index.get(code);
  if (!block) throw new Error(`源码中找不到卡 ${code} 的记录块`);
  const line = block.fields[field];
  if (!line) throw new Error(`卡 ${code} 找不到字段 ${field} 的行号`);
  return line;
};
const loc = (code, field) => `src/cards/cards-data.js:${lineOf(code, field)}`;

// ---------------------------------------------------------------------------
// 2. 逐字段来源复算（复刻 tools/import-cards.mjs 的 localeFields/normalizeCard）
// ---------------------------------------------------------------------------

const DISPLAY_FIELDS = ['name', 'subname', 'text', 'traits', 'flavor', 'back_name', 'back_text', 'back_flavor', 'customization_text', 'customization_change'];
const OUTPUT_FIELDS = {
  name: 'nameZh', subname: 'subnameZh', text: 'textZh', traits: 'traitsZh', flavor: 'flavorZh',
  back_name: 'backNameZh', back_text: 'backTextZh', back_flavor: 'backFlavorZh',
  customization_text: 'customizationTextZh', customization_change: 'customizationChangeZh',
};

const cards = EOTE_CODES.map(code => {
  const repo = ALL_CARDS[code];
  const en = upstream.en.map.get(code);
  const cn = upstream.cn.map.get(code);
  const tw = upstream.tw.map.get(code);
  const fields = {};
  for (const field of DISPLAY_FIELDS) {
    const englishRaw = en?.[field] ?? en?.[`real_${field}`] ?? '';
    const english = stripHtml(englishRaw);
    const translated = value => {
      const stripped = stripHtml(value);
      return !!stripped && hasHan(stripped) && stripped !== english;
    };
    let src;
    if (translated(cn?.[field])) src = 'zh-cn';
    else if (translated(tw?.[field])) src = 'zh';
    else src = 'en';
    const selected = src === 'zh-cn' ? cn?.[field] : src === 'zh' ? tw?.[field] : englishRaw;
    const expected = field === 'traits' ? splitTerms(selected) : stripHtml(selected);
    const actual = repo[OUTPUT_FIELDS[field]];
    const equal = JSON.stringify(expected) === JSON.stringify(actual);
    const status = src === 'en'
      ? (english ? 'english-fallback' : 'not-applicable')
      : src === 'zh-cn' ? 'translated' : 'traditional-fallback';
    fields[field] = { src, status, expected, actual, equal, english, cnValue: cn?.[field], twValue: tw?.[field] };
  }
  const applicable = Object.values(fields).filter(f => f.status !== 'not-applicable');
  const translatedCount = applicable.filter(f => f.status === 'translated').length;
  const localeStatus = translatedCount === applicable.length && applicable.length ? 'complete' : translatedCount ? 'partial' : 'fallback';
  return { code, pack: repo.pack, repo, en, cn, tw, fields, localeStatus, startLine: source.index.get(code)?.start };
});

// ---------------------------------------------------------------------------
// 3. 全量机械扫描（候选集合）
// ---------------------------------------------------------------------------

const ZF = ['nameZh', 'subnameZh', 'textZh', 'backNameZh', 'backTextZh', 'flavorZh', 'backFlavorZh', 'traitsZh'];
const RULE_PAIRS = [['text', 'textZh'], ['backText', 'backTextZh']];

/** 全库 en trait -> zh trait 对照（用于 [[特性]] 括号检查）。 */
const TRAIT_ZH = (() => {
  const map = new Map();
  for (const card of Object.values(ALL_CARDS)) {
    const ts = card.traits || [];
    const tz = card.traitsZh || [];
    ts.forEach((t, i) => {
      if (tz[i] && !map.has(t)) map.set(t, tz[i]);
    });
  }
  return map;
})();

const TEXTLIKE_PAIRS = [...RULE_PAIRS, ['flavor', 'flavorZh'], ['backFlavor', 'backFlavorZh']];
const SINGLE_TOKEN_RE = /(?<!\[)\[([a-zA-Z_0-9]+)\](?!\])/g;
const DOUBLE_TOKEN_RE = /\[\[[^\[\]]+\]\]/g;

const A = {
  importDivergences: [],
  localeStatusMismatch: [],
  fieldStatusTally: {},
  fastFree: { tokens: 0, fields: [], cards: new Set() },
  bracketMissing: [],
  lineDiff: [],
  spacing: [],
  terminal: [],
  slashSpace: [],
  numeral: [],
  faq: [],
  genCon: [],
  perilExtra: [],
  classPerCard: [],
  campaignLogGuide: [],
  bearer: [],
  mayAdded: [],
  charIdentity: [],
  selfName: [],
  shroudVariant: { bare: [], valued: [] },
  deckLimitVariant: { perDeck: [], perSet: [] },
  doomTokenVariant: { standard: [], odd: [] },
  ignoreVariant: { standard: [], odd: [] },
  standardDamage: { standard: [], odd: [] },
  fightValue: [],
  campaignVariant: { script: [], battle: [] },
  sledgeVariant: { qiao: [], qiaoCards: [], correct: [] },
  coverVariant: { wrong: [], right: [] },
  attrStyle: { total: 0, hpspace: [], hpcompact: [], missing: [] },
  remainingVariant: { shengxia: [], shengyu: [] },
  ruleLineStruct: [],
  flavorLineStruct: [],
  quoteMerge: [],
  redundantPunct: [],
  tokenSpaceExtra: [],
  dashSpace: [],
  tokenSpacingInconsistent: [],
  frostNoun: [],
};

// --- 3.1 导入来源与 localeStatus ---
for (const card of cards) {
  for (const field of DISPLAY_FIELDS) {
    const f = card.fields[field];
    A.fieldStatusTally[f.status] = (A.fieldStatusTally[f.status] || 0) + 1;
    if (!f.equal) {
      A.importDivergences.push({ code: card.code, field, repoField: OUTPUT_FIELDS[field], src: f.src, expected: f.expected, actual: f.actual });
    }
  }
  if (card.localeStatus !== card.repo.localeStatus) {
    A.localeStatusMismatch.push({ code: card.code, repo: card.repo.localeStatus, recomputed: card.localeStatus });
  }
}

// --- 3.2 图标 token / [[特性]] / 行数 / 数字 ---
for (const card of cards) {
  for (const [ef, zf] of RULE_PAIRS) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (!e || !z) continue;
    const single = s => {
      const out = {};
      for (const m of String(s).matchAll(SINGLE_TOKEN_RE)) out[m[1]] = (out[m[1]] || 0) + 1;
      return out;
    };
    const es = single(e);
    const zs = single(z);
    const tokenNames = new Set([...Object.keys(es), ...Object.keys(zs)]);
    const diffs = [];
    for (const token of tokenNames) {
      if ((es[token] || 0) === (zs[token] || 0)) continue;
      diffs.push({ token, en: es[token] || 0, zh: zs[token] || 0 });
    }
    // [fast] 在简中卡表被系统性写成 [free]（上游惯例），单独归并
    const nonFastFree = diffs.filter(d => !(d.token === 'fast' || d.token === 'free'));
    if (!nonFastFree.length && diffs.length) {
      const fast = (es.fast || 0) - (zs.fast || 0);
      A.fastFree.tokens += fast;
      A.fastFree.fields.push({ code: card.code, field: zf, fast, free: (zs.free || 0) - (es.free || 0) });
      A.fastFree.cards.add(card.code);
    }
    // [[特性]] 丢失/错译：en 的每个 [[X]] 都应在 zh 里以 [[中文特性]] 形式出现
    const enTraits = [...e.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
    const zhBrackets = [...z.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
    for (const trait of enTraits) {
      const zhTrait = TRAIT_ZH.get(trait);
      if (!zhTrait) {
        A.bracketMissing.push({ code: card.code, field: zf, enTrait: trait, reason: '特性无中文对照（未在卡表 traits 中出现）', zhText: clamp(z, 160) });
      } else if (!z.includes(`[[${zhTrait}]]`)) {
        A.bracketMissing.push({ code: card.code, field: zf, enTrait: trait, expect: zhTrait, zhBrackets, zhText: clamp(z, 160) });
      }
    }
    // 行数
    const el = e.split('\n');
    const zl = z.split('\n');
    if (el.length !== zl.length) {
      const quoteMerge = el.length === 2 && zl.length === 1 && /^ ?[-–] ?H\.? ?P\.? Lovecraft/.test(el[1]);
      const perilInsert = zl.length === el.length + 1 && zl[0].startsWith('险境') && !/Peril/i.test(e);
      const item = { code: card.code, field: zf, en: el.length, zh: zl.length, quoteMerge, perilInsert, enLines: el.map(x => x.slice(0, 60)), zhLines: zl.map(x => x.slice(0, 60)) };
      A.lineDiff.push(item);
      if (quoteMerge) A.quoteMerge.push(item);
    }
  }
}

// --- 3.3 空白/标点/格式 ---
const literalSpacePatterns = [
  ['中文标点后空格', /[。，；：！？][ \t]+/g],
  ['中文标点前空格', /[ \t]+[。，；：！？]/g],
  ['图标 token 后空格', /\] [\u4e00-\u9fff]/g],
  ['半角括号前空格', /[ \t]+\(/g],
  ['右括号后空格', /\)[ \t]+[\u4e00-\u9fff]/g],
];
for (const card of cards) {
  for (const zf of ZF) {
    const value = card.repo[zf];
    const arr = Array.isArray(value) ? value : [value];
    for (const s of arr) {
      if (!s) continue;
      const str = String(s);
      for (const [label, re] of literalSpacePatterns) {
        re.lastIndex = 0;
        const m = re.exec(str);
        if (m) {
          const ctx = str.slice(Math.max(0, m.index - 14), m.index + m[0].length + 14);
          A.spacing.push({ code: card.code, field: zf, kind: label, ctx: clamp(ctx, 80) });
        }
      }
    }
  }
  // 08505 型：句中文标点后空格 + 句末标点冗余
  for (const [ef, zf] of RULE_PAIRS) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (!e || !z) continue;
    if (/。[ \t]+\(/.test(z)) A.redundantPunct.push({ code: card.code, field: zf, en: clamp(e, 120), zh: clamp(z, 160) });
    // 行级缺句末标点：en 行以 .!? 结尾，zh 行以汉字结尾；或 zh 以括号收尾但括号内/外都没有句号
    const el = e.split('\n');
    const zl = z.split('\n');
    for (let i = 0; i < Math.min(el.length, zl.length); i += 1) {
      const le = el[i].trim();
      const lz = zl[i].trim();
      if (!le || !lz || le.endsWith('...')) continue;
      const hanTail = /[\u4e00-\u9fff]$/.test(lz);
      const bracketTail = /[)）]$/.test(lz) && !/[。！？…][)）]$/.test(lz);
      if (/[.!?]$/.test(le) && (hanTail || bracketTail)) {
        A.terminal.push({ code: card.code, field: zf, line: i, kind: hanTail ? '行尾无标点' : '括号收尾缺句号', en: le.slice(-70), zh: lz.slice(-70) });
      }
    }
    // "-当" 缺空格等：短横线后直接跟汉字（正常体例应为「 - 」）
    if (/[ \t]-[\u4e00-\u9fff]/.test(z)) A.dashSpace.push({ code: card.code, field: zf, zh: clamp(z, 120) });
    // token 后空格（单独记录，用于自检聚合）
    if (/\] [\u4e00-\u9fff]/.test(z)) A.tokenSpaceExtra.push({ code: card.code, field: zf, zh: clamp(z, 120) });
    // "-1 [intellect]" 型：负号数字后空格不一致
    if (/-\d+\[[a-z_]+\]/.test(z) && /-\d+ \[[a-z_]+\]/.test(z)) A.tokenSpacingInconsistent.push({ code: card.code, field: zf, zh: clamp(z, 160) });
    // [frost] 后的「标记/token」名词漏译
    if (/reveal (?:a|1 or more) \[frost\] tokens?/i.test(e) && /\[frost\](?:后|时)/.test(z)) A.frostNoun.push({ code: card.code, field: zf, en: clamp(e, 140), zh: clamp(z, 160) });
  }
  // Easy/Standard 斜杠空格
  if (card.repo.textZh?.startsWith('简单')) {
    const first = card.repo.textZh.split('\n')[0];
    if (first !== '简单/普通') A.slashSpace.push({ code: card.code, field: 'textZh', first });
  }
  // 英文空数字体例：en 有阿拉伯数字而 zh 对应位置用中文数字
  for (const [ef, zf] of RULE_PAIRS) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (!e || !z) continue;
    const ed = digitTally(e);
    const zd = digitTally(z);
    const missing = Object.entries(ed).filter(([d, n]) => (zd[d] || 0) < n);
    if (!missing.length) continue;
    const zhNums = z.match(/[一二两三四五六七八九十]+(?:张|个|点|次|位|名|项|只|枚|条|轮|回合|阶段|行动|资源|线索|伤害|恐惧|标记)/g) || [];
    if (zhNums.length) A.numeral.push({ code: card.code, field: zf, missing: missing.map(([d]) => d), zhNums: [...new Set(zhNums)].slice(0, 6) });
  }
  // FAQ 勘误注记 / Gen Con（en 无对应）
  for (const [ef, zf] of [...RULE_PAIRS, ['flavor', 'flavorZh'], ['backFlavor', 'backFlavorZh']]) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (!z) continue;
    if (z.includes('FAQ') && !/FAQ/i.test(e)) A.faq.push({ code: card.code, field: zf, en: clamp(e, 100), zh: clamp(z, 160) });
    if (/Gen Con/.test(z) && !/Gen Con/i.test(e)) A.genCon.push({ code: card.code, field: zf, zh: clamp(z, 160) });
  }
  // zh 多出「险境」而 en 无 Peril
  const enText = `${card.repo.text || ''}\n${card.repo.backText || ''}`;
  const zhText = `${card.repo.textZh || ''}\n${card.repo.backTextZh || ''}`;
  if (/险境/.test(zhText) && !/Peril/i.test(enText)) {
    A.perilExtra.push({ code: card.code, field: 'textZh', en: clamp(card.repo.text || card.repo.backText, 140), zh: clamp(card.repo.textZh || card.repo.backTextZh, 160) });
  }
  // 「for each different class」被按卡计数翻译（08022/08036/08050）
  for (const [ef, zf] of RULE_PAIRS) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (/for each different class among cards you control/i.test(e) && /每控制一张不同职阶的卡牌/.test(z)) {
      A.classPerCard.push({ code: card.code, field: zf, en: clamp(e, 160), zh: clamp(z, 160) });
    }
  }
  // 封印地点能力：en 强制 spend … to activate，简中增「可以」
  for (const [ef, zf] of RULE_PAIRS) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (/investigators at .+ spend 1 \[per_investigator\] clues, as a group, to activate/.test(e) && /可以共同花费1\[per_investigator\]个线索，来激活/.test(z)) {
      A.mayAdded.push({ code: card.code, field: zf, en: clamp(e, 160), zh: clamp(z, 160) });
    }
  }
  // bearer 误译
  for (const [ef, zf] of [...RULE_PAIRS, ['flavor', 'flavorZh'], ['backFlavor', 'backFlavorZh']]) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (/bearer/i.test(e) && /承受者/.test(z)) A.bearer.push({ code: card.code, field: zf, zh: clamp(z, 160) });
  }
}

// --- 3.4 术语/用字 ---
const textOf = card => ZF.map(f => (Array.isArray(card.repo[f]) ? card.repo[f].join('') : card.repo[f] || '')).join('\n');
const scanTerm = (label, re) => cards.filter(card => re.test(textOf(card))).map(card => card.code);
const addTermPairs = (target, okRe, badRe) => {
  target.standard = scanTerm('ok', okRe);
  target.odd = scanTerm('bad', badRe);
};
scanTerm('x', /$^/); // no-op 占位（保持术语扫描结构清晰）
addTermPairs(A.deckLimitVariant, /每套牌库仅限/, /每个牌库仅限/);
addTermPairs(A.doomTokenVariant, /毁灭标记/, /毁灭印记/);
addTermPairs(A.ignoreVariant, /忽略/, /忽视/);
addTermPairs(A.standardDamage, /标准伤害/, /基础伤害/);
addTermPairs(A.campaignVariant, /剧本/, /战役/);
addTermPairs(A.sledgeVariant, /雪橇/, /雪撬/);
addTermPairs(A.coverVariant, /覆盖/, /复盖/);
addTermPairs(A.remainingVariant, /剩余/, /剩下/);
A.sledgeVariant.qiaoCards = A.sledgeVariant.odd;
A.sledgeVariant.correct = A.sledgeVariant.standard.filter(code => !A.sledgeVariant.odd.includes(code));
A.coverVariant.wrong = A.coverVariant.odd;
A.coverVariant.right = A.coverVariant.standard;
A.fightValue = cards.filter(card => /战斗值/.test(textOf(card))).map(card => card.code);
A.shroudVariant.bare = cards.filter(card => /隐藏(?!值)/.test(textOf(card))).map(card => card.code);
A.shroudVariant.valued = cards.filter(card => /隐藏值/.test(textOf(card))).map(card => card.code);

// 引文署名风格（Lovecraft）
for (const card of cards) {
  for (const [ef, zf] of [['flavor', 'flavorZh'], ['backFlavor', 'backFlavorZh']]) {
    const e = card.repo[ef] || '';
    const z = card.repo[zf] || '';
    if (!e || !z || !/Lovecraft/i.test(e)) continue;
    A.attrStyle.total += 1;
    if (!/洛夫克拉夫特/.test(z)) A.attrStyle.missing.push({ code: card.code, field: zf });
    if (/H\.P\./.test(z)) A.attrStyle.hpcompact.push({ code: card.code, field: zf, zh: clamp(z.slice(-46), 60) });
    if (/H\. P\./.test(z)) A.attrStyle.hpspace.push({ code: card.code, field: zf });
  }
}

// 角色名/卡名自引用一致性
const namePairs = new Map();
for (const card of cards) {
  if (!card.repo.name || !card.repo.nameZh) continue;
  const enName = card.repo.name.replace(/^(The|A|An) /, '');
  const re = new RegExp(`(^|[^A-Za-z])${enName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`);
  const enText = `${card.repo.text || ''}\n${card.repo.backText || ''}`;
  const zhText = `${card.repo.textZh || ''}\n${card.repo.backTextZh || ''}`;
  if (re.test(enText) && !zhText.includes(card.repo.nameZh)) {
    A.selfName.push({ code: card.code, name: card.repo.name, nameZh: card.repo.nameZh, en: clamp(card.repo.text, 140), zh: clamp(card.repo.textZh, 150) });
  }
  if (!namePairs.has(card.repo.name)) namePairs.set(card.repo.name, new Map());
  const m = namePairs.get(card.repo.name);
  m.set(card.repo.nameZh, (m.get(card.repo.nameZh) || 0) + 1);
}
A.charIdentity = [...namePairs].filter(([, m]) => m.size > 1).map(([en, m]) => ({ en, variants: [...m.keys()] }));

// ---------------------------------------------------------------------------
// 4. 上游来源判定
// ---------------------------------------------------------------------------

/** 判定「上游简中继承」：本仓 zh 字段与 upstream zh-cn 去标签结果逐字节一致（403 卡 4030 字段全部一致）。 */
const upstreamInherited = A.importDivergences.length === 0;

// ---------------------------------------------------------------------------
// 5. findings 构建（机械候选 + 人工裁定）
// ---------------------------------------------------------------------------

const findings = [];
let findingSeq = 0;

const sample = (code, field, extra) => {
  const item = `${code} · ${field} · ${loc(code, field)}`;
  return extra ? `${item}（${extra}）` : item;
};
const pick = (list, n = 8) => list.slice(0, n);

function addFinding(def) {
  findingSeq += 1;
  const id = `cards-${String(findingSeq).padStart(4, '0')}`;
  const findingsItem = {
    id,
    category: def.category,
    severity: def.severity,
    title: def.title,
    scope: def.scope,
    location: def.location,
    pointer: def.pointer,
    evidence: def.evidence,
    expected: def.expected,
    suggestion: def.suggestion,
    source: upstreamInherited ? 'upstream-zh-cn' : (def.source ?? 'repo-authored'),
    count: def.count ?? 1,
    samples: def.samples ?? [],
  };
  if (def.crossArea) findingsItem.crossArea = def.crossArea;
  findings.push(findingsItem);
}

// ---- missing-translation: 机械扫描未发现漏翻（保留显式结论于 notes，不进 findings） ----

// ---- symbol-format ----
if (A.fastFree.tokens) {
  const fieldList = A.fastFree.fields;
  addFinding({
    category: 'symbol-format',
    severity: 'medium',
    title: `简中卡表把符号图标 [fast] 系统性写成 [free]（${A.fastFree.fields.length} 个字段、${A.fastFree.tokens} 个 token）`,
    scope: { code: fieldList[0].code, field: fieldList[0].field, key: 'icon-token:[fast]->[free]', cards: A.fastFree.cards.size, fields: A.fastFree.fields.length, occurrences: A.fastFree.tokens },
    location: loc(fieldList[0].code, fieldList[0].field),
    pointer: `${fieldList[0].code}.${fieldList[0].field}`,
    evidence: clamp(`${fieldList[0].code} 等 ${A.fastFree.cards.size} 张卡共 ${A.fastFree.tokens} 处：en 用 [fast]，本仓 textZh/backTextZh 全部用 [free]`, 200),
    expected: '与英文一致地使用 [fast]（或按官方简中卡面确认的快速时间窗图标）',
    suggestion: '在上游简中数据修正前，可在渲染层把简中语境下的 [free] 映射回 [fast]，或逐条替换为 [fast]；需先确认简中官方卡面图标口径',
    count: A.fastFree.tokens,
    samples: [
      sample(fieldList[0].code, fieldList[0].field),
      ...pick(fieldList.slice(1).map(f => sample(f.code, f.field)), 7),
    ],
  });
}

if (A.bracketMissing.length) {
  const item = A.bracketMissing[0];
  addFinding({
    category: 'symbol-format',
    severity: 'medium',
    title: '[[特性]] 引用在简中文本中丢失（英文 [[Objective]] → 简中仅「目标」加粗，方括号标记消失）',
    scope: { code: item.code, field: item.field, key: 'double-bracket:[[Objective]]' },
    location: loc(item.code, item.field),
    pointer: `${item.code}.${item.field}`,
    evidence: clamp(`08520 backTextZh：「……结算场景1a上的目标」；en：「(Then, resolve the [[Objective]] on act 1a.)」`, 200),
    expected: '「（然后，结算场景1a上的[[目标]]。）」——保留 [[目标]] 加粗/特性样式标记',
    suggestion: '这是上游简中数据自身的问题（cn 原文写作 <b>目标</b>，本来就没有 [[ ]] 标记），不是本仓 stripHtml 去标签造成的；补 [[目标]] 即可，无需改导入逻辑',
    count: A.bracketMissing.length,
    samples: A.bracketMissing.map(x => sample(x.code, x.field, `en [[${x.enTrait}]]`)),
  });
}

// 规则文本的换行结构差异（非引文合并、非多出险境行）
const ruleLineStruct = A.lineDiff.filter(x => (x.field === 'textZh' || x.field === 'backTextZh') && !x.quoteMerge && !x.perilInsert);
if (ruleLineStruct.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '规则文本换行/分段与英文版不一致（内容一致，仅换行位置不同）',
    scope: { code: ruleLineStruct[0].code, field: 'textZh', key: 'line-structure' },
    location: loc(ruleLineStruct[0].code, ruleLineStruct[0].field),
    pointer: `${ruleLineStruct[0].code}.${ruleLineStruct[0].field}`,
    evidence: clamp(ruleLineStruct.map(x => `${x.code} en${x.en}行/zh${x.zh}行`).join('；'), 200),
    expected: '换行位置与英文版一致（或统一为中文排版口径）',
    suggestion: '【需逐条核对】08570b/08571b/08574b 是简中把「Flip this card back over.」拆成独立行；08737 把「Remove … from the game.」拆行；08046 把第二行并入第一行——均为上游简中排版，非内容缺失',
    count: ruleLineStruct.length,
    samples: pick(ruleLineStruct.map(x => sample(x.code, x.field, `en${x.en}/zh${x.zh}`)), 8),
  });
}

// 风味/引文换行合并（79 处引文署名 + 6 处段落切分）
const flavorLineStruct = A.lineDiff.filter(x => x.field === 'flavorZh' || x.field === 'backFlavorZh');
if (flavorLineStruct.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '风味文本换行与英文版不一致：引文署名行被并入正文（约 79 处），部分对白段落切分不同（6 处）',
    scope: { code: flavorLineStruct[0].code, field: 'backFlavorZh', key: 'line-structure-flavor' },
    location: loc(flavorLineStruct[0].code, flavorLineStruct[0].field),
    pointer: `${flavorLineStruct[0].code}.${flavorLineStruct[0].field}`,
    evidence: clamp(`例：08502 en 两行（引文 + 「 - H. P. Lovecraft, At the Mountains of Madness」），zh 一行「……H. P. 洛夫克拉夫特《疯狂山脉》」`, 200),
    expected: '如需与英文版一致的渲染换行，可在署名前保留换行；否则在样式层统一「引文—署名」排版',
    suggestion: '属上游简中排版选择（署名并入正文）；建议渲染时用 CSS 分离引文与署名，而非在数据里逐条改换行',
    count: flavorLineStruct.length,
    samples: pick(flavorLineStruct.map(x => sample(x.code, x.field, `en${x.en}/zh${x.zh}`)), 8),
  });
}

// 多余空格（中文标点后、token 后、括号前）；同一字段同一 token 只计一次
const spacingUnique = [];
{
  const seen = new Set();
  for (const item of A.spacing) {
    const key = `${item.code}|${item.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    spacingUnique.push(item);
  }
}
if (spacingUnique.length) {
  const kinds = {};
  for (const s of A.spacing) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: `中文文本中混入多余半角空格（${spacingUnique.length} 个字段；标点后 / 图标 token 后 / 半角括号前）`,
    scope: { code: spacingUnique[0].code, field: spacingUnique[0].field, key: 'stray-space', byKind: kinds },
    location: loc(spacingUnique[0].code, spacingUnique[0].field),
    pointer: `${spacingUnique[0].code}.${spacingUnique[0].field}`,
    evidence: clamp(spacingUnique.map(s => `${s.code} ${s.kind}`).join('；'), 200),
    expected: '中文标点与图标 token 前后不应有多余半角空格（如「快速。 使用」「猎手。 庞大。」「[free] 在你回合」「弃掉。 (团队…」）',
    suggestion: '按中文排版清理：删除标点后/token 后空格，半角括号统一紧贴前文；括号句末多出的「。」一并删除',
    count: spacingUnique.length,
    samples: pick(spacingUnique.map(s => sample(s.code, s.field, s.kind)), 8),
  });
}

if (A.redundantPunct.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '句末标点冗余：中文句号后又用「(…)。」补句，出现「。 (…)。」',
    scope: { code: A.redundantPunct[0].code, field: A.redundantPunct[0].field, key: 'redundant-terminal-period' },
    location: loc(A.redundantPunct[0].code, A.redundantPunct[0].field),
    pointer: `${A.redundantPunct[0].code}.${A.redundantPunct[0].field}`,
    evidence: clamp(A.redundantPunct[0].zh, 200),
    expected: '「取消该卡牌的效果并将其弃掉。(团队每轮仅限一次。)」',
    suggestion: '删除标点后的空格与句末多余句号；括号内英文句点已改为中文句号时，括号外不再保留句号',
    count: A.redundantPunct.length,
    samples: A.redundantPunct.map(x => sample(x.code, x.field)),
  });
}

if (A.tokenSpacingInconsistent.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '同一句内「-1[icon]」的空格不一致（08693）',
    scope: { code: '08693', field: 'textZh', key: 'spacing-before-icon' },
    location: loc('08693', 'textZh'),
    pointer: '08693.textZh',
    evidence: clamp(A.tokenSpacingInconsistent[0].zh, 200),
    expected: '「-1[willpower]、-1[intellect]、-1[combat]、-1[agility]」（token 前不加空格）',
    suggestion: '统一去掉「-1 」与「[intellect]」之间的半角空格',
    count: A.tokenSpacingInconsistent.length,
    samples: A.tokenSpacingInconsistent.map(x => sample(x.code, x.field)),
  });
}

if (A.frostNoun.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '[frost] 图标后的「标记」名词漏译（「揭示一个[frost]后」，同模板其余卡为「[frost]标记」）',
    scope: { code: A.frostNoun[0].code, field: A.frostNoun[0].field, key: 'token-noun-missing' },
    location: loc(A.frostNoun[0].code, A.frostNoun[0].field),
    pointer: `${A.frostNoun[0].code}.${A.frostNoun[0].field}`,
    evidence: '08565：「在你揭示一个[frost]后」；en：「After you reveal a [frost] token …」；08562 同模板译作「揭示一个[frost]标记后」',
    expected: '「在你揭示一个[frost]标记后：受到1点伤害。」',
    suggestion: '补「标记」，与 08562/08698 等同一模板的译法一致',
    count: A.frostNoun.length,
    samples: [...A.frostNoun.map(x => sample(x.code, x.field)), sample('08562', 'textZh', '同模板对照')],
  });
}

if (A.dashSpace.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '关键词行「目标 -」与正文之间漏空格（08672）',
    scope: { code: '08672', field: 'textZh', key: 'missing-space-after-dash' },
    location: loc('08672', 'textZh'),
    pointer: '08672.textZh',
    evidence: clamp(A.dashSpace[0].zh.match(/.{0,20}目标 -当.{0,20}/)?.[0] ?? A.dashSpace[0].zh, 160),
    expected: '「目标 - 当一轮结束时」',
    suggestion: '在「-」后补一个半角空格，与全库「目标 - / 强制 - / 显现 - 」体例一致',
    count: A.dashSpace.length,
    samples: A.dashSpace.map(x => sample(x.code, x.field)),
  });
}

if (A.terminal.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '规则文本行缺句末标点（en 行以句号结束，中文行以汉字或括号收尾且无句号）',
    scope: { code: A.terminal[0].code, field: A.terminal[0].field, key: 'missing-terminal-punctuation' },
    location: loc(A.terminal[0].code, A.terminal[0].field),
    pointer: `${A.terminal[0].code}.${A.terminal[0].field}`,
    evidence: clamp(A.terminal.map(t => `${t.code}「${t.zh}」`).join('；'), 200),
    expected: '每句规则文本以「。」结尾（如「猎手。」「猎物 - 仅限丹妮拉·雷耶丝。」）',
    suggestion: '补齐句末「。」；其中 08570/08694 是整段规则文本最后一字后缺句号',
    count: A.terminal.length,
    samples: pick(A.terminal.map(t => sample(t.code, t.field, `line ${t.line + 1}`)), 8),
  });
}

if (A.slashSpace.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '难度标题「简单/ 普通」斜杠后多空格，且与 08501「简单/普通」不一致',
    scope: { code: A.slashSpace[0].code, field: 'textZh', key: 'easy-standard-slash-spacing' },
    location: loc(A.slashSpace[0].code, 'textZh'),
    pointer: `${A.slashSpace[0].code}.textZh`,
    evidence: clamp(`08501「简单/普通」；${A.slashSpace.map(x => `${x.code}「${x.first}」`).join('；')}`, 200),
    expected: '统一为「简单/普通」「困难/专家」（或统一为「简单 / 普通」）',
    suggestion: '删除斜杠后的多余空格，与 08501 及「困难/专家」体例对齐',
    count: A.slashSpace.length,
    samples: [sample('08501', 'textZh'), ...pick(A.slashSpace.map(x => sample(x.code, x.field)), 7)],
  });
}

if (A.numeral.length) {
  addFinding({
    category: 'symbol-format',
    severity: 'low',
    title: '阿拉伯数字与中文数字体例不统一（同一批卡中 1/2/3 有时写「一张/两张/三次」）',
    scope: { code: A.numeral[0].code, field: A.numeral[0].field, key: 'numeral-style' },
    location: loc(A.numeral[0].code, A.numeral[0].field),
    pointer: `${A.numeral[0].code}.${A.numeral[0].field}`,
    evidence: clamp(A.numeral.map(x => `${x.code}：${x.zhNums.join('/')}`).join('；'), 220),
    expected: '数量一律用阿拉伯数字（如「抽取2张卡牌」「少进行3次行动」），与全库绝大多数卡一致',
    suggestion: '统一为阿拉伯数字；若保留中文数字，至少在同类卡（如 081xx 系列）内保持一致',
    count: A.numeral.length,
    samples: pick(A.numeral.map(x => sample(x.code, x.field, x.zhNums.join('/'))), 8),
  });
}

// ---- mixed-language ----
if (A.faq.length) {
  addFinding({
    category: 'mixed-language',
    severity: 'low',
    title: '简中文本夹带英文「FAQ，v2.1」勘误注记，且 en 无对应内容（半角括号 + 全角逗号混用）',
    scope: { code: A.faq[0].code, field: A.faq[0].field, key: 'faq-errata-note' },
    location: loc(A.faq[0].code, A.faq[0].field),
    pointer: `${A.faq[0].code}.${A.faq[0].field}`,
    evidence: clamp(A.faq.map(x => `${x.code}.${x.field}「(FAQ，v2.1)」`).join('；'), 200),
    expected: '若要保留勘误注记，用中文括注并统一全/半角：「（FAQ v2.1）」或「（常见问题，v2.1）」，且注明其非英文版内容',
    suggestion: '【需人工裁定】该注记来自上游简中（用于澄清移动时机）；保留与否属产品口径。若保留，建议本地化并统一括号/逗号；同时不与英文文本对照校验（en 无此句）',
    count: A.faq.length,
    samples: A.faq.map(x => sample(x.code, x.field)),
  });
}

if (A.genCon.length) {
  addFinding({
    category: 'mixed-language',
    severity: 'low',
    title: '中文文本保留英文专名「Gen Con 2020」（卡牌设计者署名）',
    scope: { code: A.genCon[0].code, field: A.genCon[0].field, key: 'proper-noun-gen-con' },
    location: loc(A.genCon[0].code, A.genCon[0].field),
    pointer: `${A.genCon[0].code}.${A.genCon[0].field}`,
    evidence: clamp(A.genCon[0].zh, 200),
    expected: '「本卡牌由2020年Gen Con的流亡议会设计。」（活动专名可保留英文）',
    suggestion: '可保留（Gen Con 为展会官方专名）；如需完全中文化可写「Gen Con 创展」并加注。仅记录，不建议改',
    count: A.genCon.length,
    samples: A.genCon.map(x => sample(x.code, x.field)),
  });
}

// ---- mistranslation ----
addFinding({
  category: 'mistranslation',
  severity: 'high',
  title: '伤害/恐惧混淆：en「Take 2 horror」误译为「受到2点伤害」（已知 08586，上游继承）',
  scope: { code: '08586', field: 'textZh', key: 'horror->damage' },
  location: loc('08586', 'textZh'),
  pointer: '08586.textZh',
  evidence: 'en：「Revelation - You must either (choose one):\\n- Take 2 horror.」；zh：「显现 - 你必须(选择以下一项)：\\n- 受到2点伤害。」',
  expected: '「- 受到2点恐惧。」',
  suggestion: '把「伤害」改为「恐惧」；这是规则级误译（受伤 vs 恐惧影响不同的伤害/恐惧分配与治愈路径），须优先修正',
  count: 1,
  samples: [sample('08586', 'textZh')],
});

if (A.classPerCard.length) {
  addFinding({
    category: 'mistranslation',
    severity: 'high',
    title: '「for each different class among cards you control」误译为「每控制一张不同职阶的卡牌」（按卡计数，改变规则效果）',
    scope: { code: '08022', field: 'textZh', key: 'per-class->per-card' },
    location: loc('08022', 'textZh'),
    pointer: '08022.textZh',
    evidence: 'en：「For each different class among cards you control, you get +1 [combat] …」；zh：「你每控制一张不同职阶的卡牌，你本次攻击得到+1[combat]…」。同包 08077 与繁中均为「每有一个不同的职阶」的按职阶计数口径。',
    expected: '「你控制的卡牌中每有一个不同的职阶，……」',
    suggestion: '按职阶（不同 faction 数）计数，而非按卡牌张数计数；08036、08050 同样表述需一并修正',
    count: A.classPerCard.length,
    samples: A.classPerCard.map(x => sample(x.code, x.field)),
  });
}

addFinding({
  category: 'mistranslation',
  severity: 'medium',
  title: 'Campaign Log 误译为「剧本手册」（应为「剧本日志」，与 Campaign Guide「剧本手册」区分）',
  scope: { code: '08622', field: 'backTextZh', key: 'campaign-log->guide' },
  location: loc('08622', 'backTextZh'),
  pointer: '08622.backTextZh',
  evidence: 'en：「Read Scenario Interlude: Gaze into Madness in the Campaign Log.」；zh：「阅读剧本手册中的冒险幕间故事：凝视疯狂。」（08597/08659 的 Campaign Guide 才译作「剧本手册」）',
  expected: '「阅读剧本日志中的冒险幕间故事：凝视疯狂。」',
  suggestion: '改为「剧本日志」；核对同批卡中 Campaign Log/Campaign Guide 的指向是否还有其他混用',
  count: 1,
  samples: [sample('08622', 'backTextZh'), sample('08597', 'backTextZh', 'Campaign Guide→剧本手册（对照）'), sample('08659', 'backTextZh', 'Campaign Guide→剧本手册（对照）')],
});

if (A.bearer.length) {
  const item = A.bearer[0];
  addFinding({
    category: 'mistranslation',
    severity: 'low',
    title: '「their bearer’s deck」误译为「承受者的牌库」（应为「持有者/其牌库」）',
    scope: { code: item.code, field: item.field, key: 'bearer->sufferer' },
    location: loc(item.code, item.field),
    pointer: `${item.code}.${item.field}`,
    evidence: 'en：「…shuffle each of them back into their bearer\'s deck.」；zh：「……将它们各自混洗入承受者的牌库。」',
    expected: '「……将它们各自混洗入其持有者的牌库。」',
    suggestion: '「承受者」指受伤害/恐惧者，与「持有者」混淆会误导（此处指该忒咳哩-哩弱点所在牌库的拥有者）',
    count: A.bearer.length,
    samples: A.bearer.map(x => sample(x.code, x.field)),
  });
}

if (A.mayAdded.length) {
  addFinding({
    category: 'mistranslation',
    severity: 'low',
    title: '封印地点能力：英文为强制「spend … to activate」，简中增译「可以」（可选化）',
    scope: { code: '08650', field: 'textZh', key: 'optionality-added' },
    location: loc('08650', 'textZh'),
    pointer: '08650.textZh',
    evidence: 'en：「If you succeed, investigators at Geothermal Vent spend 1 [per_investigator] clues, as a group, to activate the [seal_a] seal.」；zh：「……位于地热口的调查员可以共同花费1[per_investigator]个线索，来激活[seal_a]封印。」',
    expected: '「……调查员共同花费1[per_investigator]个线索，来激活[seal_a]封印。」（与 en 一致，不增「可以」）',
    suggestion: '08650/08651/08652/08653 同句模板一并核对：若确认成功即必须支付，应删除「可以」；若设计上允许放弃激活，则保留并在 notes 标记为口径澄清',
    count: A.mayAdded.length,
    samples: A.mayAdded.map(x => sample(x.code, x.field)),
  });
}

addFinding({
  category: 'mistranslation',
  severity: 'low',
  title: '错字：「switching its “-” to a “+”」译为「经其“-”变为“+”」（「经」应为「将」）',
  scope: { code: '08112', field: 'textZh', key: 'typo-jing' },
  location: loc('08112', 'textZh'),
  pointer: '08112.textZh',
  evidence: 'en：「Reveal an additional chaos token, switching its "-" to a "+".」；zh：「额外揭示一个混乱标记，并经其“-”变为“+”。」',
  expected: '「……并将其“-”变为“+”。」',
  suggestion: '「经」改「将」；繁中此处为「將其…變為」，可佐证',
  count: 1,
  samples: [sample('08112', 'textZh')],
});

addFinding({
  category: 'mistranslation',
  severity: 'low',
  title: '漏译限定词：en「the level of your location」→ 简中「X等于所在地点的高度」（缺「你」）',
  scope: { code: '08596', field: 'textZh', key: 'missing-your' },
  location: loc('08596', 'textZh'),
  pointer: '08596.textZh',
  evidence: 'en：「[skull]: -X. X is the level of your location.」；zh：「[skull]：-X。X等于所在地点的高度。」（同卡背面为「你所在地点」，可对照）',
  expected: '「X等于你所在地点的高度。」',
  suggestion: '补「你」；影响不大但同一张卡正反面表述应一致',
  count: 1,
  samples: [sample('08596', 'textZh')],
});

if (A.perilExtra.length) {
  addFinding({
    category: 'mistranslation',
    severity: 'low',
    title: '简中文本多出「险境」（Peril）关键词，而英文文本无 Peril（08706/08707，需人工裁定）',
    scope: { code: '08706', field: 'textZh', key: 'extra-peril' },
    location: loc('08706', 'textZh'),
    pointer: '08706.textZh',
    evidence: 'en 08706 以「Revelation - If you control a partner asset…」开头无 Peril；zh 为「险境。\\n显现 - …」。繁中同为「禍害。」，说明很可能英文数据缺漏 Peril，而非简中误加。',
    expected: '若官方卡面确有 Peril：保留简中并补 en 数据；若无：删除简中「险境。」两处',
    suggestion: '【需人工裁定】对照官方卡图确认 08706/08707 是否印有 Peril；仅记录，不擅自删除',
    count: A.perilExtra.length,
    samples: A.perilExtra.map(x => sample(x.code, x.field)),
  });
}

// ---- terminology ----
const nameFinding = (code, title, evidence, expected, suggestion, severity = 'medium') => {
  addFinding({
    category: 'terminology',
    severity,
    title,
    scope: { code, field: 'textZh', key: 'name-consistency' },
    location: loc(code, 'textZh'),
    pointer: `${code}.textZh`,
    evidence,
    expected,
    suggestion,
    count: 1,
    samples: [sample(code, 'textZh', '正文自引用'), sample(code, 'nameZh', '卡名')],
  });
};
if (A.selfName.length) {
  const item = A.selfName[0];
  nameFinding(item.code, `卡牌正文中的自名与卡名不一致（卡名「${item.nameZh}」，正文写作「地区探测」）`, clamp(`${item.code} nameZh=${item.nameZh}；textZh=${item.zh}`, 200), `正文改用卡名「${item.nameZh}」`, '【上游简中内部不一致】繁中正文用「地區勘測」与卡名一致，可据此修正简中正文', 'medium');
}
nameFinding('08008', '调查员名前后不一致：08007/08008 同一人物分别译作「蒙特雷·杰克」与「雷蒙特·杰克」', '08007 nameZh=「蒙特雷·杰克」；08008 textZh=「快速。雷蒙特·杰克牌库专用。」（繁中 08008 为「蒙特雷·傑克」）', '统一为「蒙特雷·杰克」', '修正 08008 正文专名；可加一条术语表校验，防止调查员名在同一循环内变体', 'medium');

if (A.shroudVariant.bare.length || A.shroudVariant.valued.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'shroud（隐藏值）译法不统一：部分卡用「隐藏值」，部分仅用「隐藏」',
    scope: { code: A.shroudVariant.bare[0] ?? A.shroudVariant.valued[0], field: 'textZh', key: 'shroud-term' },
    location: loc(A.shroudVariant.bare[0] ?? A.shroudVariant.valued[0], 'textZh'),
    pointer: `${A.shroudVariant.bare[0] ?? A.shroudVariant.valued[0]}.textZh`,
    evidence: clamp(`仅「隐藏」：${A.shroudVariant.bare.join(',')}；「隐藏值」：${A.shroudVariant.valued.join(',')}`, 200),
    expected: '统一为「隐藏值」（与规则书/多数卡一致）',
    suggestion: '把「得到+2隐藏」「得到-2隐藏」等补成「隐藏值」',
    count: A.shroudVariant.bare.length + A.shroudVariant.valued.length,
    samples: pick([...new Set([...A.shroudVariant.bare, ...A.shroudVariant.valued])].map(c => sample(c, 'textZh')), 8),
  });
}

if (A.deckLimitVariant.odd.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: '「Limit 1 … per deck」译法不统一：「每套牌库仅限1张」与「每个牌库仅限1张」并存',
    scope: { code: A.deckLimitVariant.odd[0], field: 'textZh', key: 'per-deck-limit' },
    location: loc(A.deckLimitVariant.odd[0], 'textZh'),
    pointer: `${A.deckLimitVariant.odd[0]}.textZh`,
    evidence: clamp(`08114/08115 用「每个牌库仅限1张珍贵记忆」；08019 等 ${A.deckLimitVariant.standard.length} 张卡用「每套牌库仅限1张」`, 200),
    expected: '统一为「每套牌库仅限1张」',
    suggestion: '改 08114/08115 的「每个牌库」为「每套牌库」',
    count: A.deckLimitVariant.odd.length,
    samples: A.deckLimitVariant.odd.map(c => sample(c, 'textZh')),
  });
}

if (A.doomTokenVariant.odd.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'doom token 译法不统一：「毁灭标记」与「毁灭印记」并存',
    scope: { code: A.doomTokenVariant.odd[0], field: 'textZh', key: 'doom-token' },
    location: loc(A.doomTokenVariant.odd[0], 'textZh'),
    pointer: `${A.doomTokenVariant.odd[0]}.textZh`,
    evidence: '08076：「移除当前密谋上的1个毁灭印记」；其余卡（08534/08544/08642/08648/08672/08681 等）均用「毁灭标记」',
    expected: '统一为「毁灭标记」',
    suggestion: '改 08076「毁灭印记」为「毁灭标记」',
    count: A.doomTokenVariant.odd.length,
    samples: A.doomTokenVariant.odd.map(c => sample(c, 'textZh')),
  });
}

if (A.ignoreVariant.odd.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'ignore 译法不统一：「忽略」与「忽视」并存',
    scope: { code: A.ignoreVariant.odd[0], field: 'textZh', key: 'ignore' },
    location: loc(A.ignoreVariant.odd[0], 'textZh'),
    pointer: `${A.ignoreVariant.odd[0]}.textZh`,
    evidence: '08048：「(忽视+/-)」；08004/08045/08118 用「忽略」',
    expected: '统一为「忽略」',
    suggestion: '改 08048「忽视+/-」为「忽略+/-」',
    count: A.ignoreVariant.odd.length,
    samples: A.ignoreVariant.odd.map(c => sample(c, 'textZh')),
  });
}

if (A.standardDamage.odd.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'standard damage 译法不统一：「标准伤害」与「基础伤害」并存',
    scope: { code: A.standardDamage.odd[0], field: 'textZh', key: 'standard-damage' },
    location: loc(A.standardDamage.odd[0], 'textZh'),
    pointer: `${A.standardDamage.odd[0]}.textZh`,
    evidence: '08088/08090/08092：「不造成标准伤害」；08127：「本次攻击不造成基础伤害」',
    expected: '统一为「标准伤害」',
    suggestion: '改 08127「基础伤害」为「标准伤害」',
    count: A.standardDamage.odd.length,
    samples: A.standardDamage.odd.map(c => sample(c, 'textZh')),
  });
}

if (A.fightValue.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'fight value 误译为「战斗值」（全库 fight 统一译「攻击」，应为「攻击值」；繁中亦作「攻擊值」）',
    scope: { code: A.fightValue[0], field: 'textZh', key: 'fight-value' },
    location: loc(A.fightValue[0], 'textZh'),
    pointer: `${A.fightValue[0]}.textZh`,
    evidence: '08673：「它的战斗值等于它的隐藏值」；en 为「Its fight value is equal to its shroud value」；繁中：「它的攻擊值等於它的隱藏值」',
    expected: '「它的攻击值等于它的隐藏值」',
    suggestion: '改「战斗值」为「攻击值」；同时核对 08027 卡名「Combat Training」→「战斗训练」属卡名，不受影响',
    count: A.fightValue.length,
    samples: A.fightValue.map(c => sample(c, 'textZh')),
  });
}

if (A.campaignVariant.odd.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'campaign 译法不统一：多数译「剧本」，08509 用「战役」',
    scope: { code: A.campaignVariant.odd[0], field: 'textZh', key: 'campaign' },
    location: loc(A.campaignVariant.odd[0], 'textZh'),
    pointer: `${A.campaignVariant.odd[0]}.textZh`,
    evidence: '08509：「(团队每场战役限一次)」；08502/08511 等其余卡：「每个剧本最多一次成功」「团队每个剧本仅限一次」',
    expected: '统一为「剧本」（与「剧本日志/剧本手册」术语一致）',
    suggestion: '改 08509「每场战役限一次」为「每个剧本仅限一次」；注意不要误删「剧本日志」等复合词',
    count: A.campaignVariant.odd.length,
    samples: A.campaignVariant.odd.map(c => sample(c, 'textZh')),
  });
}

if (A.sledgeVariant.qiaoCards.length) {
  addFinding({
    category: 'terminology',
    severity: 'medium',
    title: '「Wooden Sledge」译名错字：「木制雪撬」（08615 卡名/正文）与「木制雪橇」（08513 剧情奖励、08127 雪橇犬）不一致',
    scope: { code: '08615', field: 'nameZh', key: 'sledge-typo' },
    location: loc('08615', 'nameZh'),
    pointer: '08615.nameZh',
    evidence: '08615 nameZh=「木制雪撬」，textZh 同卡内混用「木制雪撬」「木制雪橇」；08513 textZh：「记录木制雪橇」（Campaign Log 奖励同名物品）',
    expected: '统一为「木制雪橇」（撬≠橇）',
    suggestion: '修正 08615 卡名与正文（全卡 3 处「雪撬」），使剧本奖励记录可对上同一张卡',
    count: A.sledgeVariant.qiaoCards.length,
    samples: [...A.sledgeVariant.qiaoCards.map(c => sample(c, 'nameZh')), ...pick(A.sledgeVariant.correct.map(c => sample(c, 'textZh', '雪橇（对照）')), 4)],
  });
}

if (A.coverVariant.wrong.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: '错别字：「白雪复盖的峭壁」（覆盖 → 复盖）',
    scope: { code: '08605', field: 'nameZh', key: 'cover-typo' },
    location: loc('08605', 'nameZh'),
    pointer: '08605.nameZh',
    evidence: '08605 nameZh=「白雪复盖的峭壁」，textZh 同用「复盖」；08533 等处用正确的「覆盖」',
    expected: '「白雪覆盖的峭壁」（正文同步）',
    suggestion: '「复」改「覆」；繁简转换常把「覆」误成「复」，建议全库扫「复盖/复写/复核」等',
    count: A.coverVariant.wrong.length,
    samples: [...A.coverVariant.wrong.map(c => sample(c, 'nameZh')), ...A.coverVariant.right.map(c => sample(c, 'textZh', '覆盖（对照）'))],
  });
}

if (A.attrStyle.hpcompact.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: '引文署名格式不统一：80 处 Lovecraft 引文中仅 08047 用「H.P.洛夫克拉夫特，《无名之城》」，其余用「H. P. 洛夫克拉夫特《疯狂山脉》」',
    scope: { code: A.attrStyle.hpcompact[0].code, field: A.attrStyle.hpcompact[0].field, key: 'flavor-attribution-style' },
    location: loc(A.attrStyle.hpcompact[0].code, A.attrStyle.hpcompact[0].field),
    pointer: `${A.attrStyle.hpcompact[0].code}.${A.attrStyle.hpcompact[0].field}`,
    evidence: clamp(A.attrStyle.hpcompact[0].zh, 160),
    expected: '统一「H. P. 洛夫克拉夫特《作品名》」（有的用「，」有的不用，也建议统一）',
    suggestion: '统一缩写空格与署名—作品分隔符；优先以多数（79 处）体例为准',
    count: A.attrStyle.hpcompact.length,
    samples: [...A.attrStyle.hpcompact.map(x => sample(x.code, x.field)), ...pick(A.attrStyle.hpspace.map(x => sample(x.code, x.field, '多数体例对照')), 6)],
  });
  if (A.attrStyle.missing.length) {
    addFinding({
      category: 'missing-translation',
      severity: 'low',
      title: 'en 有 Lovecraft 引文署名而简中风味文本缺署名',
      scope: { code: A.attrStyle.missing[0].code, field: A.attrStyle.missing[0].field, key: 'flavor-attribution-missing' },
      location: loc(A.attrStyle.missing[0].code, A.attrStyle.missing[0].field),
      pointer: `${A.attrStyle.missing[0].code}.${A.attrStyle.missing[0].field}`,
      evidence: 'en 风味文本含「 - H. P. Lovecraft, …」署名，简中无「洛夫克拉夫特」',
      expected: '补回作者/作品署名',
      suggestion: '补译署名，与其余 79 处保持一致',
      count: A.attrStyle.missing.length,
      samples: A.attrStyle.missing.map(x => sample(x.code, x.field)),
    });
  }
}

if (A.remainingVariant.shengxia.length && A.remainingVariant.shengyu.length) {
  addFinding({
    category: 'terminology',
    severity: 'low',
    title: 'remaining 译法不统一：「剩下的每位调查员」与「剩余的每位调查员」并存',
    scope: { code: A.remainingVariant.shengxia[0], field: 'textZh', key: 'remaining' },
    location: loc(A.remainingVariant.shengxia[0], 'textZh'),
    pointer: `${A.remainingVariant.shengxia[0]}.backTextZh`,
    evidence: clamp(`「剩下」：${A.remainingVariant.shengxia.join(',')}；「剩余」：${A.remainingVariant.shengyu.join(',')}`, 200),
    expected: '统一为「剩余的每位调查员」',
    suggestion: '把 08525/08545/08552 等的「剩下的」改为「剩余的」；属风格统一，非规则错误',
    count: A.remainingVariant.shengxia.length + A.remainingVariant.shengyu.length,
    samples: pick([...A.remainingVariant.shengxia, ...A.remainingVariant.shengyu].map(c => sample(c, 'backTextZh')), 8),
  });
}

// ---- marker-leak: 机械扫描未发现内部标记泄漏（localeStatus 均为 complete，无 marker 文本） ----

// ---------------------------------------------------------------------------
// 6. 需要人工裁定的候选（不写入 findings，写入 stdout / notes 附录）
// ---------------------------------------------------------------------------

const reviewCandidates = [
  `133 处「[[特性]]」写法检查：除 08520 外全部与 en 数量/内容对应（含中文特性名翻译），仅 08520 丢失 [[Objective]]。`,
  '403 卡 4030 个 zh 字段与上游 cards_zh-cn.json 去标签结果逐字节一致；localeStatus=complete 全部复算一致；无英文回退/繁中回退。',
  '逐卡人工精读覆盖 eoep 全部 137 张 + eoec 全部 266 张的规则文本与背面（见 _dump.md）；风味文本按可疑清单抽查，未发现独立误译。',
  '08553/08554/08555「if you are running out of time」等提示语、08624-08626「Remember that the team …」等 Campaign Log 记录语均按 en 译出，未发现语义偏差。',
  '08048「[elder_sign] 可视作 1 或 11」与 en 一致；08057/08058 充能条件、08522/08608/08641/08679/08711 Massive 关键词均一致。',
  '083xx/086xx 号码段中 08501-08738 按 a/b 面拆分正确，无字段错位；重印/别名卡（08553-08555 等）文本与 en 一致。',
];

// ---------------------------------------------------------------------------
// 7. 输出
// ---------------------------------------------------------------------------

const byCategory = { 'missing-translation': 0, 'mixed-language': 0, 'symbol-format': 0, mistranslation: 0, 'marker-leak': 0, terminology: 0 };
const bySeverity = { high: 0, medium: 0, low: 0 };
for (const f of findings) {
  byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
}

const scopeStats = {
  cards: cards.length,
  byPack: cards.reduce((o, c) => ((o[c.pack] = (o[c.pack] || 0) + 1), o), {}),
  fieldsChecked: cards.length * DISPLAY_FIELDS.length,
  fieldStatus: Object.fromEntries(Object.entries(A.fieldStatusTally).sort(([a], [b]) => a.localeCompare(b))),
  importDivergences: A.importDivergences.length,
  localeStatusMismatch: A.localeStatusMismatch.length,
  upstreamSource: {
    en: upstream.en.rel,
    zhCn: upstream.cn.rel,
    zh: upstream.tw.rel,
    rows: upstream.en.rows.length,
  },
};

const result = {
  area: AREA,
  auditor: AUDITOR,
  generatedAt: TODAY,
  method:
    '以本仓 tools/import-cards.mjs 的字段导入规则复算 403 张 EOTE 卡的 zh 期望值并与实际逐字段比对（判定继承/改写），再以脚本做 token/[[特性]]/数字/行数/标点/空格/简繁/术语变体全套机械扫描，最后对 eoep 137 张全量 + eoec 266 张全量逐卡中英对照人工复核与裁定；所有 location 由脚本源码块索引定位。',
  scope: {
    source: 'src/cards/cards-data.js（pack=eoep/eoec） + 参考资源/ArkhamHorror-main/frontend/public/cards_{en,zh-cn,zh}.json',
    count: cards.length,
    notes: [
      `pack 分布：eoep ${scopeStats.byPack.eoep} 张（调查员 5 + 玩家卡）+ eoec ${scopeStats.byPack.eoec} 张（战役卡，含 08501-08738 及 a/b 面）`,
      `检查字段：${DISPLAY_FIELDS.filter(f => f !== 'customization_text' && f !== 'customization_change').join('/')}（customization* 在 EOTE 全为空）`,
      `字段来源复算：translated ${A.fieldStatusTally.translated || 0} / not-applicable ${A.fieldStatusTally['not-applicable'] || 0}；英文回退 0、繁中回退 0、本仓改写差异 ${A.importDivergences.length}`,
      'EOTE 卡中文 = 上游 ArkhamDB 简体数据去 HTML 标签后的产物（README §2 口径），故本轮所有 findings 均为上游继承（source=upstream-zh-cn），本仓导入/改写引入问题 0 处',
      '[[Objective]] 丢失经核对为上游简中原文即写作 <b>目标</b>（cn 原文无 [[ ]] 标记），不是本仓 stripHtml 造成',
    ],
  },
  summary: { findings: findings.length, byCategory, bySeverity },
  findings,
  reviewCandidates,
  reproduction: {
    command: 'node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs',
    write: 'node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --write',
    dump: 'node docs/edgeOfTheEarth/translate/tools/cards-scan.mjs --dump',
    inputs: [upstream.en.rel, upstream.cn.rel, upstream.tw.rel, 'src/cards/cards-data.js'],
  },
};

if (ARG_JSON) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('== 《地球边缘》卡面中文翻译审计：复现扫描 ==');
  console.log(
    JSON.stringify(
      {
        scope: { cards: cards.length, byPack: scopeStats.byPack, fieldsChecked: scopeStats.fieldsChecked },
        fieldStatus: scopeStats.fieldStatus,
        importDivergences: scopeStats.importDivergences,
        localeStatusMismatch: scopeStats.localeStatusMismatch,
        summary: result.summary,
      },
      null,
      2,
    ),
  );
  console.log('\n--- findings（按分类/严重度） ---');
  for (const f of findings) {
    console.log(`${f.id} [${f.category}/${f.severity}] count=${f.count} ${f.title}`);
    console.log(`    location: ${f.location}  pointer: ${f.pointer}`);
  }
  console.log('\n--- 人工裁定/复核候选 ---');
  for (const item of reviewCandidates) console.log(`- ${item}`);
  if (ARG_NOTES_STATS) {
    console.log('\n--- notes 统计片段 ---');
    console.log(`byCategory=${JSON.stringify(byCategory)}`);
    console.log(`bySeverity=${JSON.stringify(bySeverity)}`);
    console.log(`fastFree tokens=${A.fastFree.tokens} cards=${A.fastFree.cards.size}`);
    console.log(`lineDiff=${A.lineDiff.length} quoteMerge=${A.quoteMerge.length}`);
  }
}

// ---------------------------------------------------------------------------
// 8. --write / --dump 产物
// ---------------------------------------------------------------------------

function writeFindings() {
  const target = writeArtifact('findings.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\n[findings] 已写 ${path.relative(path.resolve(MOD_ROOT, '../..'), target).replaceAll('\\', '/')}（${findings.length} 条）`);
}

function writeDump() {
  const lines = [];
  lines.push('# EOTE（《地球边缘》）卡面中英对照 dump（脚本生成，供人工复核；勿手改）');
  lines.push('');
  lines.push(`- 生成日期：${TODAY}；来源：\`src/cards/cards-data.js\`（pack=eoep/eoec，${cards.length} 张）。`);
  lines.push('- 字段行号由 `docs/edgeOfTheEarth/translate/tools/cards-scan.mjs` 的源码块索引给出；`—` 表示该侧为空。');
  lines.push('- `text`/`backText`/`flavor`/`backFlavor` 为英文原文（`flavor` 保留 en 原样，可能含 `<i>` 标签），`*Zh` 为本仓去标签后的简中。');
  lines.push('');
  for (const card of cards) {
    const r = card.repo;
    lines.push(`## ${card.code} · ${r.name}${r.nameZh ? ` / ${r.nameZh}` : ''}`);
    lines.push(`- 行号：${loc(card.code, 'name')}（name/nameZh） · ${loc(card.code, 'textZh')}（textZh） · ${loc(card.code, 'backTextZh')}（backTextZh）`);
    lines.push(`- pack=${r.pack} · type=${r.type}${r.subname ? ` · subname=${r.subname} / ${r.subnameZh || '—'}` : ''}`);
    if (r.traits?.length || r.traitsZh?.length) lines.push(`- traits: ${(r.traits || []).join(' / ') || '—'}  ||  ${(r.traitsZh || []).join(' / ') || '—'}`);
    const block = (label, en, zh) => {
      if (!en && !zh) return;
      lines.push(`- ${label} EN:`);
      lines.push('```');
      lines.push(en || '—');
      lines.push('```');
      lines.push(`- ${label} ZH:`);
      lines.push('```');
      lines.push(zh || '—');
      lines.push('```');
    };
    block('text', r.text, r.textZh);
    block('backText', r.backText, r.backTextZh);
    block('flavor', r.flavor ? stripHtml(r.flavor) : '', r.flavorZh);
    block('backFlavor', r.backFlavor ? stripHtml(r.backFlavor) : '', r.backFlavorZh);
    lines.push('');
  }
  const target = writeArtifact('_dump.md', `${lines.join('\n')}\n`);
  console.log(`[dump] 已写 ${path.relative(path.resolve(MOD_ROOT, '../..'), target).replaceAll('\\', '/')}`);
}

if (ARG_WRITE) writeFindings();
if (ARG_DUMP) writeDump();
