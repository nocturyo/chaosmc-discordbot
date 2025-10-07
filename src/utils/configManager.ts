import fs from 'fs';
import path from 'path';

const configPath = path.join(__dirname, '../data/config.json');

type FileShape = {
  logChannelId?: string | null;
  boostChannelId?: string | null;
};

function readFile(): FileShape {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function writeFile(data: FileShape) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
}

export function getLogChannelId(): string | null {
  const data = readFile();
  return data.logChannelId ?? null;
}
export function setLogChannelId(channelId: string): void {
  const data = readFile();
  data.logChannelId = channelId;
  writeFile(data);
}

// ⬇️ NOWE: kanał boostów
export function getBoostChannelId(): string | null {
  const data = readFile();
  return data.boostChannelId ?? null;
}
export function setBoostChannelId(channelId: string): void {
  const data = readFile();
  data.boostChannelId = channelId;
  writeFile(data);
}

export function getMcBanChannelId(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return data.mcBanChannelId ?? null;
  } catch {
    return null;
  }
}

export function setMcBanChannelId(channelId: string): void {
  let data: any = {};
  try { data = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  data.mcBanChannelId = channelId;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
}
