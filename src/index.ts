import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Collection, ActivityType } from 'discord.js';
import type { Command } from './types/Command';
import { commands as commandList } from './commands';
import { getConfig } from './config';

const config = getConfig();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = new Collection<string, Command>();
for (const cmd of commandList) commands.set(cmd.data.name, cmd);

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Zalogowano jako ${c.user.tag}`);

  // Ustawiamy prosty status "Ogląda CHAOSMC.ZONE"
  client.user?.setPresence({
    activities: [{ name: 'CHAOSMC.ZONE', type: ActivityType.Playing }],
    status: 'online',
  });

  console.log('📡 Status ustawiony: Ogląda CHAOSMC.ZONE');
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: 'Nieznana komenda.', ephemeral: true });
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
