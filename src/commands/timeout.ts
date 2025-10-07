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

// Fiolet (Twój kolor)
const EMBED_COLOR = 0x98039b;

// Max timeout Discorda: 28 dni
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

// Parser: 10m / 2h / 1d
function parseDuration(input: string): { ms: number; label: string } | null {
  const match = input.trim().toLowerCase().match(/^(\d+)\s*(m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];

  let ms = 0;
  let label = '';
  if (unit === 'm') {
    ms = value * 60 * 1000;
    label = `${value} min`;
  } else if (unit === 'h') {
    ms = value * 60 * 60 * 1000;
    label = `${value} h`;
  } else if (unit === 'd') {
    ms = value * 24 * 60 * 60 * 1000;
    label = `${value} d`;
  }
  return { ms, label };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Nałóż czasowy timeout (wyciszenie) na użytkownika.')
    .addUserOption((opt) =>
      opt.setName('użytkownik').setDescription('Kogo wyciszyć?').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('czas')
        .setDescription('Czas trwania: np. 10m / 2h / 1d (max 28d)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('powód').setDescription('Powód timeoutu').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('użytkownik', true);
    const timeInput = interaction.options.getString('czas', true);
    const reason = interaction.options.getString('powód') ?? 'Brak powodu';

    const parsed = parseDuration(timeInput);
    if (!parsed) {
      await interaction.editReply('❌ Nieprawidłowy format czasu. Użyj: `10m`, `2h`, `1d` (maks. `28d`).');
      return;
    }
    if (parsed.ms <= 0 || parsed.ms > MAX_TIMEOUT_MS) {
      await interaction.editReply('❌ Czas musi być w zakresie od 1 min do 28 dni.');
      return;
    }

    // uprawnienia bota
    if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.editReply('❌ Nie mam uprawnienia **Moderate Members** (timeout) na tym serwerze.');
      return;
    }

    // pobierz członka
    let member: GuildMember | null = null;
    try {
      member = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      member = null;
    }
    if (!member) {
      await interaction.editReply('❌ Nie znaleziono użytkownika na serwerze.');
      return;
    }

    const me = await interaction.guild.members.fetchMe();

    if (targetUser.id === interaction.user.id) {
      await interaction.editReply('❌ Nie możesz nałożyć timeoutu samemu sobie.');
      return;
    }
    if (targetUser.id === me.id) {
      await interaction.editReply('❌ Nie możesz nałożyć timeoutu botowi.');
      return;
    }

    if (!member.moderatable) {
      await interaction.editReply('❌ Nie mogę nałożyć timeoutu na tego użytkownika (zbyt wysoka rola lub brak uprawnień).');
      return;
    }
    const modMember = await interaction.guild.members.fetch(interaction.user.id);
    if (
      modMember.roles.highest.comparePositionTo(member.roles.highest) <= 0 &&
      interaction.guild.ownerId !== modMember.id
    ) {
      await interaction.editReply('❌ Ten użytkownik ma równą lub wyższą rolę niż Twoja.');
      return;
    }

    // moderator display
    const moderatorDisplay =
      (interaction.member && 'nickname' in interaction.member && (interaction.member as any).nickname)
        ? (interaction.member as any).nickname
        : interaction.user.displayName ?? interaction.user.tag;

    const until = Date.now() + parsed.ms;
    const untilUnix = Math.floor(until / 1000);

    // DM
    const dmEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('⏳ Nałożono timeout')
      .setDescription(
        `Na serwerze **${interaction.guild.name}** nałożono na Ciebie timeout.\n\n` +
          `**Moderator:** ${moderatorDisplay}\n` +
          `**Powód:** ${reason}\n` +
          `**Czas trwania:** ${parsed.label}\n` +
          `**Do:** <t:${untilUnix}:F> (pozostało: <t:${untilUnix}:R>)\n\n` +
          `Jeśli uważasz, że kara jest **niesłuszna**, skontaktuj się z administracją przez kanał pomocy lub ticket.`
      )
      .setTimestamp();

    let dmOk = true;
    try {
      await targetUser.send({ embeds: [dmEmbed] });
    } catch {
      dmOk = false;
    }

    // nałóż timeout
    try {
      await member.timeout(parsed.ms, `${reason} | Moderator: ${interaction.user.tag} (${interaction.user.id})`);
    } catch (err) {
      await interaction.editReply(`❌ Nie udało się nałożyć timeoutu: ${String(err)}`);
      return;
    }

    // statystyka
    try {
      incStat(interaction.guild.id, member.user.id, 'timeouts');
    } catch {}

    // potwierdzenie
    const replyEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('✅ Timeout nałożony')
      .setDescription(`${userMention(targetUser.id)} został wyciszony.`)
      .addFields(
        { name: 'Powód', value: reason, inline: false },
        { name: 'Czas', value: parsed.label, inline: true },
        { name: 'Do', value: `<t:${untilUnix}:F>`, inline: true },
        { name: 'Pozostało', value: `<t:${untilUnix}:R>`, inline: true },
        { name: 'DM wysłany', value: dmOk ? '✅ Tak' : '❌ Nie', inline: true }
      )
      .setFooter({ text: `Akcja: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });

    // log
    const logEmbed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle('⏳ TIMEOUT')
      .setDescription(
        `**Użytkownik:** ${userMention(targetUser.id)}\n` +
          `**Moderator:** ${userMention(interaction.user.id)}\n` +
          `**Powód:** ${reason}`
      )
      .addFields(
        { name: 'Czas', value: parsed.label, inline: true },
        { name: 'Do', value: `<t:${untilUnix}:F>`, inline: true },
        { name: 'Pozostało', value: `<t:${untilUnix}:R>`, inline: true },
        { name: 'DM wysłany', value: dmOk ? '✅ Tak' : '❌ Nie', inline: true },
        { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setTimestamp();

    await sendLogEmbed(interaction.client, interaction.guild.id, logEmbed);
  },
};

export default command;
