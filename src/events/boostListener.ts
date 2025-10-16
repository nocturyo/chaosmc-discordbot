// src/events/boostListener.ts
import {
  Client,
  Events,
  EmbedBuilder,
  userMention,
  type GuildTextBasedChannel,
} from 'discord.js';
import { prisma } from '../utils/database';            // ✅ DB (GuildConfig.boostChannelId)
import { getBoostChannelId } from '../utils/configManager'; // fallback lokalny
import { sendLogEmbed } from '../utils/logSender';

const BOOST_COLOR = 0x98039b; // fiolet

export function setupBoostListener(client: Client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      // wykrywanie nowego boosta
      const before =
        (oldMember as any).premiumSinceTimestamp ??
        (oldMember as any).premiumSince?.getTime() ??
        null;

      const after =
        (newMember as any).premiumSinceTimestamp ??
        (newMember as any).premiumSince?.getTime() ??
        null;

      // tylko przejście: brak -> jest (nowy boost)
      if (!before && after) {
        const guild = newMember.guild;

        // 1) pobierz kanał z bazy
        let boostChannelId: string | null = null;
        try {
          const cfg = await prisma.guildConfig.findUnique({
            where: { guildId: guild.id },
            select: { boostChannelId: true },
          });
          boostChannelId = cfg?.boostChannelId ?? null;
        } catch (e) {
          console.error('Błąd pobierania boostChannelId z DB:', e);
        }

        // 2) fallback lokalny (jeśli używasz configManager)
        if (!boostChannelId) {
          const local = getBoostChannelId();
          if (local) boostChannelId = local;
        }

        // embed
        const embed = new EmbedBuilder()
          .setColor(BOOST_COLOR)
          .setTitle('🎉 Nowy boost!')
          .setDescription(
            `Dziękujemy za wsparcie serwera **${guild.name}**!\n` +
            `${userMention(newMember.id)} właśnie podbił(a) serwer. 💜`
          )
          .addFields(
            { name: 'Booster', value: newMember.user.tag, inline: true },
            { name: 'Data', value: `<t:${Math.floor(after / 1000)}:F>`, inline: true },
          )
          .setThumbnail(newMember.displayAvatarURL())
          .setFooter({ text: 'Twoje wsparcie pozwala nam rozwijać ChaosMC. Dziękujemy!' })
          .setTimestamp();

        // 3) spróbuj wysłać na kanał boostów (DB → fallback lokalny)
        if (boostChannelId) {
          const chan = await guild.channels.fetch(boostChannelId).catch(() => null);
          if (chan && chan.isTextBased()) {
            await (chan as GuildTextBasedChannel).send({ embeds: [embed] });
            return;
          }
        }

        // 4) fallback: kanał logów
        const sent = await sendLogEmbed(client, guild.id, embed);

        // 5) ostateczny fallback: systemChannel/publicUpdates
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
