#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const csvPath = path.join(__dirname, 'Definitions.csv');
const outputPath = path.join(__dirname, 'public', 'definitions.json');

const raw = fs.readFileSync(csvPath, 'utf-8');

const rows = parse(raw, {
  columns: false,
  skip_empty_lines: true,
  from_line: 2,
  relax_column_count: true,
});

// Parse "Ch N: Title" → { chapter: N, title: "Title" }
function parseTopic(topic) {
  const m = topic.match(/^Ch\s+(\d+):\s*(.+)$/i);
  if (m) return { chapter: parseInt(m[1], 10), title: m[2].trim() };
  return null;
}

const topicMap = new Map(); // topic string → { chapter, title, terms[] }
const topicOrder = [];

for (const fields of rows) {
  const [front, back, topic, rawKeywords] = fields;
  if (!front || !back || !topic) continue;

  const keywords = rawKeywords
    ? rawKeywords.split('|').map(k => k.trim().toLowerCase()).filter(Boolean)
    : [];

  if (!topicMap.has(topic)) {
    const parsed = parseTopic(topic);
    if (!parsed) {
      console.warn(`  Skipping row: unrecognised topic format "${topic}"`);
      continue;
    }
    topicMap.set(topic, { chapter: parsed.chapter, title: parsed.title, terms: [] });
    topicOrder.push(topic);
  }

  topicMap.get(topic).terms.push({ term: front, definition: back, keywords });
}

const chapters = topicOrder
  .map(t => topicMap.get(t))
  .sort((a, b) => a.chapter - b.chapter);

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(chapters, null, 2), 'utf-8');

console.log(`✅ Generated ${outputPath}`);
console.log(`   ${chapters.length} chapters, ${chapters.reduce((s, c) => s + c.terms.length, 0)} total terms`);
chapters.forEach(c => {
  console.log(`   Ch ${c.chapter}: ${c.title} (${c.terms.length} terms)`);
});
