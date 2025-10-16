import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setWelcomeChannelId } from '../utils/configManager';
import { prisma } from '../utils/database'; // ✅ import Prisma

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

    try {
      // 🔹 Zapis lokalny (jeśli używasz configManager)
      setWelcomeChannelId(ch.id);

      // 🔹 Zapis do bazy danych (lub utworzenie wpisu, jeśli nie istnieje)
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guildId! },
        update: { welcomeChannelId: ch.id },
        create: { guildId: interaction.guildId!, welcomeChannelId: ch.id },
      });

      await interaction.reply({
        content: `✅ Ustawiono kanał powitań na ${ch}.`,
        ephemeral: true,
      });

      console.log(`[CONFIG] Kanał powitań ustawiony dla ${interaction.guild?.name}: ${ch.id}`);
    } catch (err) {
      console.error('❌ Błąd podczas zapisywania kanału powitań:', err);
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas zapisywania kanału powitań do bazy.',
        ephemeral: true,
      });
    }
  },
};

export default command;
