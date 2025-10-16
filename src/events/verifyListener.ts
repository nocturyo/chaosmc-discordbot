// src/events/verifyListener.ts
import {
  Client,
  Events,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { prisma } from '../utils/database';           // ✅ DB (GuildConfig.verifyRoleId)
import { getVerifyRoleId } from '../utils/configManager'; // fallback lokalny
import { sendLogEmbed } from '../utils/logSender';

export function setupVerifyListener(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'chaosmc_verify') return;

    if (!interaction.guild) {
      await safeReply(interaction, 'Ta akcja działa tylko na serwerze.');
      return;
    }

    // 1) Pobierz verifyRoleId z DB → fallback lokalny
    let roleId: string | null = null;
    try {
      const cfg = await prisma.guildConfig.findUnique({
        where: { guildId: interaction.guild.id },
        select: { verifyRoleId: true },
      });
      roleId = cfg?.verifyRoleId ?? null;
    } catch (e) {
      console.error('[verifyListener] DB read error:', e);
    }
    if (!roleId) {
      const local = getVerifyRoleId();
      if (local) roleId = local;
    }

    if (!roleId) {
      await safeReply(
        interaction,
        '⚠️ Weryfikacja nie jest skonfigurowana. Administrator musi użyć `/setverify`.'
      );
      return;
    }

    // 2) Walidacje: uprawnienia bota i istnienie roli
    const me = await interaction.guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await safeReply(
        interaction,
        '❌ Nie mam uprawnienia **Zarządzanie rolami** na tym serwerze.'
      );
      return;
    }

    const role =
      interaction.guild.roles.cache.get(roleId) ??
      (await interaction.guild.roles.fetch(roleId).catch(() => null));
    if (!role) {
      await safeReply(
        interaction,
        '❌ Rola weryfikacyjna nie istnieje. Ustaw ją ponownie komendą `/setverify`.'
      );
      return;
    }

    // 3) Pobierz członka i sprawdź, czy już ma rolę
    let member: GuildMember;
    try {
      member = await interaction.guild.members.fetch(interaction.user.id);
    } catch {
      await safeReply(interaction, '❌ Nie znalazłem Twojego członkostwa na serwerze.');
      return;
    }

    if (member.roles.cache.has(role.id)) {
      await safeReply(interaction, '✅ Jesteś już zweryfikowany.');
      return;
    }

    // 4) Sprawdź hierarchię ról (bot > rola do nadania)
    const myTop = me.roles.highest;
    if (myTop.comparePositionTo(role) <= 0) {
      await safeReply(
        interaction,
        '❌ Nie mogę nadać tej roli — moja najwyższa rola jest **niżej lub równa** roli weryfikacyjnej. Przeciągnij rolę bota wyżej.'
      );
      return;
    }

    // 5) Nadaj rolę
    try {
      await member.roles.add(role, 'Weryfikacja przyciskiem');
      await safeReply(
        interaction,
        '✅ Zweryfikowano! Nadano rolę i przyznano dostęp do serwera.'
      );

      // log (jeśli masz ustawiony kanał logów)
      const log = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('✅ Weryfikacja zakończona')
        .setDescription(`Użytkownik: <@${member.id}>`)
        .setTimestamp();

      await sendLogEmbed(client, interaction.guild.id, log);
    } catch (err) {
      console.error('[verifyListener] add role error:', err);
      await safeReply(
        interaction,
        '❌ Nie udało się zweryfikować. Upewnij się, że bot ma **Zarządzanie rolami** i jego rola jest **powyżej** roli weryfikacyjnej.'
      );
    }
  });
}

/** Bezpieczna odpowiedź ephem., niezależnie czy już odpowiedziano/deferowano */
async function safeReply(
  interaction: any,
  content: string
): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch {}
}
