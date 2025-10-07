import {
  SlashCommandBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setBoostChannelId } from '../utils/configManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setboostchannel')
    .setDescription('Ustaw kanał, na który bot będzie wysyłał powiadomienia o boostach.')
    .addChannelOption(opt =>
      opt
        .setName('kanał')
        .setDescription('Wybierz kanał powiadomień o boostach')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('kanał', true);
    setBoostChannelId(channel.id);

    await interaction.reply({
      content: `✅ Kanał **boostów** ustawiony na: <#${channel.id}>`,
      ephemeral: true,
    });
  },
};

export default command;
