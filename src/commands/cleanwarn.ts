import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  userMention,
} from 'discord.js';
import type { Command } from '../types/Command';
import { sendLogEmbed } from '../utils/logSender';
import { prisma } from '../utils/database'; // ✅ DB

// Kolor embedu z .env (np. EMBED_COLOR=#98039b). Obsługa bez/za '#'.
const EMBED_COLOR =
  (process.env.EMBED_COLOR
    ? process.env.EMBED_COLOR.startsWith('#')
      ? process.env.EMBED_COLOR
      : `#${process.env.EMBED_COLOR}`
    : '#F59E0B') as `#${string}`;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('cleanwarn')
    .setDescription('Usuń określoną liczbę ostatnich ostrzeżeń użytkownika.')
    .addUserOption((opt) =>
      opt.setName('użytkownik').setDescription('Kogo edytujesz?').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('ilość')
        .setDescription('Ile ostatnich ostrzeżeń usunąć')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(50)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Ta komenda działa tylko na serwerze.',
        ephemeral: true,
      });
      return;
    }

    const user = interaction.options.getUser('użytkownik', true);
    const amount = interaction.options.getInteger('ilość', true);

    // policz aktualne ostrzeżenia w DB
    let before = 0;
    try {
      before = await prisma.warning.count({
        where: { guildId: interaction.guild.id, userId: user.id },
      });
    } catch (err) {
      console.error('❌ Błąd podczas zliczania ostrzeżeń:', err);
      await interaction.reply({
        content: '❌ Wystąpił błąd bazy podczas sprawdzania ostrzeżeń.',
        ephemeral: true,
      });
      return;
    }

    if (before === 0) {
      await interaction.reply({
        content: `${userMention(user.id)} nie ma żadnych ostrzeżeń.`,
        ephemeral: true,
      });
      return;
    }

    // pobierz N ostatnich warnów (po dacie malejąco) i usuń je
    let removedEntries:
      { id: number; reason: string; createdAt: Date }[] = [];
    let removed = 0;
    let remaining = before;

    try {
      removedEntries = await prisma.warning.findMany({
        where: { guildId: interaction.guild.id, userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: amount,
        select: { id: true, reason: true, createdAt: true },
      });

      if (removedEntries.length > 0) {
        const ids = removedEntries.map((w) => w.id);
        const del = await prisma.warning.deleteMany({
          where: { id: { in: ids } },
        });
        removed = del.count;
        remaining = Math.max(before - removed, 0);
      }
    } catch (err) {
      console.error('❌ Błąd podczas usuwania ostrzeżeń:', err);
      await interaction.reply({
        content: '❌ Wystąpił błąd bazy podczas usuwania ostrzeżeń.',
        ephemeral: true,
      });
      return;
    }

    const reply = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('🧹 Czyszczenie ostrzeżeń')
      .setDescription(`${userMention(user.id)} — usunięto **${removed}** ostrzeżenie(a).`)
      .addFields(
        { name: 'Przed', value: String(before), inline: true },
        { name: 'Po', value: String(remaining), inline: true }
      )
      .setFooter({ text: `Akcja: ${interaction.user.tag}` })
      .setTimestamp();

    if (removedEntries.length > 0) {
      const reasons = removedEntries
        .slice(0, 3) // pokazujemy max 3 ostatnio usunięte
        .map(
          (w) => `• ${new Date(w.createdAt).toLocaleString()} — ${w.reason}`
        )
        .join('\n');
      reply.addFields({ name: 'Usunięte (ostatnie)', value: reasons });
    }

    await interaction.reply({ embeds: [reply], ephemeral: true });

    // Log do kanału logów
    const log = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('🧹 Czyszczenie ostrzeżeń')
      .setDescription(
        `Moderator: ${userMention(interaction.user.id)}\n` +
        `Użytkownik: ${userMention(user.id)}`
      )
      .addFields(
        { name: 'Usunięto', value: String(removed), inline: true },
        { name: 'Przed', value: String(before), inline: true },
        { name: 'Po', value: String(remaining), inline: true }
      )
      .setTimestamp();

    await sendLogEmbed(interaction.client, interaction.guild.id, log);
  },
};

export default command;
