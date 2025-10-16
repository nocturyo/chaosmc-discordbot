import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  ActivityType,
} from 'discord.js';
import type { Command } from './types/Command';
import { commands as commandList } from './commands';
import { getConfig } from './config';
import { setupBoostListener } from './events/boostListener';
import { setupWelcomeListener } from './events/welcomeListener';
import { setupVerifyListener } from './events/verifyListener';
import { setupTicketListener } from './events/ticketListener';
import { connectDatabase } from "./utils/database"; // ✅ import połączenia z bazą


const config = getConfig();

// ❗ Dodajemy GuildMembers, żeby wykrywać boosty (GuildMemberUpdate)
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ✅ Połącz z bazą danych przed uruchomieniem klienta Discord
(async () => {
  await connectDatabase();
})();

setupWelcomeListener(client);
setupVerifyListener(client);
setupTicketListener(client);

const commands = new Collection<string, Command>();
for (const cmd of commandList) commands.set(cmd.data.name, cmd);

const port = parseInt(process.env.MC_WEBHOOK_PORT || '3040', 10);

// Rejestrujemy listener boostów (przed loginem)
setupBoostListener(client);

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Zalogowano jako ${c.user.tag}`);

  // Status: "Ogląda CHAOSMC.ZONE" (Watching)
  client.user?.setPresence({
    activities: [{ name: 'CHAOSMC.ZONE', type: ActivityType.Watching }],
    status: 'online',
  });

  console.log('📡 Status ustawiony: Ogląda CHAOSMC.ZONE');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({ content: 'Nieznana komenda.', ephemeral: true });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error('❌ Błąd podczas wykonania komendy:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('Wystąpił błąd podczas wykonania komendy.');
    } else {
      await interaction.reply({
        content: 'Wystąpił błąd podczas wykonania komendy.',
        ephemeral: true,
      });
    }
  }
});

client.login(config.token);
