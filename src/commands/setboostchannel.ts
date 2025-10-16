import {
  SlashCommandBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setBoostChannelId } from '../utils/configManager';
import { prisma } from '../utils/database'; // ✅ DB

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
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('kanał', true);

    try {
      // Lokalny config (jeśli go używasz)
      setBoostChannelId(channel.id);

      // Zapis do bazy
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guildId! },
        update: { boostChannelId: channel.id },
        create: { guildId: interaction.guildId!, boostChannelId: channel.id },
      });

      await interaction.reply({
        content: `✅ Kanał **boostów** ustawiony na: <#${channel.id}>`,
        ephemeral: true,
      });

      console.log(`[CONFIG] boostChannelId dla ${interaction.guild.name}: ${channel.id}`);
    } catch (err) {
      console.error('❌ Błąd zapisu boostChannelId do bazy:', err);
      await interaction.reply({
        content: '❌ Nie udało się zapisać kanału boostów do bazy.',
        ephemeral: true,
      });
    }
  },
};

export default command;
