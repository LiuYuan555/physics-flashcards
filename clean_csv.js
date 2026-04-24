#!/usr/bin/env node
/**
 * Parses Definitions.csv, strips citation markers, extracts chapter structure,
 * and outputs a clean definitions.json.
 */
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'Definitions.csv');
const outputPath = path.join(__dirname, 'public', 'definitions.json');

const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

function cleanText(text) {
  return text
    .replace(/\[cite_start\]/g, '')
    .replace(/\[cite:\s*[\d,\s]+\]/g, '')
    .replace(/^"+|"+$/g, '')
    .replace(/""/g, '"')
    .trim();
}

const chapters = [];
let currentChapter = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Skip header row
  if (i === 0 && line.toLowerCase().includes('term') && line.toLowerCase().includes('definition')) {
    continue;
  }

  const cleaned = cleanText(line);

  // Check for chapter headers: --- CHAPTER N: TITLE ---
  const chapterMatch = cleaned.match(/---\s*CHAPTER\s+(\d+):\s*(.+?)\s*---/i);
  if (chapterMatch) {
    currentChapter = {
      chapter: parseInt(chapterMatch[1], 10),
      title: chapterMatch[2].trim(),
      terms: []
    };
    chapters.push(currentChapter);
    continue;
  }

  // Parse term,definition — handle the messy CSV quoting
  // Try to split on the first comma that separates term from definition
  let term = '';
  let definition = '';

  // The cleaned line should look like: "Term","Definition" or Term,"Definition" etc.
  // Let's find the split point
  const commaMatch = cleaned.match(/^(.+?),\s*"?(.+)"?$/);
  if (commaMatch) {
    term = commaMatch[1].replace(/^"+|"+$/g, '').trim();
    definition = commaMatch[2].replace(/^"+|"+$/g, '').trim();
  } else {
    continue; // Skip malformed lines
  }

  if (term && definition && currentChapter) {
    currentChapter.terms.push({ term, definition });
  }
}

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(chapters, null, 2), 'utf-8');

console.log(`✅ Generated ${outputPath}`);
console.log(`   ${chapters.length} chapters, ${chapters.reduce((s, c) => s + c.terms.length, 0)} total terms`);
chapters.forEach(c => {
  console.log(`   Chapter ${c.chapter}: ${c.title} (${c.terms.length} terms)`);
});
