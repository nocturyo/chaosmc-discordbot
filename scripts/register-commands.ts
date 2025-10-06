import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from '../src/commands';
import { getConfig } from '../src/config';


async function main() {
const mode = process.argv[2] ?? 'dev';
const config = getConfig();
const rest = new REST({ version: '10' }).setToken(config.token);
const body = commands.map((c) => c.data.toJSON());


if (mode === 'global') {
await rest.put(Routes.applicationCommands(config.clientId), { body });
console.log('🌍 Zarejestrowano komendy globalne.');
} else {
if (!config.devGuildId) {
throw new Error('Brak DEV_GUILD_ID w .env dla rejestracji komend gildyjnych.');
}
await rest.put(Routes.applicationGuildCommands(config.clientId, config.devGuildId), { body });
console.log('🧪 Zarejestrowano komendy na serwerze developerskim.');
}
}


main().catch((e) => {
console.error(e);
process.exit(1);
});