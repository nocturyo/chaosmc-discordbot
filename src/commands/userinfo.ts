import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  userMention,
  GuildMember,
  time,
} from 'discord.js';
import type { Command } from '../types/Command';
import { getWarns } from '../utils/warnManager';
import { getUserStats } from '../utils/modStats';

// Kolor embedu (weź z .env lub domyślny „Discord blurple”)
const EMBED_COLOR =
  (process.env.EMBED_COLOR
    ? process.env.EMBED_COLOR.startsWith('#')
      ? process.env.EMBED_COLOR
      : `#${process.env.EMBED_COLOR}`
    : '#5865F2') as `#${string}`;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Informacje moderacyjne o użytkowniku (warny, timeout, role itp.).')
    .addUserOption((opt) =>
      opt.setName('użytkownik').setDescription('Kogo sprawdzić?').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    const target = interaction.options.getUser('użytkownik', true);

    // Spróbuj pobrać członka (może być poza serwerem)
    let member: GuildMember | null = null;
    try {
      member = await interaction.guild.members.fetch(target.id);
    } catch {
      member = null;
    }

    // Warny z lokalnej bazy
    const warns = getWarns(interaction.guild.id, target.id);
    const warnsCount = warns.length;
    const lastWarns =
      warnsCount > 0
        ? warns
            .slice(-3)
            .map(
              (w) =>
                `• ${new Date(w.timestamp).toLocaleString()} — ${w.reason}`
            )
            .join('\n')
        : 'Brak';

    // Timeout – czy aktywny i ile zostało
    let timeoutField = 'Brak';
    if (member?.communicationDisabledUntilTimestamp) {
      const until = member.communicationDisabledUntilTimestamp;
      const now = Date.now();
      if (until > now) {
        const untilUnix = Math.floor(until / 1000);
        timeoutField = `Do: ${time(untilUnix, 'F')} (pozostało: ${time(untilUnix, 'R')})`;
      }
    }

    // Role (maks 10 nazw aby nie przeładować)
    const roles =
      member?.roles.cache
        .filter((r) => r.id !== interaction.guild!.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 10)
        .join(', ') || 'Brak / poza serwerem';

    // Lokalna historia (opcjonalna) – licznik banów/timeouts jeśli zaczniemy je zliczać
    const stats = getUserStats(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setAuthor({ name: `${target.tag}`, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL())
      .setTitle(`Informacje moderacyjne — ${target.username}`)
      .addFields(
        { name: 'Użytkownik', value: `${userMention(target.id)} (${target.id})`, inline: false },
        {
          name: 'Konto',
          value: `Utworzone: ${time(Math.floor(target.createdTimestamp / 1000), 'F')}`,
          inline: true,
        },
        {
          name: 'Serwer',
          value: member
            ? `Dołączył: ${time(Math.floor(member.joinedTimestamp! / 1000), 'F')}`
            : 'Poza serwerem',
          inline: true,
        },
        { name: 'Role', value: roles, inline: false },
        { name: 'Warny (łącznie)', value: String(warnsCount), inline: true },
        { name: 'Ostatnie warny', value: lastWarns, inline: false },
        { name: 'Timeout', value: timeoutField, inline: true },
        {
          name: 'Historia (lokalna)',
          value: `Bany: **${stats.bans}** • Timeouty: **${stats.timeouts}** • Warny: **${stats.warns}**`,
          inline: false,
        }
      )
      .setFooter({ text: `Zapytano przez: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
