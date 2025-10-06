import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/Command';


const command: Command = {
data: new SlashCommandBuilder()
.setName('ping')
.setDescription('Sprawdza opóźnienie bota.'),
async execute(interaction) {
const sent = await interaction.reply({ content: 'Pong!', fetchReply: true });
const latency = sent.createdTimestamp - interaction.createdTimestamp;
await interaction.editReply(`Pong! Opóźnienie: ${latency}ms`);
},
};


export default command;