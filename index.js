/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Professional Edition)
 * Versione: 6.0.0
 * 
 * MENU DI GESTIONE COMPLETO:
 * 1. CONFIGURAZIONE ID E VARIABILI
 * 2. MODULO LOGGING AVANZATO (Audit Log)
 * 3. EVENTO READY E REGISTRAZIONE COMANDI
 * 4. GESTIONE INTERAZIONI (Main Engine)
 *    - Slash Commands (/votazione, /sts)
 *    - Sistema Votazioni con Embed Dinamico
 *    - Conteggio Votanti e Ping Finale
 *    - Gestione SSU / SSD
 * 5. MODULO GESTIONE ERRORI CRITICI
 * ===================================================================================
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ActivityType, Events 
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// --- 1. CONFIGURAZIONE ID E VARIABILI ---
const CONFIG = {
    ROLES: { VOTE: '1513989681522413638', ADMIN: '1521868096867012728' },
    CHANNELS: { STATUS: '1521861880883445842', STAFF: '1521861903436218408' },
    SETTINGS: { GOAL: 6, SERVER_CODE: 'EDGEWATER' }
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
        if (ch) ch.send(`📋 **Audit Log:** ${msg}`);
    }
};

// --- 3. EVENTO READY E REGISTRAZIONE COMANDI ---
client.on(Events.ClientReady, async () => {
    Logger.log(`Bot Firenze RP Online - Versione 6.0.0`);
    client.user.setActivity('Firenze RP | ERLC', { type: ActivityType.Watching });

    const commands = [
        { name: 'votazione', description: 'Avvia votazione SSU' },
        { name: 'sts', description: 'Comando SSD (Chiusura)' }
    ];

    try {
        await client.application.commands.set(commands);
        Logger.log('Comandi Slash registrati.');
    } catch (err) { Logger.error(`Errore: ${err.message}`); }
});

// --- 4. GESTIONE INTERAZIONI (Main Engine) ---
client.on(Events.InteractionCreate, async (interaction) => {
    
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.VOTE)) 
                return interaction.reply({ content: '❌ Accesso negato.', ephemeral: true });

            sessionData = { active: true, count: 0, voters: [], votersUnique: new Set(), triggered: false };
            
            const nowUnix = Math.floor(Date.now() / 1000);
            
            const embedVoto = new EmbedBuilder()
                .setTitle('🚓 **VOTAZIONE UFFICIALE FIRP**')
                .setDescription(`Premete il tasto verde per confermare la vostra presenza.\n\n🎯 **Obiettivo:** 6 Voti\n⏱️ **Iniziata:** <t:${nowUnix}:R>`)
                .addFields({ name: '📊 Stato Attuale', value: `0 / 6 VOTI`, inline: false })
                .setColor('#2b2d31');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Premi per votare').setEmoji('✋').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Votazione Prova').setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ content: '@everyone 📢 **Nuova Votazione FIRP!**', embeds: [embedVoto], components: [row] });
            Logger.audit(`Votazione avviata da ${interaction.user.tag}`);
        }
    }

    // Gestione Bottoni
    if (interaction.isButton()) {
        if (!sessionData.active && interaction.customId !== 'btn_ssd') return;

        if (interaction.customId === 'btn_vota') {
            sessionData.count++;
            sessionData.voters.push(interaction.user.id);
            sessionData.votersUnique.add(interaction.user.id);
            
            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .spliceFields(0, 1, { name: '📊 Stato Attuale', value: `${sessionData.count} / 6 VOTI`, inline: false });
            
            await interaction.update({ embeds: [newEmbed] });
        }
        
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) return;
            sessionData.count++;
            sessionData.voters.push(interaction.user.id);
            
            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .spliceFields(0, 1, { name: '📊 Stato Attuale', value: `${sessionData.count} / 6 VOTI (Admin Forzato)`, inline: false });
            
            await interaction.update({ embeds: [newEmbed] });
            Logger.audit(`Admin ${interaction.user.tag} ha forzato un voto.`);
        }

        // TRIGGER SSU
        if (sessionData.count >= CONFIG.SETTINGS.GOAL && !sessionData.triggered) {
            sessionData.triggered = true;
            await interaction.channel.send('@here 🎯 **Voti raggiunti! SSU in preparazione tra 1 minuto.**');

            setTimeout(async () => {
                const pingList = Array.from(sessionData.votersUnique).map(id => `<@${id}>`).join(' ');
                const embedOn = new EmbedBuilder()
                    .setTitle('🌐 **SERVER ERLC: ONLINE**')
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

        if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete();
            await interaction.reply({ content: '🔴 Server chiuso via SSD.', ephemeral: true });
        }
    }
});

// --- 5. MODULO GESTIONE ERRORI ---
process.on('uncaughtException', (err) => Logger.error(err.message));
process.on('unhandledRejection', (reason) => Logger.error(reason));

client.login(process.env.TOKEN);
