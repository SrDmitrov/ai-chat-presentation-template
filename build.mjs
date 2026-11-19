#!/usr/bin/env node
// Builds each example-conversations/*.chat and private-conversations/*.chat into two self-contained pages in dist/:
//   <name>.html           full document, for any static web host
//   <name>.artifact.html  fragment without doctype/head/body, for a Claude artifact
// Usage: node build.mjs [file.chat ...]   (no arguments: every file in both folders)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// directive -> what it requires
const KINDS = {
  banner: 'body', note: 'arg', dim: 'arg', user: 'arg', slash: 'arg', spin: 'arg',
  tool: 'arg', 'tool!': 'arg', say: 'body', ask: 'body', done: 'arg',
};
const QA = / (?:→|->) /; // an @ask line: "Question → Answer"
const META = { title: 'Chat replay', subtitle: '', window: 'terminal', status: '', footer: '' };

function parse(text, file) {
  const meta = { ...META }, events = [];
  let cur = null;
  const fail = (n, msg) => { throw new Error(`${file}:${n}: ${msg}`); };
  text.replace(/\r/g, '').split('\n').forEach((raw, idx) => {
    const n = idx + 1;
    if (raw.startsWith('@')) {
      const sp = raw.indexOf(' ');
      const k = sp < 0 ? raw.slice(1) : raw.slice(1, sp);
      if (!(k in KINDS)) fail(n, `unknown directive @${k} (known: ${Object.keys(KINDS).map((x) => '@' + x).join(' ')})`);
      cur = { k, arg: sp < 0 ? '' : raw.slice(sp + 1).trim(), body: [], n };
      events.push(cur);
    } else if (cur) {
      cur.body.push(raw.startsWith('\\@') ? raw.slice(1) : raw);
    } else if (raw.trim() && !raw.startsWith('#')) {
      const m = raw.match(/^(\w+):\s*(.*)$/);
      if (!m || !(m[1] in META)) fail(n, `expected one of ${Object.keys(META).map((x) => x + ':').join(' ')} or an @directive`);
      meta[m[1]] = m[2].trim();
    }
  });
  for (const e of events) {
    while (e.body.length && !e.body[e.body.length - 1].trim()) e.body.pop();
    while (e.body.length && !e.body[0].trim()) e.body.shift();
    if (KINDS[e.k] === 'arg' && !e.arg) fail(e.n, `@${e.k} needs text on the same line`);
    if (KINDS[e.k] === 'body' && !e.body.length) fail(e.n, `@${e.k} needs lines below it`);
    if (e.k === 'ask') {
      e.body = e.body.filter((l) => l.trim());
      const bad = e.body.find((l) => !QA.test(l));
      if (bad) fail(e.n, `@ask lines must be "Question → Answer", got: ${bad}`);
      e.body = e.body.map((l) => l.split(QA).map((s) => s.trim()));
    }
    delete e.n;
  }
  if (!events.length) fail(1, 'no @directives found');
  return { meta, events };
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

function build(file) {
  const { meta, events } = parse(readFileSync(file, 'utf8'), file);
  const values = {
    TITLE: esc(meta.title), SUBTITLE: inline(meta.subtitle), WINDOW: esc(meta.window),
    STATUS: esc(meta.status), FOOTER: inline(meta.footer),
    CSS: read('src/player.css'), JS: read('src/player.js'),
    DATA: JSON.stringify(events).replace(/</g, '\\u003c'), // keeps "</script>" in a transcript from closing the tag
  };
  const page = read('src/page.html').replace(/\{\{(\w+)\}\}/g, (_, k) => values[k]);
  const [head, body] = page.split('<!--body-->');
  const name = basename(file).replace(/\.[^.]+$/, '');
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist', `${name}.artifact.html`), head + body);
  writeFileSync(
    join(ROOT, 'dist', `${name}.html`),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
      `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
      `${head}</head>\n<body>${body}</body>\n</html>\n`
  );
  console.log(`built dist/${name}.html and dist/${name}.artifact.html (${events.length} events)`);
}

const files = process.argv.slice(2);
if (!files.length) {
  for (const d of ['example-conversations', 'private-conversations']) {
    const dir = join(ROOT, d);
    if (existsSync(dir)) files.push(...readdirSync(dir).filter((f) => f.endsWith('.chat')).map((f) => join(dir, f)));
  }
}
try {
  files.forEach(build);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
