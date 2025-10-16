import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import {
  getTicketCategoryId,
  getTicketSupportRoleId,
  nextTicketCounter,
  getLogChannelId, // do wysyłki transkryptu z plikiem
} from '../utils/configManager';

import { sendLogEmbed } from '../utils/logSender';
import { makeTranscript } from '../utils/transcript';
import { prisma } from '../utils/database'; // ✅ DB

/* =======================
 *   Kategorie ticketów
 * ======================= */

type Cat = {
  key: string;
  name: string;
  emoji: string;
  intro: string; // instrukcja wyświetlana w kanale ticketa
  prefix: string; // część nazwy kanału
};

const CATEGORIES: Record<string, Cat> = {
  appeal_ban: {
    key: 'appeal_ban',
    name: 'Odwołanie bana',
    emoji: '🔓',
    prefix: 'ban',
    intro:
      'Podaj swój nick, datę bana (jeśli znasz), powód widoczny przy banie oraz krótkie uzasadnienie odwołania.',
  },
  appeal_warn: {
    key: 'appeal_warn',
    name: 'Odwołanie warna',
    emoji: '📝',
    prefix: 'warn',
    intro:
      'Podaj swój nick, datę otrzymania warna (jeśli znasz), jego powód oraz krótkie uzasadnienie odwołania.',
  },
  report_cheater: {
    key: 'report_cheater',
    name: 'Zgłoszenie cheatera',
    emoji: '🚨',
    prefix: 'cheat',
    intro:
      'Podaj nick podejrzanego, tryb/serwer, orientacyjną godzinę oraz **dowody** (screeny/wideo).',
  },
  discord_issue: {
    key: 'discord_issue',
    name: 'Serwer Discord',
    emoji: '💬',
    prefix: 'discord',
    intro:
      'Opisz problem na Discordzie (rola, dostęp, ustawienia, błędy itp.).',
  },
  mc_issue: {
    key: 'mc_issue',
    name: 'Problem Minecraft',
    emoji: '⛏️',
    prefix: 'mc',
    intro:
      'Opisz problem w grze (wejście, lagi, błędy), wersję Minecrafta i ewentualne mody.',
  },
  shop_issue: {
    key: 'shop_issue',
    name: 'Problem z zakupem na WWW',
    emoji: '🛒',
    prefix: 'shop',
    intro:
      'Podaj numer zamówienia lub e-mail, metodę płatności i opisz problem (brak realizacji, błąd itd.).',
  },
  bug_report: {
    key: 'bug_report',
    name: 'Znalazłem błąd',
    emoji: '🐞',
    prefix: 'bug',
    intro:
      'Opisz błąd krok po kroku (co zrobiłeś, co się stało, co powinno się stać). Dodaj screeny/wideo.',
  },
};

/* =======================
 *     Główny listener
 * ======================= */

export function setupTicketListener(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      // SELECT: wybór kategorii z panelu
      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        await handleSelect(interaction);
        return;
      }

      // BUTTONY w kanale ticketa
      if (interaction.isButton()) {
        if (interaction.customId === 'ticket_close') {
          await handleClose(interaction);
          return;
        }
        if (interaction.customId === 'ticket_add') {
          await showUserModal(interaction, 'ticket_add_modal', 'Dodaj użytkownika do ticketa');
          return;
        }
        if (interaction.customId === 'ticket_remove') {
          await showUserModal(interaction, 'ticket_remove_modal', 'Usuń użytkownika z ticketa');
          return;
        }
      }

      // MODALE (dodaj/usuń użytkownika)
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticket_add_modal') {
          await handleAddUser(interaction);
          return;
        }
        if (interaction.customId === 'ticket_remove_modal') {
          await handleRemoveUser(interaction);
          return;
        }
      }
    } catch (err) {
      console.error('[ticketListener] error:', err);
      if (interaction.isRepliable()) {
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Wystąpił błąd.', ephemeral: true });
          } else {
            await interaction.followUp({ content: '❌ Wystąpił błąd.', ephemeral: true });
          }
        } catch {}
      }
    }
  });

  /* -----------------------
   *   Wybór kategorii
   * ----------------------- */
  async function handleSelect(inter: StringSelectMenuInteraction) {
    if (!inter.guild) {
      await inter.reply({ content: 'Ta akcja działa tylko na serwerze.', ephemeral: true });
      return;
    }

    const selected = inter.values[0];
    const cat = CATEGORIES[selected];
    if (!cat) {
      await inter.reply({ content: '❌ Nieznana kategoria.', ephemeral: true });
      return;
    }

    // 🔎 Najpierw spróbuj z DB
    let parentId: string | null = null;
    let supportRoleId: string | null = null;
    try {
      const cfg = await prisma.guildConfig.findUnique({
        where: { guildId: inter.guild.id },
        select: { ticketCategoryId: true, ticketSupportRoleId: true },
      });
      parentId = cfg?.ticketCategoryId ?? null;
      supportRoleId = cfg?.ticketSupportRoleId ?? null;
    } catch (e) {
      console.error('[ticketListener] DB read error:', e);
    }

    // 🔁 Fallback na Twój configManager (jeśli brak w DB)
    if (!parentId) parentId = getTicketCategoryId() ?? null;
    if (!supportRoleId) supportRoleId = getTicketSupportRoleId() ?? null;

    if (!parentId || !supportRoleId) {
      await inter.reply({
        content: '⚠️ System ticketów nie jest skonfigurowany. Użyj **/ticketsetup**.',
        ephemeral: true,
      });
      return;
    }

    // (opcjonalnie) ograniczenie: 1 ticket na użytkownika
    const already = inter.guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.name.startsWith('ticket-') &&
        (ch as TextChannel).topic?.includes(`UID:${inter.user.id}`),
    );
    if (already) {
      await inter.reply({ content: `Masz już otwarty ticket: <#${already.id}>`, ephemeral: true });
      return;
    }

    const num = nextTicketCounter();
    const name = `ticket-${cat.prefix}-${num.toString().padStart(4, '0')}`;

    const ch = await inter.guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parentId,
      topic: `Ticket ${name} • Kategoria: ${cat.name} • UID:${inter.user.id}`,
      permissionOverwrites: [
        { id: inter.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: inter.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: supportRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ],
    });

    // ✅ Zapisz do bazy rekord ticketa
    try {
      await prisma.ticket.create({
        data: {
          guildId: inter.guild.id,
          userId: inter.user.id,
          channelId: ch.id,
          // status: 'open' (domyślnie z modelu)
        },
      });
    } catch (e) {
      console.error('❌ Błąd zapisu ticketa do bazy:', e);
    }

    const intro = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`${cat.emoji} ${cat.name}`)
      .setDescription(
        [
          `Witaj <@${inter.user.id}>! To jest Twój prywatny ticket w kategorii **${cat.name}**.`,
          '',
          `**Instrukcja:** ${cat.intro}`,
          '',
          `Zespół wsparcia <@&${supportRoleId}> wkrótce się odezwie.`,
        ].join('\n'),
      )
      .setFooter({ text: `CHAOSMC.ZONE • System ticketów • ${name}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setStyle(ButtonStyle.Danger).setLabel('Zamknij'),
      new ButtonBuilder().setCustomId('ticket_add').setStyle(ButtonStyle.Secondary).setLabel('Dodaj'),
      new ButtonBuilder().setCustomId('ticket_remove').setStyle(ButtonStyle.Secondary).setLabel('Usuń'),
    );

    await (ch as TextChannel).send({
      content: `<@${inter.user.id}>`,
      embeds: [intro],
      components: [row],
    });

    await inter.reply({ content: `✅ Utworzono ticket: ${ch}`, ephemeral: true });

    // log
    try {
      const log = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🎟️ Ticket utworzony')
        .addFields(
          { name: 'Użytkownik', value: `<@${inter.user.id}>`, inline: true },
          { name: 'Kategoria', value: `${cat.emoji} ${cat.name}`, inline: true },
          { name: 'Kanał', value: `<#${ch.id}>`, inline: false },
        )
        .setTimestamp();
      await sendLogEmbed(client, inter.guild.id, log);
    } catch {}
  }

  /* -----------------------
   *    Zamknięcie ticketa
   *  (transkrypt tylko dla ADM)
   * ----------------------- */
  async function handleClose(inter: ButtonInteraction) {
    if (!inter.guild) {
      await inter.reply({ content: 'Ta akcja działa tylko na serwerze.', ephemeral: true });
      return;
    }
    const ch = inter.channel;
    if (!ch || ch.type !== ChannelType.GuildText || !ch.name.startsWith('ticket-')) {
      await inter.reply({ content: 'To nie wygląda na kanał ticketa.', ephemeral: true });
      return;
    }

    await inter.reply({
      content: '🔒 Trwa zamykanie ticketa…',
      ephemeral: true,
    });

    // 1) Generuj transkrypt
    let transcriptAttachment: any = null;
    try {
      const { attachment } = await makeTranscript(ch as TextChannel, inter.guild);
      transcriptAttachment = attachment;
    } catch (e) {
      console.error('Transcript error:', e);
    }

    // 2) Zaktualizuj w bazie (status -> closed)
    try {
      const t = await prisma.ticket.findFirst({
        where: { guildId: inter.guild.id, channelId: ch.id, status: 'open' },
      });
      if (t) {
        await prisma.ticket.update({
          where: { id: t.id },
          data: { status: 'closed', closedAt: new Date() },
        });
      }
    } catch (e) {
      console.error('❌ Błąd aktualizacji ticketa w bazie:', e);
    }

    // 3) Wyślij do kanału logów (administracja)
    try {
      const log = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('🔒 Ticket zamknięty')
        .addFields(
          { name: 'Zamykający', value: `<@${inter.user.id}>`, inline: true },
          { name: 'Kanał', value: `<#${ch.id}>`, inline: true },
        )
        .setTimestamp();

      // najpierw spróbuj przez util (embed)
      await sendLogEmbed(client, inter.guild.id, log);

      // następnie doślij plik transkryptu (jeśli jest)
      const logChId = getLogChannelId?.();
      if (logChId && transcriptAttachment) {
        const logChannel = await inter.guild.channels.fetch(logChId).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          await (logChannel as TextChannel).send({ files: [transcriptAttachment] });
        }
      }
    } catch (e) {
      console.error('Log send error:', e);
    }

    // 4) Usuń kanał po chwili
    setTimeout(async () => {
      try {
        await ch.delete('Ticket zamknięty');
      } catch {}
    }, 4000);
  }

  /* -----------------------
   *      Dodawanie/u.s.u.n.
   * ----------------------- */
  async function showUserModal(
    inter: ButtonInteraction,
    customId: string,
    title: string,
  ) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

    const input = new TextInputBuilder()
      .setCustomId('user_input')
      .setLabel('ID lub wzmianka użytkownika')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('@użytkownik lub 123456789012345678')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await inter.showModal(modal);
  }

  function parseUserId(raw: string): string | null {
    const mention = raw.match(/^<@!?(\d{17,20})>$/);
    if (mention) return mention[1];
    const id = raw.match(/^\d{17,20}$/);
    return id ? id[0] : null;
  }

  async function handleAddUser(inter: any) {
    if (!inter.guild || !inter.channel || inter.channel.type !== ChannelType.GuildText) {
      await inter.reply({ content: 'Ta akcja działa tylko na kanale ticketa.', ephemeral: true });
      return;
    }
    const value = inter.fields.getTextInputValue('user_input').trim();
    const id = parseUserId(value);
    if (!id) {
      await inter.reply({ content: '❌ Podaj poprawne ID lub wzmiankę.', ephemeral: true });
      return;
    }

    try {
      await inter.channel.permissionOverwrites.edit(id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
      await inter.reply({ content: `✅ Dodano <@${id}> do tego ticketa.`, ephemeral: true });
    } catch (e) {
      console.error(e);
      await inter.reply({ content: '❌ Nie udało się dodać użytkownika.', ephemeral: true });
    }
  }

  async function handleRemoveUser(inter: any) {
    if (!inter.guild || !inter.channel || inter.channel.type !== ChannelType.GuildText) {
      await inter.reply({ content: 'Ta akcja działa tylko na kanale ticketa.', ephemeral: true });
      return;
    }
    const value = inter.fields.getTextInputValue('user_input').trim();
    const id = parseUserId(value);
    if (!id) {
      await inter.reply({ content: '❌ Podaj poprawne ID lub wzmiankę.', ephemeral: true });
      return;
    }

    try {
      await inter.channel.permissionOverwrites.delete(id);
      await inter.reply({ content: `✅ Usunięto <@${id}> z tego ticketa.`, ephemeral: true });
    } catch (e) {
      console.error(e);
      await inter.reply({ content: '❌ Nie udało się usunąć użytkownika.', ephemeral: true });
    }
  }
}
