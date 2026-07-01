/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Versione Enterprise)
 * 
 * NOTE DI SVILUPPO:
 * 1. Sistema di Toggle (Voto/Annulla) incluso.
 * 2. Gestione Admin per Voti Prova illimitati.
 * 3. Pulizia automatica dei messaggi su SSD e SSU.
 * 4. Struttura modulare per permettere espansioni infinite.
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

// --- CONFIGURAZIONE COSTANTI ---
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
        SERVER_CODE: 'EDGEWATER', 
        SSU_DELAY: 120000 
    }
};

// --- GESTORE SESSIONI (Dati in memoria) ---
let session = {
    active: false,
    count: 0,
    voters: new Set(),
    triggered: false,
    message: null,
    logChannel: null
};

// --- MODULO EMBED FACTORY (Per una grafica più bella) ---
const EmbedFactory = {
    createVoto: (count) => {
        return new EmbedBuilder()
            .setTitle('🚓 **VOTAZIONE UFFICIALE FIRP**')
            .setDescription('Il comando di Firenze RP sta aprendo la città. Premi il tasto verde per votare.')
            .addFields(
                { name: '📊 Stato', value: `${count} / ${CONFIG.SETTINGS.GOAL} Voti`, inline: true },
                { name: '⚡ Modalità', value: 'Toggle (Click per annullare)', inline: true }
            )
            .setColor('#2b2d31')
            .setTimestamp();
    },
    createStatus: (pingList) => {
        return new EmbedBuilder()
            .setTitle('🌐 **SERVER ERLC: ONLINE**')
            .setDescription('La città è aperta. Seguite le direttive dello staff.')
            .addFields({ name: 'Codice:', value: `\`${CONFIG.SETTINGS.SERVER_CODE}\``, inline: true })
            .setColor('#00ffaa');
    }
};

// --- EVENTO READY ---
client.on(Events.ClientReady, async () => {
    console.log(`[BOT] Firenze RP Online. Versione 10.0.0`);
    client.user.setActivity('Firenze RP | ERLC', { type: ActivityType.Watching });
});

// --- ENGINE INTERAZIONI ---
client.on(Events.InteractionCreate, async (interaction) => {
    
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            session = { active: true, count: 0, voters: new Set(), triggered: false, message: null };
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Vota').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Prova').setStyle(ButtonStyle.Primary)
            );

            session.message = await interaction.reply({ 
                embeds: [EmbedFactory.createVoto(0)], 
                components: [row], 
                fetchReply: true 
            });
        }
    }

    // Gestione Bottoni
    if (interaction.isButton()) {
        // Tasto Verde (Voto Toggle)
        if (interaction.customId === 'btn_vota') {
            if (session.voters.has(interaction.user.id)) {
                session.voters.delete(interaction.user.id);
                session.count--;
            } else {
                session.voters.add(interaction.user.id);
                session.count++;
            }
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count)] });
            await interaction.reply({ content: '✅ Voto aggiornato.', ephemeral: true });
        }

        // Tasto Prova (Admin)
        if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) return;
            session.count++;
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count)] });
            await interaction.reply({ content: '🛠️ Voto prova aggiunto.', ephemeral: true });
        }

        // SSD (Chiusura)
        if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete().catch(() => {});
            await interaction.reply({ content: '🔴 Server chiuso.', ephemeral: true });
        }

        // Trigger SSU
        if (session.count >= CONFIG.SETTINGS.GOAL && !session.triggered) {
            session.triggered = true;
            if (session.message) session.message.delete().catch(() => {});
            
            setTimeout(async () => {
                const pingList = Array.from(session.voters).map(id => `<@${id}>`).join(' ');
                const rowSsd = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_ssd').setLabel('SSD (Chiudi)').setStyle(ButtonStyle.Danger)
                );
                
                await client.channels.cache.get(CONFIG.CHANNELS.STATUS).send({ 
                    content: `🔔 ${pingList} \nServer aperto!`, 
                    embeds: [EmbedFactory.createStatus()], 
                    components: [rowSsd] 
                });
            }, CONFIG.SETTINGS.SSU_DELAY);
        }
    }
});

// --- ESPANSIONE FUTURA ---
// Aggiungi qui le funzioni per la gestione dei log file:
// fs.appendFileSync('logs.txt', 'Evento...');
// Aggiungi qui le funzioni per database esterno.
// Aggiungi qui le funzioni per moderazione.

client.login(process.env.TOKEN);
