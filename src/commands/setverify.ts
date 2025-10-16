import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import type { Command } from '../types/Command';
import { setVerifyRoleId, setVerifyChannelId } from '../utils/configManager';
import { prisma } from '../utils/database'; // ✅ DB

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setverify')
    .setDescription('Ustaw kanał i rolę do weryfikacji oraz opublikuj panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt.setName('kanał')
        .setDescription('Kanał, na którym ma stać panel weryfikacji')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName('rola')
        .setDescription('Rola nadawana po weryfikacji')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('kanał', true);
    const role = interaction.options.getRole('rola', true);

    try {
      // 🔹 lokalny config (jeśli używasz)
      setVerifyChannelId(channel.id);
      setVerifyRoleId(role.id);

      // 🔹 zapis w bazie
      await prisma.guildConfig.upsert({
        where: { guildId: interaction.guildId! },
        update: { verifyChannelId: channel.id, verifyRoleId: role.id },
        create: { guildId: interaction.guildId!, verifyChannelId: channel.id, verifyRoleId: role.id },
      });

      await interaction.reply({
        content: `✅ Zapisano ustawienia weryfikacji.\n• Kanał: ${channel}\n• Rola: <@&${role.id}>`,
        ephemeral: true,
      });
    } catch (e) {
      console.error('❌ Błąd zapisu ustawień weryfikacji do bazy:', e);
      await interaction.reply({
        content: '❌ Nie udało się zapisać ustawień weryfikacji do bazy.',
        ephemeral: true,
      });
      return;
    }

    // wyślij panel weryfikacji
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('Weryfikacja')
      .setDescription(
        'Kliknij przycisk poniżej, aby się zweryfikować.\n' +
        'Po pomyślnej weryfikacji otrzymasz dostęp do serwera.'
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('chaosmc_verify')
        .setStyle(ButtonStyle.Success)
        .setLabel('Zweryfikuj się ✅')
    );

    try {
      await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    } catch (e) {
      console.error('❌ Nie udało się wysłać panelu weryfikacji:', e);
      // Nie przerywamy — ustawienia są już zapisane.
    }
  },
};

export default command;
