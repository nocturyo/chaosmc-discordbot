import type { Client, EmbedBuilder } from 'discord.js';
import { getLogChannelId } from './configManager';

export async function sendLogEmbed(client: Client, guildId: string, embed: EmbedBuilder) {
  const channelId = getLogChannelId();
  if (!channelId) return false;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;

  const channel = guild.channels.cache.get(channelId);
  if (!channel || !('send' in channel)) return false;

  await (channel as any).send({ embeds: [embed] });
  return true;
}
