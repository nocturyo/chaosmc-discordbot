import {
  Client,
  Events,
  EmbedBuilder,
  ButtonInteraction,
  GuildMember,
} from 'discord.js';
import { getVerifyRoleId } from '../utils/configManager';
import { sendLogEmbed } from '../utils/logSender';

export function setupVerifyListener(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'chaosmc_verify') return;
    if (!interaction.guild) {
      await interaction.reply({ content: 'Ta akcja działa tylko na serwerze.', ephemeral: true });
      return;
    }

    const roleId = getVerifyRoleId();
    if (!roleId) {
      await interaction.reply({
        content: '⚠️ Weryfikacja nie jest skonfigurowana. Administrator musi użyć /setverify.',
        ephemeral: true,
      });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id) as GuildMember;

      if (member.roles.cache.has(roleId)) {
        await interaction.reply({ content: '✅ Jesteś już zweryfikowany.', ephemeral: true });
        return;
      }

      // nadaj rolę
      await member.roles.add(roleId, 'Weryfikacja przyciskiem');

      await interaction.reply({
        content: '✅ Zweryfikowano! Nadano rolę i przyznano dostęp do serwera.',
        ephemeral: true,
      });

      // log (jeśli masz ustawiony kanał logów)
      const log = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('✅ Weryfikacja zakończona')
        .setDescription(`Użytkownik: <@${member.id}>`)
        .setTimestamp();

      await sendLogEmbed(client, interaction.guild.id, log);
    } catch (err) {
      console.error('Błąd weryfikacji:', err);
      try {
        await interaction.reply({
          content: '❌ Nie udało się zweryfikować. Upewnij się, że bot ma uprawnienie **Zarządzanie rolami** i jego rola jest powyżej roli weryfikacyjnej.',
          ephemeral: true,
        });
      } catch {}
    }
  });
}
