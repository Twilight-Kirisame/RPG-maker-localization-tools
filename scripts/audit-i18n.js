const fs = require('fs');
const path = require('path');

const root = 'F:/フリーゲーム/RPG localization';

function read(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }

// Extract object literal assigned to a const name or fallbackI18n
function extractI18nWithAssigns(text, name) {
  // 1. Extract the initial object literal assigned to `name`
  const declRe = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\{`, 'g');
  const match = declRe.exec(text);
  if (!match) return null;
  let depth = 1;
  let i = match.index + match[0].length - 1;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  while (i < text.length && depth > 0) {
    i++;
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === stringChar) { inString = false; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  const initialLiteral = text.slice(match.index + match[0].length - 1, i + 1);

  // 2. Find and evaluate Object.assign(name, ...) calls that extend it
  const assignRe = new RegExp(`Object\\.assign\\(\\s*${name}(?:\\[[^\\]]+\\]|\\.[a-zA-Z0-9_$]+)?\\s*,`, 'g');
  const assigns = [];
  let am;
  while ((am = assignRe.exec(text))) {
    let d = 0;
    let j = am.index + am[0].length; // position after the comma
    let inStr = false;
    let strChar = '';
    let esc = false;
    while (j < text.length) {
      const ch = text[j];
      if (inStr) {
        if (esc) { esc = false; }
        else if (ch === '\\') { esc = true; }
        else if (ch === strChar) { inStr = false; }
      } else {
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; }
        else if (ch === '{') d++;
        else if (ch === '}') d--;
      }
      if (d === 0 && ch === '}') {
        // include closing ')' and optional ';'
        let k = j + 1;
        while (k < text.length && /\s/.test(text[k])) k++;
        if (text[k] === ')') j = k;
        break;
      }
      j++;
    }
    assigns.push(text.slice(am.index, j + 1));
  }

  const code = `var ${name} = ${initialLiteral};\n${assigns.join(';\n')};\nreturn ${name};`;
  // Debug: if name is fallbackI18n, log assigns
  if (name === 'fallbackI18n') {
    console.log('ASSIGNS COUNT', assigns.length);
    assigns.forEach((a, i) => console.log('ASSIGN', i, a.slice(0, 80)));
  }
  const fn = new Function(code);
  return fn();
}

const rendererText = read('renderer/renderer.js');
const bootstrapText = read('renderer/app/bootstrap.js');

const rendererI18n = extractI18nWithAssigns(rendererText, 'fallbackI18n');
const bootstrapI18n = extractI18nWithAssigns(bootstrapText, 'i18n');

console.log('renderer zh-CN keys:', Object.keys(rendererI18n['zh-CN']).length);
console.log('bootstrap zh-CN keys:', Object.keys(bootstrapI18n['zh-CN']).length);
console.log('renderer has findReplace.title?', 'findReplace.title' in rendererI18n['zh-CN']);
console.log('renderer has ai.apiKey?', 'ai.apiKey' in rendererI18n['zh-CN']);

function mergeDicts(a, b) {
  const langs = new Set([...Object.keys(a), ...Object.keys(b)]);
  const merged = {};
  for (const lang of langs) {
    merged[lang] = { ...(a[lang] || {}), ...(b[lang] || {}) };
  }
  return merged;
}

const allI18n = mergeDicts(rendererI18n, bootstrapI18n);

// Find all keys used in HTML
const html = read('renderer/index.html');
const htmlKeys = new Set();
const attrRe = /data-i18n(?:-(?:placeholder|title|aria-label))?="([^"]+)"/g;
let m;
while ((m = attrRe.exec(html))) htmlKeys.add(m[1]);

// Find translate/t calls in JS files
const jsFiles = [
  'renderer/renderer.js',
  'renderer/app/bootstrap.js',
  'renderer/app/entries.js',
  'renderer/app/glossary.js',
  'renderer/app/project.js',
  'renderer/app/find-replace.js',
  'renderer/app/view.js',
  'renderer/app/controller.js',
  'renderer/export-module.js',
];
const jsKeys = new Set();
for (const f of jsFiles) {
  const text = read(f);
  // translate('key', ...) or t('key', ...)
  const re = /(?:\btranslate|\bt)\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = re.exec(text))) jsKeys.add(m[1]);
}

const allUsedKeys = new Set([...htmlKeys, ...jsKeys]);

console.log('=== Languages ===');
console.log(Object.keys(allI18n));
console.log('\n=== Total used keys ===', allUsedKeys.size);
console.log('\n=== Missing per language ===');
for (const lang of Object.keys(allI18n)) {
  const dict = allI18n[lang];
  const missing = [...allUsedKeys].filter(k => !(k in dict)).sort();
  console.log(`\n${lang}: ${missing.length}`);
  if (missing.length) console.log(missing.map(k => `  - ${k}`).join('\n'));
}

console.log('\n=== Potentially unused dictionary keys (present but not used) ===');
for (const lang of Object.keys(allI18n)) {
  const dict = allI18n[lang];
  const unused = Object.keys(dict).filter(k => !allUsedKeys.has(k)).sort();
  console.log(`\n${lang}: ${unused.length}`);
  if (unused.length) console.log(unused.map(k => `  - ${k}`).join('\n'));
}

console.log('\n=== Duplicate keys within dictionaries ===');
for (const lang of Object.keys(allI18n)) {
  // We already merged, so duplicates are overwritten. Need to detect duplicates in source text.
}

// Check for hardcoded Chinese in HTML (simple heuristic: CJK chars outside i18n strings)
console.log('\n=== Hardcoded CJK in HTML (simple scan) ===');
const cjkRe = /[一-鿿]+/g;
const lines = html.split('\n');
lines.forEach((line, idx) => {
  if (line.match(cjkRe) && !line.includes('data-i18n') && !line.includes('lang=')) {
    console.log(`HTML L${idx + 1}: ${line.trim().slice(0, 120)}`);
  }
});
