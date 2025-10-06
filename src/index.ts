import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Collection, ActivityType } from 'discord.js';
import type { Command } from './types/Command';
import { commands as commandList } from './commands';
import { getConfig } from './config';
import { status } from 'minecraft-server-util';

/**
 * Bierzemy config z getConfig(), ale dodajemy FALBACKI na wypadek
 * starszej wersji config.ts — wtedy czytamy bezpośrednio z .env.
 */
const raw = getConfig() as any;

const MC_SERVER = (process.env.MC_SERVER ?? '').trim();
const parsedFromServer = MC_SERVER && MC_SERVER.includes(':') ? MC_SERVER.split(':') : [];

const mcHost: string =
  raw.mcHost ??
  process.env.MC_HOST ??
  (parsedFromServer[0] || 'localhost');

const mcPort: number = Number(
  raw.mcPort ??
    process.env.MC_PORT ??
    (parsedFromServer[1] || 25565)
);

const statusIntervalMs: number = Number(
  raw.statusIntervalMs ?? process.env.STATUS_INTERVAL_MS ?? 30_000
);

const token: string = raw.token ?? process.env.DISCORD_TOKEN!;
if (!token) {
  throw new Error('Brak DISCORD_TOKEN w .env');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Rejestrujemy komendy z naszej architektury
const commands = new Collection<string, Command>();
for (const cmd of commandList) commands.set(cmd.data.name, cmd);

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Zalogowano jako ${c.user.tag}`);
  await updateBotStatus();
  setInterval(() => {
    updateBotStatus().catch((err) => console.error('Błąd przy aktualizacji statusu:', err));
  }, statusIntervalMs);
});

/** Aktualizacja statusu Discord co interwał */
async function updateBotStatus() {
  try {
    const res = await status(mcHost, mcPort, { timeout: 5_000 });

    const online = res.players?.online ?? 0;
    const max = res.players?.max ?? 0;

    const text = `${online}/${max} graczy`;

    await client.user?.setPresence({
      activities: [{ name: text, type: ActivityType.Watching }],
      status: 'online', // zawsze zielony
    });

    console.log(`📊 [${mcHost}:${mcPort}] ${text}`);
  } catch (err) {
    // serwer nieosiągalny / timeout
    const text = 'Serwer offline';

    await client.user?.setPresence({
      activities: [{ name: text, type: ActivityType.Watching }],
      status: 'online', // zawsze zielony, nawet offline
    });

    console.error(`⚠️  [${mcHost}:${mcPort}] Serwer offline:`, err);
  }
}

// Obsługa komend slash
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
      await interaction.reply({ content: 'Wystąpił błąd podczas wykonania komendy.', ephemeral: true });
    }
  }
});

// Logowanie bota
client.login(token);
