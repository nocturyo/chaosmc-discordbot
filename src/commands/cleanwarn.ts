import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  userMention,
} from 'discord.js';
import type { Command } from '../types/Command';
import { getWarns, removeWarns } from '../utils/warnManager';
import { sendLogEmbed } from '../utils/logSender';

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
    .setDescription('Usuń określoną liczbę ostrzeżeń użytkownika (np. 1 z 3).')
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
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('użytkownik', true);
    const amount = interaction.options.getInteger('ilość', true);

    const before = getWarns(interaction.guild.id, user.id).length;

    if (before === 0) {
      await interaction.reply({
        content: `${userMention(user.id)} nie ma żadnych ostrzeżeń.`,
        ephemeral: true,
      });
      return;
    }

    const { removed, remaining, removedEntries } = removeWarns(
      interaction.guild.id,
      user.id,
      amount
    );

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
        .slice(-3)
        .map((w) => `• ${new Date(w.timestamp).toLocaleString()} — ${w.reason}`)
        .join('\n');
      reply.addFields({ name: 'Usunięte (ostatnie)', value: reasons });
    }

    await interaction.reply({ embeds: [reply], ephemeral: true });

    // Log do kanału logów
    const log = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('🧹 Czyszczenie ostrzeżeń')
      .setDescription(`Moderator: ${userMention(interaction.user.id)}\nUżytkownik: ${userMention(user.id)}`)
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
