/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Versione Informativa)
 * 
 * STATI DI SISTEMA (Visualizzati in tempo reale):
 * 1. VOTAZIONE: In attesa di partecipanti per avvio SSU.
 * 2. OBIETTIVO RAGGIUNTO: Soglia superata, SSU in fase di preparazione (2 min).
 * 3. SSU: Server aperto, sessione di gioco attiva, pronti per il roleplay.
 * 4. SSD: Server chiuso, sessione terminata, pulizia dati completata.
 * ===================================================================================
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, Events 
} = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const CONFIG = {
    ROLES: { ADMIN: '1521868096867012728' },
    CHANNELS: { STATUS: '1521861880883445842', STAFF: '1521861903436218408' },
    SETTINGS: { GOAL: 6, SERVER_CODE: 'EDGEWATER', SSU_DELAY: 120000 }
};

let session = { active: false, count: 0, voters: new Set(), triggered: false, message: null };

// --- FACTORY CON INFORMATIVA DI STATO ---
const EmbedFactory = {
    createVoto: (count, raggiunto) => {
        const infoStato = raggiunto 
            ? "• Obiettivo 6/6 raggiunto.\n• SSU in preparazione (2 min).\n• Server in avvio automatico.\n• Attendere notifica di apertura."
            : "• Votazione attiva per SSU.\n• Premi il tasto verde per votare.\n• Possibile annullare il voto.\n• Attendiamo il raggiungimento.";

        return new EmbedBuilder()
            .setTitle(raggiunto ? '🚓 **OBIETTIVO RAGGIUNTO**' : '🚓 **VOTAZIONE UFFICIALE FIRP**')
            .setDescription(`**Informativa di Stato:**\n${infoStato}`)
            .addFields({ name: '📊 Voti Attuali', value: `${count} / ${CONFIG.SETTINGS.GOAL}`, inline: true })
            .setColor(raggiunto ? '#00ff00' : '#2b2d31');
    },
    createSsu: () => new EmbedBuilder().setTitle('🌐 **SERVER ERLC: ONLINE**').setDescription("• Server Firenze RP aperto.\n• Codice: " + CONFIG.SETTINGS.SERVER_CODE + "\n• Rispettare il regolamento.\n• Buona sessione di gioco.").setColor('#00ffaa'),
    createSsd: () => new EmbedBuilder().setTitle('🔴 **SERVER STATUS: CHIUSO**').setDescription("• Sessione di gioco terminata.\n• Server ora offline.\n• Grazie per la partecipazione.\n• Alla prossima sessione.").setColor('#ff0000')
};

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            session = { active: true, count: 0, voters: new Set(), triggered: false, message: null };
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Vota').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Prova').setStyle(ButtonStyle.Primary)
            );
            session.message = await interaction.reply({ embeds: [EmbedFactory.createVoto(0, false)], components: [row], fetchReply: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_vota') {
            if (session.voters.has(interaction.user.id)) { session.voters.delete(interaction.user.id); session.count--; }
            else { session.voters.add(interaction.user.id); session.count++; }
            
            const raggiunto = session.count >= CONFIG.SETTINGS.GOAL;
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count, raggiunto)] });
            await interaction.reply({ content: '✅ Voto aggiornato.', ephemeral: true });

            if (raggiunto && !session.triggered) {
                session.triggered = true;
                setTimeout(async () => {
                    if (session.message) session.message.delete().catch(() => {});
                    const rowSsd = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ssd').setLabel('SSD (Chiudi)').setStyle(ButtonStyle.Danger));
                    await client.channels.cache.get(CONFIG.CHANNELS.STATUS).send({ embeds: [EmbedFactory.createSsu()], components: [rowSsd] });
                }, CONFIG.SETTINGS.SSU_DELAY);
            }
        }

        if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) return;
            session.count++;
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count, session.count >= CONFIG.SETTINGS.GOAL)] });
            await interaction.reply({ content: '🛠️ Voto prova aggiunto.', ephemeral: true });
        }

        if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete().catch(() => {});
            await interaction.reply({ embeds: [EmbedFactory.createSsd()], ephemeral: false });
        }
    }
});

client.login(process.env.TOKEN);
