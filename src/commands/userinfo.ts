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
import { prisma } from '../utils/database'; // ✅ DB

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

    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('użytkownik', true);

    // Spróbuj pobrać członka (może być poza serwerem)
    let member: GuildMember | null = null;
    try {
      member = await interaction.guild.members.fetch(target.id);
    } catch {
      member = null;
    }

    // ✅ Dane moderacyjne z bazy
    let warnsCount = 0;
    let lastWarnsText = 'Brak';
    let bansCount = 0;
    let timeoutsCount = 0;

    try {
      const [warnsTotal, lastWarns, bansTotal, timeoutsTotal] = await Promise.all([
        prisma.warning.count({
          where: { guildId: interaction.guild.id, userId: target.id },
        }),
        prisma.warning.findMany({
          where: { guildId: interaction.guild.id, userId: target.id },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { createdAt: true, reason: true },
        }),
        prisma.banLog.count({
          where: { guildId: interaction.guild.id, userId: target.id },
        }),
        prisma.timeoutLog.count({
          where: { guildId: interaction.guild.id, userId: target.id },
        }),
      ]);

      warnsCount = warnsTotal;

      if (lastWarns.length > 0) {
        lastWarnsText = lastWarns
          .map((w) => {
            const unix = Math.floor(w.createdAt.getTime() / 1000);
            return `• ${time(unix, 'F')} — ${w.reason}`;
          })
          .join('\n');
      }

      bansCount = bansTotal;
      timeoutsCount = timeoutsTotal;
    } catch (err) {
      console.error('❌ Błąd pobierania danych z bazy w /userinfo:', err);
      // Nie przerywamy — pokażemy to, co mamy (np. role/timeout live).
    }

    // Timeout – czy aktywny i ile zostało (live z Discorda)
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
          value: member?.joinedTimestamp
            ? `Dołączył: ${time(Math.floor(member.joinedTimestamp / 1000), 'F')}`
            : 'Poza serwerem',
          inline: true,
        },
        { name: 'Role', value: roles, inline: false },
        { name: 'Warny (łącznie)', value: String(warnsCount), inline: true },
        { name: 'Ostatnie warny', value: lastWarnsText, inline: false },
        { name: 'Timeout (aktywny)', value: timeoutField, inline: true },
        {
          name: 'Historia (z bazy)',
          value: `Bany: **${bansCount}** • Timeouty: **${timeoutsCount}** • Warny: **${warnsCount}**`,
          inline: false,
        }
      )
      .setFooter({ text: `Zapytano przez: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
