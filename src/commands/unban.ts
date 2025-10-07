import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  userMention,
} from 'discord.js';
import type { Command } from '../types/Command';
import { sendLogEmbed } from '../utils/logSender';

// Kolor embedu z .env (np. EMBED_COLOR=#98039b)
const EMBED_COLOR = 0x22c55e;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Odbanuj użytkownika po jego ID.')
    .addStringOption((opt) =>
      opt
        .setName('id')
        .setDescription('ID użytkownika, którego chcesz odbanować')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('powód').setDescription('Powód odbanowania').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString('id', true);
    const reason = interaction.options.getString('powód') ?? 'Brak powodu';

    // Sprawdź, czy bot ma permisję
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.editReply('❌ Nie mam uprawnienia **Ban Members** na tym serwerze.');
      return;
    }

    // Spróbuj pobrać informacje o banie
    let banInfo;
    try {
      banInfo = await interaction.guild.bans.fetch(userId);
    } catch {
      banInfo = null;
    }

    if (!banInfo) {
      await interaction.editReply(`⚠️ Użytkownik o ID \`${userId}\` nie jest obecnie zbanowany.`);
      return;
    }

    // Wykonaj unban
    try {
      await interaction.guild.bans.remove(userId, `${reason} | Moderator: ${interaction.user.tag}`);
    } catch (err) {
      await interaction.editReply(`❌ Nie udało się odbanować użytkownika: ${String(err)}`);
      return;
    }

    // Potwierdzenie dla moderatora (ephemeral)
    const replyEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('✅ Użytkownik odbanowany')
      .setDescription(`Użytkownik ${userMention(userId)} został odbanowany.`)
      .addFields({ name: 'Powód', value: reason, inline: false })
      .setFooter({ text: `Akcja: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });

    // Log do kanału logów
    const logEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('🔓 UNBAN')
      .setDescription(
        `**Użytkownik:** ${userMention(userId)}\n` +
          `**Moderator:** ${userMention(interaction.user.id)}\n` +
          `**Powód:** ${reason}`
      )
      .addFields(
        { name: 'ID Użytkownika', value: userId, inline: true },
        { name: 'ID Moderatora', value: interaction.user.id, inline: true },
        { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
      )
      .setTimestamp();

    await sendLogEmbed(interaction.client, interaction.guild.id, logEmbed);
  },
};

export default command;
