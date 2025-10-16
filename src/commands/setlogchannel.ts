import {
  SlashCommandBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../types/Command';
import { prisma } from '../utils/database';
import { setLogChannelId } from '../utils/configManager';

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
      await interaction.reply({
        content: '❌ Nie wybrano kanału!',
        ephemeral: true,
      });
      return;
    }

    try {
      // 🔹 Zapis do lokalnej konfiguracji (jeśli używasz configManager)
      setLogChannelId(channel.id);

      // 🔹 Zapis do bazy danych
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guildId! },
        update: { logChannelId: channel.id },
        create: { guildId: interaction.guildId!, logChannelId: channel.id },
      });

      await interaction.reply({
        content: `✅ Kanał logów został ustawiony na: <#${channel.id}>`,
        ephemeral: true,
      });

      console.log(
        `[LOG] Kanał logów dla ${interaction.guild?.name} ustawiony na ${channel.id}`
      );
    } catch (err) {
      console.error('❌ Błąd podczas zapisywania kanału logów:', err);
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas zapisywania kanału logów do bazy.',
        ephemeral: true,
      });
    }
  },
};

export default command;
