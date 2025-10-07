import dotenv from 'dotenv';
dotenv.config();

export interface BotConfig {
  token: string;
  clientId: string;
  devGuildId?: string;
  mcHost: string;
  mcPort: number;
  embedColor: string;
  statusIntervalMs: number;
}

export function getConfig(): BotConfig {
  const {
    DISCORD_TOKEN,
    DISCORD_CLIENT_ID,
    DEV_GUILD_ID,
    MC_HOST,
    MC_PORT,
    EMBED_COLOR,
    STATUS_INTERVAL,
  } = process.env;

  // --- Walidacja najważniejszych zmiennych ---
  if (!DISCORD_TOKEN) throw new Error('❌ Brak DISCORD_TOKEN w pliku .env');
  if (!DISCORD_CLIENT_ID) throw new Error('❌ Brak DISCORD_CLIENT_ID w pliku .env');

  return {
    token: DISCORD_TOKEN,
    clientId: DISCORD_CLIENT_ID,
    devGuildId: DEV_GUILD_ID,
    mcHost: MC_HOST || 'localhost',
    mcPort: parseInt(MC_PORT || '25565', 10),
    embedColor: EMBED_COLOR || '#F59E0B', // domyślny kolor (bursztyn)
    statusIntervalMs: parseInt(STATUS_INTERVAL || '60000', 10), // odświeżanie statusu co 60s
  };
}
