import {
  Client,
  Events,
  EmbedBuilder,
  userMention,
} from 'discord.js';
import { sendLogEmbed } from '../utils/logSender';
import { getBoostChannelId } from '../utils/configManager';

const BOOST_COLOR = 0x98039b; // fiolet

export function setupBoostListener(client: Client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
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
            { name: 'Booster', value: `${newMember.user.tag}`, inline: true },
            { name: 'Data', value: `<t:${Math.floor(after / 1000)}:F>`, inline: true },
          )
          .setThumbnail(newMember.displayAvatarURL())
          .setFooter({ text: 'Twoje wsparcie pozwala nam rozwijać ChaosMC. Dziękujemy!' })
          .setTimestamp();

        // 1) spróbuj wysłać na kanał boostów
        const boostChannelId = getBoostChannelId();
        if (boostChannelId) {
          const chan = guild.channels.cache.get(boostChannelId) ??
                       await guild.channels.fetch(boostChannelId).catch(() => null);
          if (chan && 'send' in chan) {
            await (chan as any).send({ embeds: [embed] });
            return;
          }
        }

        // 2) fallback: kanał logów
        const sent = await sendLogEmbed(client, guild.id, embed);
        // 3) ostateczny fallback: systemChannel/publicUpdates
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
