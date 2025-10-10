import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import type { Command } from '../types/Command';

const colorMap: Record<string, number> = {
  blue: 0x3498db,
  green: 0x2ecc71,
  red: 0xe74c3c,
  purple: 0x9b59b6,
  yellow: 0xf1c40f,
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Wysyła ładnego embeda na wybrany kanał.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Kanał, na który wysłać wiadomość.')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('title')
        .setDescription('Tytuł wiadomości')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Treść wiadomości')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('color')
        .setDescription('Kolor embedu (blue, green, red, purple, yellow)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const colorInput = interaction.options.getString('color')?.toLowerCase();

    if (!channel || channel.type !== 0) {
      await interaction.reply({
        content: '❌ Wybierz kanał tekstowy.',
        ephemeral: true,
      });
      return;
    }

    const color = colorMap[colorInput || 'blue'] || 0x3498db;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({
        text: `Wysłano przez ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    try {
      await (channel as TextChannel).send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Wiadomość została wysłana na ${channel}.`,
        ephemeral: true,
      });
    } catch (err) {
      console.error('❌ Błąd przy wysyłaniu embedu:', err);
      await interaction.reply({
        content: '❌ Nie udało się wysłać wiadomości.',
        ephemeral: true,
      });
    }
  },
};

export default command;
