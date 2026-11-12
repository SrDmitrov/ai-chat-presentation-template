#!/usr/bin/env node
// Converts a Claude Code `/export` transcript into a .chat draft on stdout.
// Best effort: the export is plain text wrapped at the terminal width, so review the draft before building.
// Usage: node import-claude-code.mjs <export.txt> > conversations/<name>.chat
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node import-claude-code.mjs <export.txt> > conversations/<name>.chat');
  process.exit(1);
}
const lines = readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
const width = Math.max(...lines.map((l) => l.length)); // prompts are padded to the terminal width

const blank = (l) => l === undefined || !l.trim();
const isOut = (l) => l !== undefined && /^\s*⎿/.test(l);
const isDim = (l) => /^ {2}\S.*\(ctrl\+o to expand\)\s*$/.test(l);

// Undo wrapping. A token too long for one line was cut mid-word at the width; every other break was at a space.
function isCut(prev, rawPrev, next, indent) {
  const a = prev.split(/\s+/).pop(), b = next.split(/\s+/)[0];
  return rawPrev.trimEnd().length >= width && a.length + b.length > width - indent;
}
const join = (prev, rawPrev, next, indent) => prev + (isCut(prev, rawPrev, next, indent) ? '' : ' ') + next;

let i = 0;
const out = [];
const body = (l) => out.push(l.startsWith('@') ? '\\' + l : l);

// continuation lines of a prompt or tool call (lines[i - 1] is its first line)
function unwrap(text, indent) {
  let raw = lines[i - 1];
  while (i < lines.length && !blank(lines[i]) && /^\s/.test(lines[i]) && !isOut(lines[i])) {
    text = join(text, raw, lines[i].trim(), indent);
    raw = lines[i++];
  }
  return text;
}

// "  ⎿  first" plus lines indented by 5; wrapped lines are rejoined, real line breaks kept
function output() {
  let raw = lines[i];
  const res = [lines[i++].replace(/^\s*⎿\s*/, '').trimEnd()];
  while (i < lines.length && /^ {5}\S/.test(lines[i])) {
    const t = lines[i].trim(), last = res.length - 1;
    if (/\s$/.test(raw)) res[last] += ' ' + t;
    else if (isCut(res[last], raw, t, 5)) res[last] += t;
    else res.push(t);
    raw = lines[i++];
  }
  return res;
}

// assistant text: paragraphs, bullets, numbered items and box tables, each unwrapped to one line
function say(first) {
  const res = [];
  let cur = first, raw = lines[i - 1];
  const flush = () => { if (cur !== null) res.push(cur); cur = null; };
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (blank(l)) { flush(); res.push(''); continue; }
    if (/^\S/.test(l) || (isDim(l) && blank(lines[i - 1]))) break;
    const t = l.replace(/^ {2}/, '').trimEnd();
    if (/^[┌│├└]/.test(t)) { flush(); res.push(t); continue; }
    if (/^\s*(-|\d+\.) /.test(t)) { flush(); cur = (/^\s/.test(t) ? '  ' : '') + t.trim(); }
    else if (cur === null) cur = t.trim();
    else cur = join(cur, raw, t.trim(), l.length - l.trimStart().length);
    raw = l;
  }
  flush();
  while (res.length && !res[res.length - 1]) res.pop();
  return res;
}

while (i < lines.length) {
  const l = lines[i];
  if (blank(l)) { i++; continue; }
  if (!out.length && /[▀-▟]/.test(l)) {
    out.push('@banner');
    while (!blank(lines[i])) out.push(lines[i++].trimEnd());
  } else if (/User answered Claude's questions:\s*$/.test(l) && isOut(lines[i + 1])) {
    i++;
    out.push('@ask');
    output().forEach((qa) => body(qa.replace(/^· /, ''))); // "· Question → Answer"
  } else if (/^[❯>] /.test(l)) {
    i++;
    const text = unwrap(l.slice(2).trim(), 2);
    if (isOut(lines[i])) { out.push('@slash ' + text); output().forEach(body); }
    else out.push('@user ' + text);
  } else if (/^[⏺●] /.test(l)) {
    i++;
    const rest = l.slice(2).trimEnd();
    if (/^[A-Za-z_][\w.:-]*\(/.test(rest)) {
      const call = unwrap(rest, 6);
      const res = isOut(lines[i]) ? output() : [];
      out.push((/^Error\b/.test(res[0] ?? '') ? '@tool! ' : '@tool ') + call);
      res.forEach(body);
    } else {
      out.push('@say');
      say(rest).forEach(body);
    }
  } else if (/^[✻✽✶✳✢·*] \S+ for \d/.test(l)) {
    out.push('@done ' + l.slice(2).trim());
    i++;
  } else {
    out.push('@dim ' + l.trim().replace(/^⎿\s*/, ''));
    i++;
  }
}

const title = basename(file).replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
console.log([`title: ${title}`, 'subtitle:', 'window: claude', 'status:', 'footer:', '', ...out].join('\n'));
