const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// ⚙️ CONFIGURAZIONE ID E VARIABILI
// ==========================================
const ROLE_VOTAZIONE_PERM = '1513989681522413638'; // Chi può usare /votazione
const CH_SERVER_STATUS    = '1521861880883445842'; // Canale Server Status (ON/OFF)
const CH_STAFF_CHAT       = '1521861903436218408'; // Canale log staff
const ROLE_STAFF          = 'INSERISCI_QUI_ID_RUOLO_STAFF'; // Ruolo staff (per il tasto prova)
const SERVER_ID           = 'INSERISCI_QUI_ID_DEL_TUO_SERVER'; // ID del Server per caricamento istantaneo

// Variabili globali per salvare lo stato della votazione
let voteData = {
    active: false,
    count: 0,
    voters: new Set(),
    triggered: false,
    timeoutId: null
};

// ==========================================
// 🚀 AVVIO E REGISTRAZIONE SLASH COMMANDS
// ==========================================
client.once('ready', async () => {
    console.log(`| 🟢 Bot Firenze RP Online come ${client.user.tag}`);
    client.user.setActivity('Centrale Firenze RP', { type: 3 });

    const commands = [
        {
            name: 'votazione',
            description: 'Avvia la votazione FIRP per aprire il server.',
        }
    ];

    try {
        const serverFirenze = await client.guilds.fetch(SERVER_ID);
        await serverFirenze.commands.set(commands);
        console.log('| ✅ Comandi Slash caricati ISTANTANEAMENTE nel server!');
    } catch (error) {
        console.error('| ❌ Errore caricamento comandi Slash:', error);
    }
});

// ==========================================
// 💬 GESTIONE COMANDI E BOTTONI
// ==========================================
client.on('interactionCreate', async (interaction) => {
    
    // ------------------------------------------
    // 1. GESTIONE COMANDO SLASH: /votazione
    // ------------------------------------------
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'votazione') {
            
            if (!interaction.member.roles.cache.has(ROLE_VOTAZIONE_PERM)) {
                return interaction.reply({ 
                    content: '❌ Non hai le autorizzazioni per avviare una votazione.', 
                    ephemeral: true 
                });
            }

            voteData = {
                active: true,
                count: 0,
                voters: new Set(),
                triggered: false,
                timeoutId: null
            };

            // Calcolo dei Timestamp per i timer dinamici di Discord
            const nowUnix = Math.floor(Date.now() / 1000);
            const expireUnix = nowUnix + (20 * 60); // 20 minuti in secondi

            const embedVotazione = new EmbedBuilder()
                .setTitle('⚖️ **VOTAZIONE FIRP**')
                .setDescription(`Votazione ufficiale per decidere l'entrata in RP.\n\n🎯 **Obiettivo:** 6 voti minimi\n▶️ **Attivata:** <t:${nowUnix}:R>\n⏱️ **Scadenza:** <t:${expireUnix}:R> (Tra 20 minuti)`)
                .setColor('#2b2d31')
                .addFields(
                    { name: 'Voti Attuali', value: `\`\`\`0/6\`\`\``, inline: false }
                )
                .setFooter({ text: 'Firenze RP - Sistema Votazioni', iconURL: interaction.guild.iconURL() });

            // Creazione Bottoni (Utenti + Tasto Prova Staff)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_vota')
                    .setLabel('Premi per votare')
                    .setStyle(ButtonStyle.Success), // Verde, senza emoji
                
                new ButtonBuilder()
                    .setCustomId('btn_prova')
                    .setLabel('Votazione Prova')
                    .setStyle(ButtonStyle.Primary) // Blu
            );

            await interaction.reply({ content: '✅ Votazione generata con successo!', ephemeral: true });

            const voteMessage = await interaction.channel.send({ 
                content: '@everyone', 
                embeds: [embedVotazione], 
                components: [row] 
            });

            // ------------------------------------------
            // GESTIONE SCADENZA (TIMER A 0 = SSD)
            // ------------------------------------------
            voteData.timeoutId = setTimeout(async () => {
                if (!voteData.triggered && voteData.active) {
                    voteData.active = false;
                    
                    const embedScaduta = EmbedBuilder.from(embedVotazione)
                        .setTitle('⚖️ **VOTAZIONE FIRP** [SCADUTA]')
                        .setColor('#ff0000')
                        .setDescription('La votazione è scaduta senza raggiungere i voti necessari.');
                    
                    const disabledRow = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(row.components[0]).setDisabled(true),
                        ButtonBuilder.from(row.components[1]).setDisabled(true)
                    );

                    await voteMessage.edit({ embeds: [embedScaduta], components: [disabledRow] });

                    // Annuncio SSD / Server OFF nel canale status
                    const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                    if (statusChannel) {
                        const embedSsd = new EmbedBuilder()
                            .setTitle('🔴 **SERVER STATUS: OFFLINE (SSD)**')
                            .setDescription('La votazione è terminata senza successo.\nIl server rimarrà **OFFLINE** (SSD attiva).')
                            .setColor('#ff0000')
                            .setTimestamp();
                        
                        await statusChannel.send({ embeds: [embedSsd] });
                    }
                }
            }, 1200000); // 20 minuti
        }
    }

    // ------------------------------------------
    // 2. GESTIONE CLICK SUI BOTTONI
    // ------------------------------------------
    if (interaction.isButton()) {
        if (!voteData.active) {
            return interaction.reply({ content: '❌ Questa votazione è chiusa o scaduta.', ephemeral: true });
        }

        const userId = interaction.user.id;

        // BOTTONE NORMALE
        if (interaction.customId === 'btn_vota') {
            if (voteData.voters.has(userId)) {
                voteData.voters.delete(userId);
                voteData.count--;
            } else {
                voteData.voters.add(userId);
                voteData.count++;
            }
        } 
        
        // BOTTONE BLU DI PROVA (SOLO STAFF)
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(ROLE_STAFF)) {
                return interaction.reply({ content: '❌ Solo lo Staff può usare il tasto di prova.', ephemeral: true });
            }
            // Aggiunge un voto senza registrare l'utente, così lo staff può cliccarlo più volte
            voteData.count++;
        }

        // Aggiornamento grafico del messaggio
        const oldEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .spliceFields(0, 1, { name: 'Voti Attuali', value: `\`\`\`${voteData.count}/6\`\`\``, inline: false });

        await interaction.update({ embeds: [updatedEmbed] });

        // ------------------------------------------
        // 3. RAGGIUNGIMENTO SOGLIA (6 VOTI) - SERVER ON
        // ------------------------------------------
        if (voteData.count >= 6 && !voteData.triggered) {
            voteData.triggered = true; 
            voteData.active = false; 

            // Disabilita bottoni
            const embedCompletata = EmbedBuilder.from(updatedEmbed)
                .setTitle('⚖️ **VOTAZIONE FIRP** [COMPLETATA]')
                .setColor('#00ff00')
                .setDescription('I voti minimi sono stati raggiunti! Preparazione in corso...');
            
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
            );
            await interaction.message.edit({ embeds: [embedCompletata], components: [disabledRow] });

            // Avviso Chat Staff
            const staffChannel = client.channels.cache.get(CH_STAFF_CHAT);
            if (staffChannel) {
                const embedStaff = new EmbedBuilder()
                    .setTitle('🚨 ALLERTA STAFF - SSU IN PREPARAZIONE')
                    .setDescription(`La votazione ha raggiunto i 6 voti.\nRecatevi immediatamente in gioco, la Server Start Up avverrà tra **1 Minuto**.`)
                    .setColor('#ffaa00')
                    .setTimestamp();

                await staffChannel.send({ content: `<@&${ROLE_STAFF}>`, embeds: [embedStaff] });
            }

            // Attesa di 1 minuto per mandare SERVER ON
            setTimeout(async () => {
                const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                if (statusChannel) {
                    const embedServerOn = new EmbedBuilder()
                        .setTitle('🌐 **SERVER STATUS: ONLINE**')
                        .setDescription('Il server è ora ufficialmente **ONLINE** e pronto per l\'RP!\n\nAvviate FiveM e connettetevi ora.')
                        .setColor('#00ffaa')
                        .addFields(
                            { name: 'Stato', value: '🟢 `Online`', inline: true },
                            { name: 'Connessione', value: 'Tramite F8', inline: true }
                        )
                        .setTimestamp();

                    await statusChannel.send({ content: '@everyone', embeds: [embedServerOn] });
                }
            }, 60000); // 1 minuto
        }
    }
});

client.login(process.env.TOKEN);
