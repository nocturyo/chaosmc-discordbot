// scripts/clear-guild-commands.ts
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getConfig } from '../src/config';

(async () => {
  const { token, clientId, devGuildId } = getConfig();
  if (!token || !clientId || !devGuildId) {
    throw new Error('Brak token/clientId/devGuildId (ustaw w .env / configu)');
  }

  const rest = new REST({ version: '10' }).setToken(token);

  // Pusta tablica = skasuj wszystkie komendy na dev-guild
  await rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body: [] });

  console.log(`✅ Wyczyszczono WSZYSTKIE komendy na dev guild: ${devGuildId}`);
})();
