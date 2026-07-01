/**
 * ===================================================================================
 * FIRENZE RP - SISTEMA GESTIONE ERLC (Versione Aggiornata)
 * 
 * LOGICA AGGIORNATA:
 * 1. Il messaggio di votazione rimane visibile finché non avviene la SSU.
 * 2. Quando si raggiungono i 6 voti, lo stato dell'embed cambia in "Obiettivo Raggiunto".
 * 3. La pulizia (eliminazione) avviene solo a SSU avvenuta o SSD premuto.
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

// --- FACTORY PER EMBED PROFESSIONALI ---
const EmbedFactory = {
    createVoto: (count, raggiunto) => {
        const color = raggiunto ? '#00ff00' : '#2b2d31';
        const status = raggiunto ? '🎯 OBIETTIVO RAGGIUNTO' : '⏳ IN ATTESA DI VOTI';
        
        return new EmbedBuilder()
            .setTitle('🚓 **VOTAZIONE UFFICIALE FIRP**')
            .setDescription(`Premi il tasto verde per votare o rimuovere il voto.\n\nStatus: ${status}`)
            .addFields(
                { name: '📊 Voti', value: `${count} / ${CONFIG.SETTINGS.GOAL}`, inline: true },
                { name: '🛡️ Info', value: 'Toggle (Click per annullare)', inline: true }
            )
            .setColor(color)
            .setFooter({ text: 'Firenze RP - Sistema Gestione SSU' });
    }
};

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            session = { active: true, count: 0, voters: new Set(), triggered: false, message: null };
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_vota').setLabel('Vota').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_prova').setLabel('Prova').setStyle(ButtonStyle.Primary)
            );

            session.message = await interaction.reply({ 
                embeds: [EmbedFactory.createVoto(0, false)], 
                components: [row], 
                fetchReply: true 
            });
        }
    }

    if (interaction.isButton()) {
        // Tasto Verde
        if (interaction.customId === 'btn_vota') {
            if (session.voters.has(interaction.user.id)) {
                session.voters.delete(interaction.user.id);
                session.count--;
            } else {
                session.voters.add(interaction.user.id);
                session.count++;
            }
            
            const raggiunto = session.count >= CONFIG.SETTINGS.GOAL;
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count, raggiunto)] });
            await interaction.reply({ content: '✅ Stato voto aggiornato.', ephemeral: true });

            // Trigger SSU solo se non è già stato avviato
            if (session.count >= CONFIG.SETTINGS.GOAL && !session.triggered) {
                session.triggered = true;
                
                setTimeout(async () => {
                    // Elimina votazione prima di SSU
                    if (session.message) session.message.delete().catch(() => {});
                    
                    const pingList = Array.from(session.voters).map(id => `<@${id}>`).join(' ');
                    const rowSsd = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('btn_ssd').setLabel('SSD (Chiudi)').setStyle(ButtonStyle.Danger)
                    );
                    
                    await client.channels.cache.get(CONFIG.CHANNELS.STATUS).send({ 
                        content: `🔔 ${pingList} \nServer aperto! Codice: \`${CONFIG.SETTINGS.SERVER_CODE}\``, 
                        components: [rowSsd] 
                    });
                }, CONFIG.SETTINGS.SSU_DELAY);
            }
        }

        // Tasto Prova (Admin)
        if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(CONFIG.ROLES.ADMIN)) return;
            session.count++;
            await session.message.edit({ embeds: [EmbedFactory.createVoto(session.count, session.count >= CONFIG.SETTINGS.GOAL)] });
            await interaction.reply({ content: '🛠️ Voto prova aggiunto.', ephemeral: true });
        }

        // SSD
        if (interaction.customId === 'btn_ssd') {
            await interaction.message.delete().catch(() => {});
            await interaction.reply({ content: '🔴 Server chiuso.', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
