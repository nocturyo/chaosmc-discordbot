import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setWelcomeChannelId } from '../utils/configManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Ustaw kanał, na który będą wysyłane grafiki powitalne.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('kanał')
        .setDescription('Kanał tekstowy na powitania')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const ch = interaction.options.getChannel('kanał', true);
    setWelcomeChannelId(ch.id);
    await interaction.reply({ content: `✅ Ustawiono kanał powitań na ${ch}.`, ephemeral: true });
  },
};

export default command;
