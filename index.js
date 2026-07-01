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
// ⚙️ CONFIGURAZIONE ID E VARIABILI (INSERISCI I TUOI ID QUI)
// ==========================================
const ROLE_VOTAZIONE_PERM = '1513989681522413638'; // Chi può usare il comando /votazione
const CH_SERVER_STATUS    = '1521861880883445842'; // Canale Server Status (ON/OFF)
const CH_STAFF_CHAT       = '1521861903436218408'; // Canale chat/log staff

// 👇 INSERISCI I TRE ID MANCANTI QUI SOTTO 👇
const ROLE_AMMINISTRATORE = 'INSERISCI_ID_RUOLO_AMMINISTRATORE'; // Ruolo che può cliccare il tasto blu di prova
const ROLE_STAFF_PING     = 'INSERISCI_ID_RUOLO_STAFF_DA_PINGARE'; // Ruolo staff che viene taggato al raggiungimento dei voti
const SERVER_ID           = 'INSERISCI_ID_DEL_TUO_SERVER';         // ID del tuo server Discord

// Variabili globali di stato
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

            const nowUnix = Math.floor(Date.now() / 1000);
            const expireUnix = nowUnix + (20 * 60); 

            const embedVotazione = new EmbedBuilder()
                .setTitle('⚖️ **VOTAZIONE FIRP**')
                .setDescription(`Votazione ufficiale per decidere l'entrata in RP.\n\n🎯 **Obiettivo:** 6 voti minimi\n▶️ **Attivata:** <t:${nowUnix}:R>\n⏱️ **Scadenza:** <t:${expireUnix}:R> (Tra 20 minuti)`)
                .setColor('#2b2d31')
                .addFields(
                    { name: 'Voti Attuali', value: `\`\`\`0/6\`\`\``, inline: false }
                )
                .setFooter({ text: 'Firenze RP - Sistema Votazioni', iconURL: interaction.guild.iconURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_vota')
                    .setLabel('Premi per votare')
                    .setStyle(ButtonStyle.Success),
                
                new ButtonBuilder()
                    .setCustomId('btn_prova')
                    .setLabel('Votazione Prova')
                    .setStyle(ButtonStyle.Primary) // Tasto Blu
            );

            await interaction.reply({ content: '✅ Votazione generata con successo!', ephemeral: true });

            const voteMessage = await interaction.channel.send({ 
                content: '@everyone', 
                embeds: [embedVotazione], 
                components: [row] 
            });

            // Gestione Scadenza dei 20 minuti
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
            }, 1200000); 
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

        // BOTTONE VERDE (UTENTI REGOLARI - 1 VOTO A TESTA)
        if (interaction.customId === 'btn_vota') {
            if (voteData.voters.has(userId)) {
                voteData.voters.delete(userId);
                voteData.count--;
            } else {
                voteData.voters.add(userId);
                voteData.count++;
            }
        } 
        
        // BOTTONE BLU (SOLO RUOLO AMMINISTRATORE - VOTI INFINITI PER TEST)
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(ROLE_AMMINISTRATORE)) {
                return interaction.reply({ 
                    content: '❌ Solo gli Amministratori autorizzati possono premere questo tasto di prova.', 
                    ephemeral: true 
                });
            }
            // Incrementa direttamente senza vincoli di ID utente
            voteData.count++;
        }

        // Aggiornamento grafico in tempo reale dei voti sul canale
        const oldEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .spliceFields(0, 1, { name: 'Voti Attuali', value: `\`\`\`${voteData.count}/6\`\`\``, inline: false });

        await interaction.update({ embeds: [updatedEmbed] });

        // ------------------------------------------
        // 3. RAGGIUNGIMENTO 6 VOTI (START PROCEDURE)
        // ------------------------------------------
        if (voteData.count >= 6 && !voteData.triggered) {
            voteData.triggered = true; 
            voteData.active = false; 

            // Blocca i bottoni sul messaggio originale
            const embedCompletata = EmbedBuilder.from(updatedEmbed)
                .setTitle('⚖️ **VOTAZIONE FIRP** [COMPLETATA]')
                .setColor('#00ff00')
                .setDescription('I voti minimi sono stati raggiunti! Preparazione SSU in corso...');
            
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
            );
            await interaction.message.edit({ embeds: [embedCompletata], components: [disabledRow] });

            // Invia il log nel canale Staff taggando il ruolo Staff configurato
            const staffChannel = client.channels.cache.get(CH_STAFF_CHAT);
            if (staffChannel) {
                const embedStaff = new EmbedBuilder()
                    .setTitle('🚨 ALLERTA STAFF - SSU IN PREPARAZIONE')
                    .setDescription(`La votazione ha raggiunto i voti necessari.\n\nRecatevi in gioco, la Server Start Up (SSU) inizierà tra esattamente **1 Minuto**.`)
                    .setColor('#ffaa00')
                    .setTimestamp();

                await staffChannel.send({ content: `<@&${ROLE_STAFF_PING}>`, embeds: [embedStaff] });
            }

            // Attesa di 1 minuto (60.000 ms) prima di lanciare il SERVER ON
            setTimeout(async () => {
                const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                if (statusChannel) {
                    const embedServerOn = new EmbedBuilder()
                        .setTitle('🌐 **SERVER STATUS: ONLINE**')
                        .setDescription('Il server è ora ufficialmente **ONLINE** e pronto per l\'RP!\n\nAvviate FiveM e connettetevi subito. Buon divertimento!')
                        .setColor('#00ffaa')
                        .addFields(
                            { name: 'Stato', value: '🟢 `Online`', inline: true },
                            { name: 'Connessione', value: 'Tramite F8 / Lista server', inline: true }
                        )
                        .setTimestamp();

                    await statusChannel.send({ content: '@everyone', embeds: [embedServerOn] });
                }
            }, 60000); 
        }
    }
});

client.login(process.env.TOKEN);
