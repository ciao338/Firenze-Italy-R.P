/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Professional Edition)
 * Versione: 5.0.0
 * 
 * MENU DI GESTIONE:
 * 1. CONFIGURAZIONE ID E VARIABILI
 * 2. MODULO LOGGING AVANZATO
 * 3. EVENTO READY E REGISTRAZIONE COMANDI SLASH
 * 4. GESTIONE INTERAZIONI (Main Engine)
 *    - Slash Commands (Votazione, STS)
 *    - Gestione Bottoni (Voto, Prova, SSD)
 *    - Trigger SSU e Ping Dinamico
 * 5. MODULO GESTIONE ERRORI CRITICI
 * ===================================================================================
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ActivityType, Events 
} = require('discord.js');
require('dotenv').config();

// Inizializzazione Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- 1. CONFIGURAZIONE ID E VARIABILI ---
const CONFIG = {
    ROLES: {
        VOTE: '1513989681522413638',
        ADMIN: '1521868096867012728'
    },
    CHANNELS: {
        STATUS: '1521861880883445842',
        STAFF: '1521861903436218408'
    },
    SETTINGS: {
        GOAL: 6,
        SERVER_CODE: 'EDGEWATER'
    }
};

let sessionData = {
    active: false,
    count: 0,
    voters: [],
    votersUnique: new Set(),
    triggered: false
};

// --- 2. MODULO LOGGING AVANZATO ---
const Logger = {
    log: (msg) => console.log(`[${new Date().toLocaleTimeString()}] [INFO] ${msg}`),
    error: (msg) => console.error(`[${new Date().toLocaleTimeString()}] [ERROR] ${msg}`),
    audit: (msg) => {
        const ch = client.channels.cache.get(CONFIG.CHANNELS.STAFF);
        if (ch) ch.send(`🛡️ **Audit Log:** ${msg}`);
    }
};

// --- 3. EVENTO READY E REGISTRAZIONE COMANDI ---
client.on(Events.ClientReady, async () => {
    Logger.log(`Bot Firenze RP Online - Versione 5.0.0`);
    client.user.setActivity('Firenze RP | ERLC', { type: ActivityType.Watching });

    const commands = [
        { name: 'votazione', description: 'Avvia una nuova votazione per la SSU' },
        { name: 'sts', description: 'Comando di emergenza per chiusura server (SSD)' }
    ];

    try {
        await client.application.commands.set(commands);
        Logger.log('Comandi Slash globali registrati.');
    } catch (err) {
        Logger.error(`Errore registrazione: ${err.message}`);
    }
});

// --- 4. GESTIONE INTERAZIONI (Main Engine) ---
client.on(Events.InteractionCreate, async (interaction) => {
    
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.VOTE)) 
                return interaction.reply({ content: '❌ Accesso negato.', ephemeral: true });

            sessionData = { active: true, count: 0, voters: [], votersUnique: new Set(), triggered: false };
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Premi per votare').setEmoji('✋').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Votazione Prova').setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ 
                content: '@everyone 📢 **Votazione per SSU Firenze RP (ERLC)** \nObiettivo: 6 voti.', 
                components: [row] 
            });
            Logger.audit(`Votazione avviata da ${interaction.user.tag}`);
        }

        if (interaction.commandName === 'sts') {
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔴 **SERVER STATUS: OFFLINE (SSD)**').setColor('#ff0000').setTimestamp()] });
            Logger.audit(`Chiusura SSD forzata da ${interaction.user.tag}`);
        }
    }

    // Gestione Bottoni
    if (interaction.isButton()) {
        if (!sessionData.active && interaction.customId !== 'btn_ssd') 
            return interaction.reply({ content: '❌ Votazione non attiva.', ephemeral: true });

        // Voto Standard
        if (interaction.customId === 'btn_vota') {
            sessionData.count++;
            sessionData.voters.push(interaction.user.id);
            sessionData.votersUnique.add(interaction.user.id);
            await interaction.reply({ content: '✅ Voto registrato.', ephemeral: true });
        }
        
        // Voto Prova Admin
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) 
                return interaction.reply({ content: '❌ Solo Admin.', ephemeral: true });
            
            sessionData.count++;
            sessionData.voters.push(interaction.user.id);
            await interaction.reply({ content: '🛠️ Voto Prova registrato.', ephemeral: true });
            Logger.audit(`Admin ${interaction.user.tag} ha forzato un voto.`);
        }

        // SSD
        else if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete();
            return interaction.reply({ content: '🔴 Server chiuso via SSD.', ephemeral: true });
        }

        // Trigger SSU
        if (sessionData.count >= CONFIG.SETTINGS.GOAL && !sessionData.triggered) {
            sessionData.triggered = true;
            await interaction.channel.send('@here 🎯 **Voti raggiunti! SSU in preparazione tra 1 minuto.**');

            setTimeout(async () => {
                const pingList = Array.from(sessionData.votersUnique).map(id => `<@${id}>`).join(' ');
                const embedOn = new EmbedBuilder()
                    .setTitle('🌐 **SERVER ERLC: ONLINE**')
                    .setDescription('SSU attivata!')
                    .addFields(
                        { name: 'Codice Server', value: `\`${CONFIG.SETTINGS.SERVER_CODE}\``, inline: true },
                        { name: 'Stato', value: '🟢 ONLINE', inline: true }
                    )
                    .setColor('#00ffaa');
                
                const rowSsd = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_ssd').setLabel('SSD (Chiudi)').setStyle(ButtonStyle.Danger)
                );

                const statusChannel = client.channels.cache.get(CONFIG.CHANNELS.STATUS);
                if (statusChannel) {
                    await statusChannel.send({ 
                        content: `🔔 ${pingList} \nIl server è pronto. Entrate!`, 
                        embeds: [embedOn], 
                        components: [rowSsd] 
                    });
                }
            }, 60000);
        }
    }
});

// --- 5. MODULO GESTIONE ERRORI CRITICI ---
process.on('uncaughtException', (err) => Logger.error(`Eccezione: ${err.message}`));
process.on('unhandledRejection', (reason) => Logger.error(`Rifiuto promessa: ${reason}`));

client.login(process.env.TOKEN);
