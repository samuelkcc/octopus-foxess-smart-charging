// Structural review only. This does not validate the complete STE dictionary.
import { readFile } from 'node:fs/promises';
const files = ['README.md', 'linux/README-RASPBERRY-PI.md', 'dev/README.md', 'docs/WEB-GUIDE.md', 'docs/ARCHITECTURE.md', 'docs/FEATURE-PARITY.md', 'docs/WRITING.md'];
const problems = [];
function check(text, file, line, limit) {
  const plain = text.replace(/`[^`]+`/g, 'TECHNICAL_TERM').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '');
  const sentences = plain.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (words.length > limit) problems.push(`${file}:${line}: ${words.length} words exceed the ${limit}-word project limit: ${sentence}`);
    if (sentence.includes(';')) problems.push(`${file}:${line}: Replace the prose semicolon with separate sentences.`);
    if (/\b(?:don't|can't|won't|isn't|it's|doesn't|shouldn't)\b/i.test(sentence)) problems.push(`${file}:${line}: Expand the contraction.`);
  }
}
for (const file of files) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  let code = false, paragraph = [], paragraphLine = 1;
  const flush = () => { if (paragraph.length) check(paragraph.join(' '), file, paragraphLine, 25); paragraph = []; };
  lines.forEach((line, index) => {
    if (line.startsWith('```')) { flush(); code = !code; return; }
    if (code) return;
    if (!line.trim() || /^(#|\||!\[)/.test(line)) { flush(); return; }
    const instruction = line.match(/^\d+\.\s+(.+)/);
    if (instruction) { flush(); check(instruction[1], file, index + 1, 20); return; }
    if (/^-\s+/.test(line)) { flush(); check(line.replace(/^-\s+/, ''), file, index + 1, 25); return; }
    if (!paragraph.length) paragraphLine = index + 1;
    paragraph.push(line.trim());
  });
  flush();
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log('Current-guide sentence length, contractions and punctuation checks passed. Full STE vocabulary and meaning review remains a separate task.');
