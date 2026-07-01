/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Versione Finale Completa)
 * 
 * LOGICA INTEGRATA:
 * 1. Conteggio unico (Utenti + Admin Prova).
 * 2. Ping Team Staff in CH_STAFF al raggiungimento soglia.
 * 3. Ping Votanti in CH_STATUS all'apertura (SSU).
 * 4. Informativa 4 righe presente in ogni fase (Voto, SSU, SSD).
 * ===================================================================================
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, Events 
} = require('discord.js');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const CONFIG = {
    ROLES: { ADMIN: '1521868096867012728', STAFF_PING: '1521868096867012728' },
    CHANNELS: { STATUS: '1521861880883445842', STAFF: '1521861903436218408' },
    SETTINGS: { GOAL: 6, SERVER_CODE: 'EDGEWATER', SSU_DELAY: 120000 }
};

let session = { active: false, count: 0, voters: new Set(), triggered: false, message: null };

const EmbedFactory = {
    createVoto: (count) => {
        const raggiunto = count >= CONFIG.SETTINGS.GOAL;
        const info = raggiunto 
            ? "• Obiettivo 6/6 raggiunto!\n• SSU in preparazione (2 min).\n• Team Staff avvisato di entrare.\n• Server in avvio automatico."
            : "• Votazione attiva per SSU.\n• Premi il tasto verde per votare.\n• Possibile annullare il voto.\n• Attendiamo il raggiungimento.";
        
        return new EmbedBuilder()
            .setTitle(raggiunto ? '🚓 **OBIETTIVO RAGGIUNTO**' : '🚓 **VOTAZIONE UFFICIALE FIRP**')
            .setDescription(`**Informativa di Stato:**\n${info}`)
            .addFields({ name: '📊 Voti Totali', value: `${count} / ${CONFIG.SETTINGS.GOAL}`, inline: true })
            .setColor(raggiunto ? '#00ff00' : '#2b2d31');
    },
    createSsu: () => new EmbedBuilder()
        .setTitle('🌐 **SERVER ERLC: ONLINE**')
        .setDescription("• Server Firenze RP aperto.\n• Codice: " + CONFIG.SETTINGS.SERVER_CODE + "\n• Rispettare il regolamento.\n• Buona sessione di gioco.")
        .setColor('#00ffaa'),
    createSsd: () => new EmbedBuilder()
        .setTitle('🔴 **SERVER STATUS: CHIUSO**')
        .setDescription("• Sessione di gioco terminata.\n• Server ora offline.\n• Grazie per la partecipazione.\n• Alla prossima sessione.")
        .setColor('#ff0000')
};

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            session = { active: true, count: 0, voters: new Set(), triggered: false, message: null };
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Vota').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Prova').setStyle(ButtonStyle.Primary)
            );
            session.message = await interaction.reply({ embeds: [EmbedFactory.createVoto(0)], components: [row], fetchReply: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'btn_vota') {
            if (session.voters.has(interaction.user.id)) { session.voters.delete(interaction.user.id); session.count--; }
            else { session.voters.add(interaction.user.id); session.count++; }
            
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count)] });
            await interaction.reply({ content: '✅ Voto aggiornato.', ephemeral: true });
        }

        if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) return interaction.reply({ content: '❌ Solo Admin.', ephemeral: true });
            session.count++;
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count)] });
            await interaction.reply({ content: '🛠️ Voto prova aggiunto.', ephemeral: true });
        }

        // Trigger SSU con Ping Staff e Ping Votanti
        if (session.count >= CONFIG.SETTINGS.GOAL && !session.triggered) {
            session.triggered = true;
            
            // Ping Staff
            const staffCh = client.channels.cache.get(CONFIG.CHANNELS.STAFF);
            if (staffCh) staffCh.send(`<@&${CONFIG.ROLES.STAFF_PING}> 🚨 **Soglia raggiunta!** Entrare in gioco per SSU.`);

            setTimeout(async () => {
                if (session.message) session.message.delete().catch(() => {});
                
                // Ping Votanti
                const pingList = Array.from(session.voters).map(id => `<@${id}>`).join(' ');
                const rowSsd = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ssd').setLabel('SSD (Chiudi)').setStyle(ButtonStyle.Danger));
                
                await client.channels.cache.get(CONFIG.CHANNELS.STATUS).send({ 
                    content: `🔔 ${pingList} \nIl server è ONLINE!`, 
                    embeds: [EmbedFactory.createSsu()], 
                    components: [rowSsd] 
                });
            }, CONFIG.SETTINGS.SSU_DELAY);
        }

        if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete().catch(() => {});
            await interaction.reply({ embeds: [EmbedFactory.createSsd()], ephemeral: false });
        }
    }
});

client.login(process.env.TOKEN);
