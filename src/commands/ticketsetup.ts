import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setTicketCategoryId, setTicketSupportRoleId } from '../utils/configManager';

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
    const cat = interaction.options.getChannel('kategoria', true);
    const role = interaction.options.getRole('rola', true);

    setTicketCategoryId(cat.id);
    setTicketSupportRoleId(role.id);

    await interaction.reply({
      ephemeral: true,
      content: `✅ Zapisano ustawienia ticketów.\n• Kategoria: ${cat}\n• Rola wsparcia: <@&${role.id}>`,
    });
  },
};

export default command;
