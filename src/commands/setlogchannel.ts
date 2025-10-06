import { SlashCommandBuilder, ChannelType, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { setLogChannelId } from '../utils/configManager';
import type { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Ustaw kanał, na który będą wysyłane logi bota.')
    .addChannelOption(option =>
      option
        .setName('kanał')
        .setDescription('Wybierz kanał logów')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.getChannel('kanał');
    if (!channel) {
      await interaction.reply({ content: 'Nie wybrano kanału!', ephemeral: true });
      return;
    }

    setLogChannelId(channel.id);

    await interaction.reply({
      content: `✅ Kanał logów został ustawiony na: <#${channel.id}>`,
      ephemeral: true,
    });
  },
};

export default command;
