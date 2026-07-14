import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

async function loadFile(file, destination) {
  const input = fs.createReadStream(file, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const id = String(record.question_id ?? '');
    if (/^\d+$/.test(id) && Array.isArray(record.input_output) && record.input_output.length) destination.set(id, record);
  }
}

export async function loadNewfacade(root) {
  const records = new Map();
  await loadFile(path.join(root, 'LeetCodeDataset-train.jsonl'), records);
  await loadFile(path.join(root, 'LeetCodeDataset-test.jsonl'), records);
  return records;
}
