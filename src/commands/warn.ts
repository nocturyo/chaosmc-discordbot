import {
SlashCommandBuilder,
PermissionFlagsBits,
ChatInputCommandInteraction,
EmbedBuilder,
userMention,
} from 'discord.js';
import type { Command } from '../types/Command';
import { addWarn } from '../utils/warnManager';
import { sendLogEmbed } from '../utils/logSender';


const MAX_WARNS = 3;


const command: Command = {
data: new SlashCommandBuilder()
.setName('warn')
.setDescription('Nadaj ostrzeżenie użytkownikowi (1/3).')
.addUserOption((opt) =>
opt.setName('użytkownik').setDescription('Kogo ostrzegasz?').setRequired(true)
)
.addStringOption((opt) =>
opt.setName('powód').setDescription('Powód ostrzeżenia').setRequired(false)
)
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),


async execute(interaction: ChatInputCommandInteraction) {
if (!interaction.guild) {
await interaction.reply({ content: 'Ta komenda działa tylko na serwerze.', ephemeral: true });
return;
}


const target = interaction.options.getUser('użytkownik', true);
const reason = interaction.options.getString('powód') ?? 'Brak powodu';


// Zapis ostrzeżenia
const count = addWarn(interaction.guild.id, target.id, {
userId: target.id,
moderatorId: interaction.user.id,
reason,
timestamp: Date.now(),
});


const fraction = `${Math.min(count, MAX_WARNS)}/${MAX_WARNS}`;


// Przyjazna nazwa moderatora do DM: nick na serwerze, a jak brak to tag
const moderatorDisplay =
(interaction.member && 'nickname' in interaction.member && interaction.member.nickname)
? (interaction.member as any).nickname
: interaction.user.displayName ?? interaction.user.tag;


// Embed dla moderatora (ephemeral)
const replyEmbed = new EmbedBuilder()
.setColor(0xF59E0B)
.setAuthor({ name: `Moderator: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
.setThumbnail(target.displayAvatarURL())
.setTitle(`⚠️ Ostrzeżenie ${fraction}`)
.setDescription(
`Użytkownik ${userMention(target.id)} otrzymał ostrzeżenie.


**Powód:** ${reason}`
)
.addFields(
{ name: 'Użytkownik', value: `${target.tag} (${target.id})`, inline: true },
{ name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
{ name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
)
.setFooter({ text: `Razem: ${fraction}` })
.setTimestamp();


await interaction.reply({ embeds: [replyEmbed], ephemeral: true });


// DM do użytkownika — bez ID moderatora, tylko jego nick/tag + ładny opis
const dmEmbed = new EmbedBuilder()
.setColor(0x98039b)
.setTitle(`Otrzymałeś ostrzeżenie (${fraction})`)
.setDescription(
`Na serwerze **${interaction.guild.name}** otrzymałeś ostrzeżenie.


` +
`**Moderator:** ${moderatorDisplay}
` +
`**Powód:** ${reason}


` +
`Jeśli uważasz, że to ostrzeżenie jest **niesłuszne**, skontaktuj się z administracją ` +
`— najlepiej poprzez kanał pomocy lub ticket serwera. Opisz sprawę spokojnie i podaj ` +
`jak najwięcej szczegółów, a zespół rozpatrzy Twoje zgłoszenie.`
)
.setThumbnail(interaction.guild?.iconURL() || null)
.setFooter({ text: `Łącznie: ${fraction}` })
.setTimestamp();


let dmOk = true;
try {
  await target.send({ embeds: [dmEmbed] });
} catch {
  dmOk = false; // DM zablokowany lub niepowodzenie
}

// Log do kanału logów
const logEmbed = new EmbedBuilder()
  .setColor(0xF59E0B)
  .setAuthor({ name: `WARN ${fraction}`, iconURL: target.displayAvatarURL() })
  .setThumbnail(interaction.user.displayAvatarURL())
  .setDescription(
    `**Użytkownik:** ${userMention(target.id)}\n` +
    `**Moderator:** ${userMention(interaction.user.id)}\n` +
    `**Powód:** ${reason}`
  )
  .addFields(
    { name: 'ID Użytkownika', value: target.id, inline: true },
    { name: 'ID Moderatora', value: interaction.user.id, inline: true },
    { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
    { name: 'DM wysłany', value: dmOk ? '✅ Tak' : '❌ Nie', inline: true },
  )
  .setTimestamp();

await sendLogEmbed(interaction.client, interaction.guild.id, logEmbed);

// (Opcjonalna eskalacja) — przy 3/3 wyślij dodatkową informację do logów
if (count >= MAX_WARNS) {
  const overEmbed = new EmbedBuilder()
    .setColor(0xDC2626)
    .setTitle('⛔ Limit ostrzeżeń osiągnięty')
    .setDescription(`${userMention(target.id)} ma ${count}/${MAX_WARNS} ostrzeżeń.`)
    .setTimestamp();
  await sendLogEmbed(interaction.client, interaction.guild.id, overEmbed);
  }

  }, // <- zamknięcie funkcji execute
};   // <- zamknięcie obiektu command

export default command;
