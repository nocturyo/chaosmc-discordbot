import fs from 'fs';
import path from 'path';

const configPath = path.join(__dirname, '../data/config.json');

export function getLogChannelId(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return data.logChannelId || null;
  } catch {
    return null;
  }
}

export function setLogChannelId(channelId: string): void {
  const data = { logChannelId: channelId };
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
}
