import fs from 'fs';
import path from 'path';

// Plik z ostrzeżeniami (prosty JSON)
const warnsPath = path.join(__dirname, '../data/warns.json');

export type WarnEntry = {
  userId: string;
  moderatorId: string;
  reason: string;
  timestamp: number; // ms
};

export type WarnDB = {
  [guildId: string]: {
    [userId: string]: WarnEntry[];
  };
};

function ensureFile() {
  if (!fs.existsSync(warnsPath)) {
    fs.mkdirSync(path.dirname(warnsPath), { recursive: true });
    fs.writeFileSync(warnsPath, JSON.stringify({}, null, 2), 'utf8');
  }
}

export function getWarns(guildId: string, userId: string): WarnEntry[] {
  ensureFile();
  const db: WarnDB = JSON.parse(fs.readFileSync(warnsPath, 'utf8'));
  return db[guildId]?.[userId] ?? [];
}

export function addWarn(guildId: string, userId: string, entry: WarnEntry): number {
  ensureFile();
  const raw = fs.readFileSync(warnsPath, 'utf8');
  const db: WarnDB = raw ? JSON.parse(raw) : {};

  if (!db[guildId]) db[guildId] = {} as any;
  if (!db[guildId][userId]) db[guildId][userId] = [];

  db[guildId][userId].push(entry);
  fs.writeFileSync(warnsPath, JSON.stringify(db, null, 2), 'utf8');

  return db[guildId][userId].length;
}
