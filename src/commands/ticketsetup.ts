import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setTicketCategoryId, setTicketSupportRoleId } from '../utils/configManager';
import { prisma } from '../utils/database'; // ✅ DB

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Ustaw kategorię i rolę wsparcia dla systemu ticketów.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('kategoria')
        .setDescription('Kategoria, w której będą tworzyć się tickety.')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt
        .setName('rola')
        .setDescription('Rola wsparcia (ma dostęp do ticketów).')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    const cat = interaction.options.getChannel('kategoria', true);
    const role = interaction.options.getRole('rola', true);

    try {
      // 🔹 lokalny fallback (jeśli korzystasz z configManager)
      setTicketCategoryId(cat.id);
      setTicketSupportRoleId(role.id);

      // 🔹 zapis w bazie (utwórz lub zaktualizuj rekord serwera)
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guildId! },
        update: { ticketCategoryId: cat.id, ticketSupportRoleId: role.id },
        create: { guildId: interaction.guildId!, ticketCategoryId: cat.id, ticketSupportRoleId: role.id },
      });

      await interaction.reply({
        ephemeral: true,
        content: `✅ Zapisano ustawienia ticketów.\n• Kategoria: ${cat}\n• Rola wsparcia: <@&${role.id}>`,
      });
    } catch (err) {
      console.error('❌ Błąd zapisu ustawień ticketów do bazy:', err);
      await interaction.reply({
        ephemeral: true,
        content: '❌ Nie udało się zapisać ustawień ticketów do bazy.',
      });
    }
  },
};

export default command;
