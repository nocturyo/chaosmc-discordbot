import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  userMention,
  GuildMember,
} from 'discord.js';
import type { Command } from '../types/Command';
import { sendLogEmbed } from '../utils/logSender';
import { incStat } from '../utils/modStats';
import { prisma } from '../utils/database'; // ✅ DB

// Kolor embedu dla banów — czerwony (liczba, nie string z '#')
const EMBED_COLOR = 0xdc2626; // #DC2626

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Zbanuj użytkownika z opcjonalnym powodem.')
    .addUserOption((opt) =>
      opt.setName('użytkownik').setDescription('Kogo banować?').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('powód').setDescription('Powód bana').setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('usuń_wiadomości_dni')
        .setDescription('Ile dni wiadomości usunąć (0–7, domyślnie 0)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('użytkownik', true);
    const reason = interaction.options.getString('powód') ?? 'Brak powodu';
    const deleteDays = interaction.options.getInteger('usuń_wiadomości_dni') ?? 0;
    const deleteMessageSeconds = Math.max(0, Math.min(7, deleteDays)) * 24 * 60 * 60;

    let targetMember: GuildMember | null = null;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      targetMember = null;
    }

    // uprawnienia bota
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.editReply('❌ Nie mam uprawnienia **Ban Members** na tym serwerze.');
      return;
    }

    const me = await interaction.guild.members.fetchMe();

    if (targetUser.id === interaction.user.id) {
      await interaction.editReply('❌ Nie możesz zbanować samego siebie.');
      return;
    }
    if (targetUser.id === me.id) {
      await interaction.editReply('❌ Nie możesz zbanować bota.');
      return;
    }

    if (targetMember) {
      if (!targetMember.bannable) {
        await interaction.editReply('❌ Nie mogę zbanować tego użytkownika (brak uprawnień lub zbyt wysoka ranga).');
        return;
      }
      const modMember = await interaction.guild.members.fetch(interaction.user.id);
      if (
        modMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0 &&
        interaction.guild.ownerId !== modMember.id
      ) {
        await interaction.editReply('❌ Ten użytkownik ma równą lub wyższą rolę niż Twoja.');
        return;
      }
    }

    // przyjazna nazwa moderatora (nick lub tag)
    const moderatorDisplay =
      (interaction.member && 'nickname' in interaction.member && (interaction.member as any).nickname)
        ? (interaction.member as any).nickname
        : interaction.user.displayName ?? interaction.user.tag;

    // DM do banowanego
    const dmEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('🚫 Zostałeś zbanowany')
      .setDescription(
        `Z serwera **${interaction.guild.name}** otrzymałeś bana.\n\n` +
          `**Moderator:** ${moderatorDisplay}\n` +
          `**Powód:** ${reason}\n\n` +
          `Jeśli uważasz, że ban jest **niesłuszny**, skontaktuj się z administracją ` +
          `poprzez kanał pomocy lub system ticketów (jeśli jest dostępny).`
      )
      .setTimestamp();

    let dmOk = true;
    try {
      await targetUser.send({ embeds: [dmEmbed] });
    } catch {
      dmOk = false;
    }

    // wykonaj ban
    try {
      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds,
        reason: `${reason} | Moderator: ${interaction.user.tag} (${interaction.user.id})`,
      });
    } catch (err) {
      await interaction.editReply(`❌ Nie udało się zbanować użytkownika: ${String(err)}`);
      return;
    }

    // ✅ Zapis do bazy (BanLog) po udanym banie
    try {
await prisma.banLog.create({
  data: {
    guildId: interaction.guild.id,
    userId: targetUser.id,
    moderator: interaction.user.id,
    reason: deleteDays > 0 ? `${reason} (usunięto wiadomości: ${deleteDays}d)` : reason,
  },
});

    } catch (err) {
      // Nie blokujemy dalszej logiki; tylko log w konsoli
      console.error('❌ Błąd zapisu bana do bazy:', err);
    }

    // inkrementuj statystyki (lokalne)
    try {
      incStat(interaction.guild.id, targetUser.id, 'bans');
    } catch {}

    // potwierdzenie dla moderatora
    const replyEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('✅ Użytkownik zbanowany')
      .setDescription(`${userMention(targetUser.id)} został zbanowany.`)
      .addFields(
        { name: 'Powód', value: reason, inline: false },
        { name: 'Usunięto wiadomości (dni)', value: String(deleteDays), inline: true },
        { name: 'DM wysłany', value: dmOk ? '✅ Tak' : '❌ Nie', inline: true }
      )
      .setFooter({ text: `Akcja: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });

    // log
    const logEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('🚫 BAN')
      .setDescription(
        `**Użytkownik:** ${userMention(targetUser.id)}\n` +
          `**Moderator:** ${userMention(interaction.user.id)}\n` +
          `**Powód:** ${reason}`
      )
      .addFields(
        { name: 'ID Użytkownika', value: targetUser.id, inline: true },
        { name: 'ID Moderatora', value: interaction.user.id, inline: true },
        { name: 'Usunięto wiadomości (dni)', value: String(deleteDays), inline: true },
        { name: 'DM wysłany', value: dmOk ? '✅ Tak' : '❌ Nie', inline: true },
        { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setTimestamp();

    await sendLogEmbed(interaction.client, interaction.guild.id, logEmbed);
  },
};

export default command;
