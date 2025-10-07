import {
  Client,
  Events,
  EmbedBuilder,
  userMention,
} from 'discord.js';
import { sendLogEmbed } from '../utils/logSender';

const BOOST_COLOR = 0x98039b; // fioletowy

export function setupBoostListener(client: Client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      // premiumSinceTimestamp: null -> liczba => nowy boost
      const before =
        (oldMember as any).premiumSinceTimestamp ??
        (oldMember as any).premiumSince?.getTime() ??
        null;
      const after =
        (newMember as any).premiumSinceTimestamp ??
        (newMember as any).premiumSince?.getTime() ??
        null;

      if (!before && after) {
        const guild = newMember.guild;

        const embed = new EmbedBuilder()
          .setColor(BOOST_COLOR)
          .setTitle('🎉 Nowy boost!')
          .setDescription(
            `Dziękujemy za wsparcie serwera **${guild.name}**!\n` +
            `${userMention(newMember.id)} właśnie podbił(a) serwer. 💜`
          )
          .addFields(
            { name: 'Booster', value: `${newMember.user.tag} (${newMember.id})`, inline: true },
            { name: 'Data', value: `<t:${Math.floor(after / 1000)}:F>`, inline: true },
          )
          .setThumbnail(newMember.displayAvatarURL())
          .setFooter({ text: 'Twoje wsparcie pozwala nam rozwijać ChaosMC. Dziękujemy!' })
          .setTimestamp();

        // wyślij na kanał logów (ustawiony przez /setlogchannel)
        const sent = await sendLogEmbed(client, guild.id, embed);

        // awaryjnie spróbuj na systemChannel/publicUpdatesChannel jeśli brak log kanału
        if (!sent) {
          const fallback = guild.systemChannel ?? guild.publicUpdatesChannel;
          await fallback?.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error('Błąd w boostListener:', err);
    }
  });
}
