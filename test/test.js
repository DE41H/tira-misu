const fs = require('fs');
const path = require('path');

const hooks = path.join(__dirname, '../backend/pb_hooks');
const schema = require(`${hooks}/iris/schema.json`).properties;
const enums = { category: schema.category.enum.filter((c) => c !== 'none'), audience: schema.audience.enum };
global.__hooks = hooks;
global.$app = { findCollectionByNameOrId: () => ({ fields: { getByName: (f) => ({ values: enums[f] }) } }) };
const { parse } = require(`${hooks}/parse.js`);

const rules = Object.entries(require(`${hooks}/iris/rules.json`)).map(([name, src]) => {
  const [, flags = '', body] = src.match(/^(?:\(\?([a-z]+)\))?([\s\S]*)$/);
  return [name, new RegExp(body.replace(/\\A/g, '^'), `g${flags}`)];
});

/** Like Iris: per rule, the first non-empty group of every match, deduplicated. */
function runRules(text) {
  const out = {};
  for (const [name, re] of rules) {
    const hits = [...text.matchAll(re)].map((m) => m.slice(1).find((g) => g)).filter(Boolean);
    if (hits.length) out[name] = [...new Set(hits)];
  }
  return out;
}

const alnum = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const ms = (s) => (s ? Date.parse(s) : null);
/** The fields where got differs from want. */
function diff(want, got) {
  if (!want || !got) return want === got ? [] : [`want ${want ? 'an event' : 'null'}, got ${got ? got.start.toISOString() : 'null'}`];
  const bad = [];
  const show = (d) => (d ? new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 16) : null);
  if (want.category !== got.category) bad.push(`category ${want.category} != ${got.category}`);
  if (ms(want.start) !== got.start.getTime()) bad.push(`start ${want.start.slice(0, 16)} != ${show(got.start)}`);
  if (ms(want.end) !== (got.end?.getTime() ?? null)) bad.push(`end ${want.end?.slice(0, 16) ?? null} != ${show(got.end)}`);
  if (want.allDay !== got.allDay) bad.push(`allDay ${want.allDay} != ${got.allDay}`);
  if (want.cancelled !== got.cancelled) bad.push(`cancelled ${want.cancelled} != ${got.cancelled}`);
  const placeOk = want.place ? !!got.place && alnum(got.place).includes(alnum(want.place)) : !got.place;
  if (!placeOk) bad.push(`place ${want.place} != ${got.place}`);
  return bad;
}

const dir = path.join(__dirname, 'mail');
const files = fs.readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).sort();
const failed = [];
for (const f of files) {
  const { input, output } = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  let bad;
  try {
    bad = diff(output, parse({ ...input.answers, rules: runRules(`${input.subject}\n\n${input.body}`) }, input.date));
  } catch (err) {
    bad = [`threw ${err}`];
  }
  if (bad.length) failed.push(f.replace('.json', '')), console.log(`${f.replace('.json', '')} ${input.subject.slice(0, 60)}\n    ${bad.join('\n    ')}`);
}
console.log(`\n${files.length - failed.length}/${files.length} correct`);
if (failed.length) console.log(`failed: ${failed.join(', ')}`);
process.exit(failed.length ? 1 : 0);
