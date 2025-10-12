import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  TextChannel,
  userMention,
} from 'discord.js';
import type { Command } from '../types/Command';
import { sendLogEmbed } from '../utils/logSender';

// Kolor embedu – fioletowy (pasujący do CHAOSMC.ZONE)
const EMBED_COLOR = 0x5865f2;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Usuwa określoną liczbę wiadomości z kanału.')
    .addIntegerOption((opt) =>
      opt
        .setName('ilość')
        .setDescription('Liczba wiadomości do usunięcia (1–100).')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName('użytkownik')
        .setDescription('Usuń wiadomości tylko od określonego użytkownika.')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze.',
        ephemeral: true,
      });
      return;
    }

    const amount = interaction.options.getInteger('ilość', true);
    const targetUser = interaction.options.getUser('użytkownik');
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      // pobierz wiadomości
      const messages = await channel.messages.fetch({ limit: 100 });
      const filtered = targetUser
        ? messages.filter((m) => m.author.id === targetUser.id).first(amount)
        : messages.first(amount);

      if (!filtered || filtered.length === 0) {
        await interaction.editReply({
          content: '⚠️ Nie znaleziono wiadomości do usunięcia.',
        });
        return;
      }

      // usuń wiadomości
      await channel.bulkDelete(filtered, true);

      // embed potwierdzający
      const confirmEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('🧹 Wiadomości usunięte')
        .setDescription(
          targetUser
            ? `Usunięto **${filtered.length}** wiadomości użytkownika ${userMention(
                targetUser.id
              )} z kanału ${channel}.`
            : `Usunięto **${filtered.length}** wiadomości z kanału ${channel}.`
        )
        .setFooter({ text: `Akcja: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [confirmEmbed] });

      // embed logów
      const logEmbed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle('🧹 Czyszczenie kanału')
        .addFields(
          { name: 'Moderator', value: userMention(interaction.user.id), inline: true },
          { name: 'Kanał', value: `${channel}`, inline: true },
          { name: 'Ilość wiadomości', value: `${filtered.length}`, inline: true },
          ...(targetUser
            ? [{ name: 'Użytkownik docelowy', value: userMention(targetUser.id), inline: true }]
            : []),
          { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp();

      await sendLogEmbed(interaction.client, interaction.guild.id, logEmbed);
    } catch (err) {
      await interaction.editReply({
        content: `❌ Wystąpił błąd podczas czyszczenia wiadomości: ${String(err)}`,
      });
    }
  },
};

export default command;
