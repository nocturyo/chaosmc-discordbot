export function getConfig() {
const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DEV_GUILD_ID } = process.env;
if (!DISCORD_TOKEN) throw new Error('Brak DISCORD_TOKEN w .env');
if (!DISCORD_CLIENT_ID) throw new Error('Brak DISCORD_CLIENT_ID w .env');
return { token: DISCORD_TOKEN, clientId: DISCORD_CLIENT_ID, devGuildId: DEV_GUILD_ID };
}