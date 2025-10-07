import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../types/Command';
import { getConfig } from '../config';
import { status } from 'minecraft-server-util';

// Kolor dla /mcstatus – ładny cyjan
const EMBED_COLOR = 0x22d3ee; // #22D3EE

const config = getConfig();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mcstatus')
    .setDescription('Pokaż status serwera Minecraft (online/offline, gracze, wersja).')
    .addStringOption((opt) =>
      opt
        .setName('host')
        .setDescription('Host serwera (domyślnie z .env)')
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('port')
        .setDescription('Port serwera (domyślnie z .env)')
        .setRequired(false)
    )
    // Komenda może być publiczna dla wszystkich — nie ustawiamy limitu uprawnień
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: false });

    const host = interaction.options.getString('host') ?? config.mcHost;
    const port = interaction.options.getInteger('port') ?? config.mcPort;

    // Najpierw spróbujmy pobrać status
    try {
      const res = await status(host, port, { timeout: 5_000 });

      const online = res.players?.online ?? 0;
      const max = res.players?.max ?? 0;

      const motd =
        (res.motd as any)?.clean ??
        (typeof res.motd === 'string' ? res.motd : '—');

      // lista kilku graczy, jeśli serwer ją zwraca
      const playerList =
        (res.players as any)?.sample && Array.isArray((res.players as any).sample)
          ? (res.players as any).sample
              .slice(0, 10)
              .map((p: any) => `• ${p.name ?? p.id ?? 'Gracz'}`)
              .join('\n')
          : (online > 0 ? '— (brak listy od serwera)' : '—');

      const version =
        (res.version as any)?.name ??
        (typeof res.version === 'string' ? res.version : '—');

      const favicon = (res as any)?.favicon || null; // nie zawsze dostępne

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('🟢 Serwer ONLINE')
        .setDescription(motd || '—')
        .addFields(
          { name: 'Adres', value: `\`${host}:${port}\``, inline: true },
          { name: 'Gracze', value: `${online}/${max}`, inline: true },
          { name: 'Wersja', value: String(version), inline: true },
          { name: 'Lista graczy', value: playerList, inline: false },
        )
        .setTimestamp();

      if (favicon) {
        // Uwaga: Discord oczekuje URL; data-uri działa, ale może być obcięte. Jeśli nie chcesz miniatury, pomiń.
        embed.setThumbnail(favicon);
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      // Offline / timeout / błąd połączenia
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('🔴 Serwer OFFLINE')
        .setDescription('Nie udało się połączyć z serwerem lub nie odpowiada.')
        .addFields({ name: 'Adres', value: `\`${host}:${port}\``, inline: true })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
