import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../types/Command';

// kolor CHAOSMC.ZONE
const EMBED_COLOR = 0x8b5cf6; // fioletowy

const OWNER_ID = '1218694113164263495';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('changelog')
    .setDescription('Wysyła embed z changelogiem (dla właściciela).')
    .addStringOption((opt) =>
      opt
        .setName('tytuł')
        .setDescription('Tytuł changelogu (np. Aktualizacja #12)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('opis')
        .setDescription('Opis zmian, nowości, poprawek itp.')
        .setRequired(true)
    )
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // tylko właściciel bota
    if (interaction.user.id !== OWNER_ID) {
      await interaction.reply({
        content: '❌ Tylko właściciel CHAOSMC.ZONE może użyć tej komendy.',
        ephemeral: true,
      });
      return;
    }

    const title = interaction.options.getString('tytuł', true);
    const description = interaction.options.getString('opis', true);

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLOR)
      .setTitle(`📢 ${title}`)
      .setDescription(description)
      .setFooter({
        text: `Changelog CHAOSMC.ZONE`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
