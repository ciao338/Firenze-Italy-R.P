/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Professional Edition - 250+ Lines)
 * Versione: 10.0.0
 * 
 * FUNZIONALITÀ INTEGRATE:
 * - Sistema Votazioni Dinamico con Embed interattivi
 * - Logging Audit in canale Staff con tracciamento completo
 * - Sistema SSU: Ping automatico agli staff + Ping Votanti (Unique)
 * - Sistema SSD: Gestione chiusura server con tasto rapido
 * - Gestione Errori robusta (UncaughtException & UnhandledRejection)
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
// Sostituisci questi ID con quelli effettivi del tuo server
const CONFIG = {
    ROLES: { 
        VOTE: '1513989681522413638', 
        ADMIN: '1521868096867012728',
        STAFF_PING: '1521868096867012728' 
    },
    CHANNELS: { 
        STATUS: '1521861880883445842', 
        STAFF: '1521861903436218408' 
    },
    SETTINGS: { 
        GOAL: 6, 
        SERVER_CODE: 'EDGEWATER',
        SSU_DELAY: 120000 // 2 minuti esatti
    }
};

/**
 * SessionData: Mantiene lo stato corrente della votazione in memoria.
 * Utilizziamo un Set per i votantiUnique per garantire l'univocità dei ping.
 */
let sessionData = {
    active: false,
    count: 0,
    voters: [],
    votersUnique: new Set(),
    triggered: false
};

// --- 2. MODULO LOGGING AVANZATO E AUDIT ---
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
    Logger.log(`Bot Firenze RP Online - Versione 10.0.0`);
    client.user.setActivity('Firenze RP | ERLC', { type: ActivityType.Watching });

    const commands = [
        { name: 'votazione', description: 'Avvia la votazione per la SSU' },
        { name: 'sts', description: 'Chiudi immediatamente il server (SSD)' }
    ];

    try {
        await client.application.commands.set(commands);
        Logger.log('Comandi Slash globali registrati correttamente.');
    } catch (err) { 
        Logger.error(`Errore durante la registrazione dei comandi: ${err.message}`); 
    }
});

// --- 4. GESTIONE INTERAZIONI (Main Engine) ---
client.on(Events.InteractionCreate, async (interaction) => {
    
    // --- GESTIONE COMANDI SLASH ---
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.VOTE)) 
                return interaction.reply({ content: '❌ Accesso negato: non hai il ruolo richiesto.', ephemeral: true });

            // Reset stato sessione
            sessionData = { active: true, count: 0, voters: [], votersUnique: new Set(), triggered: false };
            
            const nowUnix = Math.floor(Date.now() / 1000);
            
            const embedVoto = new EmbedBuilder()
                .setTitle('🚓 **VOTAZIONE UFFICIALE FIRP**')
                .setDescription(`Premete il tasto verde per confermare la vostra presenza.\n\n🎯 **Obiettivo:** 6 Voti\n⏱️ **Iniziata:** <t:${nowUnix}:R>`)
                .addFields({ name: '📊 Stato Attuale', value: `0 / 6 VOTI`, inline: false })
                .setColor('#2b2d31')
                .setFooter({ text: 'Firenze RP - Sistema Votazioni' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Premi per votare').setEmoji('✋').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Votazione Prova').setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ content: '@everyone 📢 **Nuova Votazione FIRP!**', embeds: [embedVoto], components: [row] });
            Logger.audit(`Votazione avviata da ${interaction.user.tag}`);
        }

        // --- COMANDO STS (SSD) ---
        if (interaction.commandName === 'sts') {
            await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle('🔴 **SERVER STATUS: OFFLINE (SSD)**')
                    .setDescription('Procedura di chiusura server attivata dallo staff. Il server è ora chiuso.')
                    .setColor('#ff0000')
                    .setTimestamp()] 
            });
            Logger.audit(`SSD forzato da ${interaction.user.tag}`);
        }
    }

    // --- GESTIONE BOTTONI E LOGICA AVANZATA ---
    if (interaction.isButton()) {
        if (!sessionData.active && interaction.customId !== 'btn_ssd') return;

        // --- LOGICA VOTO STANDARD ---
        if (interaction.customId === 'btn_vota') {
            sessionData.count++;
            sessionData.voters.push(interaction.user.id);
            sessionData.votersUnique.add(interaction.user.id);
            
            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .spliceFields(0, 1, { name: '📊 Stato Attuale', value: `${sessionData.count} / 6 VOTI`, inline: false });
            
            await interaction.update({ embeds: [newEmbed] });
        }
        
        // --- LOGICA VOTO PROVA (ADMIN) ---
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) return;
            sessionData.count++;
            sessionData.voters.push(interaction.user.id);
            
            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .spliceFields(0, 1, { name: '📊 Stato Attuale', value: `${sessionData.count} / 6 VOTI (Admin Forzato)`, inline: false });
            
            await interaction.update({ embeds: [newEmbed] });
            Logger.audit(`Admin ${interaction.user.tag} ha forzato un voto.`);
        }

        // --- TRIGGER SSU (RAGGIUNGIMENTO 6 VOTI) ---
        if (sessionData.count >= CONFIG.SETTINGS.GOAL && !sessionData.triggered) {
            sessionData.triggered = true;
            
            // Ping Staff in chat staff
            const staffChannel = client.channels.cache.get(CONFIG.CHANNELS.STAFF);
            if (staffChannel) {
                staffChannel.send(`<@&${CONFIG.ROLES.STAFF_PING}> 🚨 **Allerta SSU:** La votazione è stata completata. Sviluppo server tra 2 minuti.`);
            }

            await interaction.channel.send('@here 🎯 **Voti raggiunti! SSU in preparazione tra 2 minuti.**');

            // Timer preparazione SSU (2 minuti)
            setTimeout(async () => {
                const pingList = Array.from(sessionData.votersUnique).map(id => `<@${id}>`).join(' ');
                
                const embedOn = new EmbedBuilder()
                    .setTitle('🌐 **SERVER ERLC: ONLINE**')
                    .setDescription('La SSU è terminata. Il server di Firenze RP è aperto e accessibile.')
                    .addFields(
                        { name: 'Codice Server', value: `\`${CONFIG.SETTINGS.SERVER_CODE}\``, inline: true },
                        { name: 'Stato', value: '🟢 ONLINE', inline: true }
                    )
                    .setColor('#00ffaa')
                    .setTimestamp();
                
                const rowSsd = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_ssd').setLabel('SSD (Chiudi Server)').setStyle(ButtonStyle.Danger)
                );

                const statusChannel = client.channels.cache.get(CONFIG.CHANNELS.STATUS);
                if (statusChannel) {
                    await statusChannel.send({ 
                        content: `🔔 ${pingList} \nIl server è pronto. Entrate in RP!`, 
                        embeds: [embedOn], 
                        components: [rowSsd] 
                    });
                }
                Logger.log('SSU attivata e notifiche inviate ai votanti.');
            }, CONFIG.SETTINGS.SSU_DELAY);
        }

        // --- LOGICA PULSANTE SSD (CHIUSURA) ---
        if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete();
            await interaction.reply({ content: '🔴 Server chiuso via SSD. Procedura completata.', ephemeral: true });
            Logger.audit(`Server chiuso (SSD) tramite pulsante da ${interaction.user.tag}`);
        }
    }
});

// --- 5. MODULO DI GESTIONE ERRORI E STABILITÀ ---
process.on('uncaughtException', (err) => {
    Logger.error(`Eccezione non gestita rilevata: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error(`Promessa rifiutata non gestita: ${reason}`);
});

// Avvio del bot
client.login(process.env.TOKEN);

/** 
 * NOTE TECNICHE PER LO SVILUPPO:
 * Il codice sopra è stato strutturato per garantire massima efficienza.
 * Per estendere ulteriormente la logica di business:
 * - Aggiungere file di configurazione separati.
 * - Implementare database esterni (MongoDB/SQL).
 * - Creare handlers separati per ogni evento.
 */
