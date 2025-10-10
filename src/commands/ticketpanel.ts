import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from 'discord.js';
import type { Command } from '../types/Command';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Wyślij panel systemu ticketów (z wyborem kategorii) na wybrany kanał.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('kanał')
        .setDescription('Kanał tekstowy, na którym ma stać panel.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channel = interaction.options.getChannel('kanał', true);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle('🧾 System ticketów • CHAOSMC.ZONE')
      .setDescription(
        [
          '**Informacja dotycząca ticketów**',
          '',
          'Aby skontaktować się z administracją, wybierz **typ zgłoszenia** z listy poniżej.',
          'Następnie opisz problem zgodnie z instrukcją w otwartym kanale.',
          '',
          '⏱️ **Czas odpowiedzi** może wynieść do godziny w godzinach roboczych.',
          '',
          '⚠️ **Wysyłanie bezsensownych ticketów** może skutkować sankcjami.',
        ].join('\n')
      )
      .setFooter({ text: 'CHAOSMC.ZONE • System ticketów' });

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Kliknij, aby wybrać typ ticketu!')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Odwołanie bana')
          .setDescription('Chcę odwołać się od bana na serwerze.')
          .setEmoji('🚫')
          .setValue('appeal_ban'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Odwołanie warna')
          .setDescription('Chcę odwołać się od ostrzeżenia (warna).')
          .setEmoji('📝')
          .setValue('appeal_warn'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Zgłoszenie cheatera')
          .setDescription('Zgłoś podejrzane zachowanie lub cheaty.')
          .setEmoji('🚨')
          .setValue('report_cheater'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Serwer Discord')
          .setDescription('Pytanie lub problem związany z Discordem.')
          .setEmoji('💬')
          .setValue('discord_issue'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Problem Minecraft')
          .setDescription('Problem z rozgrywką/połączeniem na serwerze MC.')
          .setEmoji('⛏️')
          .setValue('mc_issue'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Problem z zakupem na WWW')
          .setDescription('Płatności/sklep – pomoc w zakupie lub aktywacji.')
          .setEmoji('🛒')
          .setValue('shop_issue'),

        new StringSelectMenuOptionBuilder()
          .setLabel('Znalazłem błąd')
          .setDescription('Zgłoś błąd lub podatność – pomóż nam to poprawić.')
          .setEmoji('🐞')
          .setValue('bug_report'),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Panel ticketów wysłany na ${channel}.`, ephemeral: true });
  },
};

export default command;
