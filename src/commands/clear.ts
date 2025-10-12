import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import fs from "fs";
import path from "path";

export const data = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("🧹 Usuń określoną liczbę wiadomości z kanału.")
  .addIntegerOption((option) =>
    option
      .setName("ilość")
      .setDescription("Ile wiadomości chcesz usunąć (1–100)")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger("ilość", true);

  if (amount < 1 || amount > 100) {
    return interaction.reply({
      content: "❌ Podaj liczbę od 1 do 100.",
      ephemeral: true,
    });
  }

  const channel = interaction.channel as TextChannel;

  try {
    await interaction.deferReply({ ephemeral: true });

    const messages = await channel.bulkDelete(amount, true);
    const deletedCount = messages.size;

    const embed = new EmbedBuilder()
      .setColor("#9146FF") // fioletowy kolor
      .setTitle("🧹 Wiadomości wyczyszczone")
      .setDescription(
        `**${interaction.user.tag}** usunął **${deletedCount}** wiadomości z kanału <#${channel.id}>.`
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
    });

    // Opcjonalne logowanie do kanału logów
    const configPath = path.join(process.cwd(), "data", "logChannel.json");
    if (fs.existsSync(configPath)) {
      const { logChannelId } = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const logChannel = interaction.guild?.channels.cache.get(logChannelId) as TextChannel;
      if (logChannel) await logChannel.send({ embeds: [embed] });
    }

  } catch (err) {
    console.error("❌ Błąd podczas czyszczenia:", err);
    await interaction.editReply({
      content: "❌ Wystąpił błąd podczas czyszczenia wiadomości.",
    });
  }
}
