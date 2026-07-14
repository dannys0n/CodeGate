import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

async function loadFile(file, destination) {
  const input = fs.createReadStream(file);
  let pending = Buffer.alloc(0);
  let position = 0;
  const accept = (raw, offset) => {
    const line = raw.length && raw[raw.length - 1] === 13 ? raw.subarray(0, -1) : raw;
    if (!line.toString('utf8').trim()) return;
    const record = JSON.parse(line.toString('utf8'));
    const id = String(record.question_id ?? '');
    if (/^\d+$/.test(id) && Array.isArray(record.input_output) && record.input_output.length) {
      record._locator = { file, offset, length: line.length, sha256: createHash('sha256').update(line).digest('hex') };
      destination.set(id, record);
    }
  };
  for await (const chunk of input) {
    const dataStart = position - pending.length;
    position += chunk.length;
    const data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    let start = 0;
    for (let newline = data.indexOf(10, start); newline !== -1; newline = data.indexOf(10, start)) {
      accept(data.subarray(start, newline), dataStart + start);
      start = newline + 1;
    }
    pending = data.subarray(start);
  }
  if (pending.length) accept(pending, position - pending.length);
}

export async function loadNewfacade(root) {
  const records = new Map();
  await loadFile(path.join(root, 'LeetCodeDataset-train.jsonl'), records);
  await loadFile(path.join(root, 'LeetCodeDataset-test.jsonl'), records);
  return records;
}
