import fs from 'node:fs/promises';
import path from 'node:path';

export async function appendSessionHistory(userDataPath, entry) {
  const historyPath = path.join(userDataPath, 'session-history.json');
  let history = [];
  try {
    const parsed = JSON.parse(await fs.readFile(historyPath, 'utf8'));
    if (Array.isArray(parsed)) history = parsed;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  history.push(entry);
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(historyPath, `${JSON.stringify(history.slice(-500), null, 2)}\n`);
  return historyPath;
}
