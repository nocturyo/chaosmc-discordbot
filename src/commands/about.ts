import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/Command';


const command: Command = {
data: new SlashCommandBuilder()
.setName('about')
.setDescription('Informacje o bocie i projekcie.'),
async execute(interaction) {
const embed = new EmbedBuilder()
.setTitle('MC Network — Bot')
.setDescription('Profesjonalny bot dla serwera Minecraft/Discord.')
.addFields(
{ name: 'Komendy', value: '`/ping`, `/about` (więcej wkrótce)' },
{ name: 'Autor', value: 'Ty + ChatGPT' }
)
.setTimestamp();


await interaction.reply({ embeds: [embed], ephemeral: true });
},
};


export default command;