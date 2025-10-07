import fs from 'fs';
import path from 'path';

const statsPath = path.join(__dirname, '../data/modstats.json');

type ModCounters = {
  bans?: number;
  timeouts?: number;
  warns?: number;
};

type DB = {
  [guildId: string]: {
    [userId: string]: ModCounters;
  };
};

function ensureFile() {
  if (!fs.existsSync(statsPath)) {
    fs.mkdirSync(path.dirname(statsPath), { recursive: true });
    fs.writeFileSync(statsPath, JSON.stringify({}, null, 2), 'utf8');
  }
}

export function getUserStats(guildId: string, userId: string): Required<ModCounters> {
  ensureFile();
  const db: DB = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  const s = db[guildId]?.[userId] ?? {};
  return {
    bans: s.bans ?? 0,
    timeouts: s.timeouts ?? 0,
    warns: s.warns ?? 0,
  };
}

// poniższe funkcje są OPCJONALNE — jeśli chcesz liczyć automatycznie:
export function incStat(guildId: string, userId: string, key: keyof Required<ModCounters>) {
  ensureFile();
  const db: DB = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  if (!db[guildId]) db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = {};
  (db[guildId][userId][key] as number | undefined) = (db[guildId][userId][key] ?? 0) + 1;
  fs.writeFileSync(statsPath, JSON.stringify(db, null, 2), 'utf8');
}
