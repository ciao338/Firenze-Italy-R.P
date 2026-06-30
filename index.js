const { Client, GatewayIntentBits } = require('discord.js');

// Inserisci qui i tuoi dati
const TOKEN = 'MTUyMTYzNzQzMDE4MzA2NzcwOQ.GVn9es.WCCPqZX76_Jw_pgJ-fkIsprYWmktr6V7YFBbsM';
const CLIENT_ID = '1521637430183067709';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

client.once('ready', () => {
    console.log(`Bot online! Loggato come ${client.user.tag}`);
    console.log(`ID Cliente: ${CLIENT_ID}`);
});

client.on('messageCreate', (message) => {
    if (message.content === '!ping') {
        message.reply('Pong!');
    }
});

client.login(TOKEN);
