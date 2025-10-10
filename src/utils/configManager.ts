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

// --- WELCOME CHANNEL ---
export function getWelcomeChannelId(): string | null {
  const data = readFile();
  // @ts-ignore - pole może nie istnieć w starszym pliku
  return data.welcomeChannelId ?? null;
}
export function setWelcomeChannelId(id: string) {
  const data = readFile() as any;
  data.welcomeChannelId = id;
  writeFile(data);
}

// --- VERIFY CONFIG ---
export function getVerifyRoleId(): string | null {
  const data = readFile() as any;
  return data.verifyRoleId ?? null;
}
export function setVerifyRoleId(id: string) {
  const data = readFile() as any;
  data.verifyRoleId = id;
  writeFile(data);
}

export function getVerifyChannelId(): string | null {
  const data = readFile() as any;
  return data.verifyChannelId ?? null;
}
export function setVerifyChannelId(id: string) {
  const data = readFile() as any;
  data.verifyChannelId = id;
  writeFile(data);
}

// --- TICKETS ---
export function getTicketCategoryId(): string | null {
  const data = readFile() as any;
  return data.ticketCategoryId ?? null;
}
export function setTicketCategoryId(id: string) {
  const data = readFile() as any;
  data.ticketCategoryId = id;
  writeFile(data);
}

export function getTicketSupportRoleId(): string | null {
  const data = readFile() as any;
  return data.ticketSupportRoleId ?? null;
}
export function setTicketSupportRoleId(id: string) {
  const data = readFile() as any;
  data.ticketSupportRoleId = id;
  writeFile(data);
}

export function nextTicketCounter(): number {
  const data = readFile() as any;
  if (typeof data.ticketCounter !== 'number') data.ticketCounter = 0;
  data.ticketCounter += 1;
  writeFile(data);
  return data.ticketCounter;
}
