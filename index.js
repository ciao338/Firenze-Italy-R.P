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
// ⚙️ CONFIGURAZIONE ID (TUTTI CONFIGURATI)
// ==========================================
const ROLE_VOTAZIONE_PERM = '1513989681522413638'; // Chi può usare /votazione
const CH_SERVER_STATUS    = '1521861880883445842'; // Canale Server Status (ON/OFF)
const CH_STAFF_CHAT       = '1521861903436218408'; // Canale chat/log staff
const ROLE_AMMINISTRATORE = '1521868096867012728'; // 🌟 Il tuo ID Amministratore per il tasto blu
const ROLE_STAFF_PING     = '1521868096867012728'; // Ruolo da taggare al raggiungimento dei 6 voti (impostato uguale ad Admin)

// Variabili globali di stato
let voteData = {
    active: false,
    count: 0,
    voters: new Set(),
    triggered: false,
    timeoutId: null
};

// ==========================================
// 🚀 AVVIO E REGISTRAZIONE COMANDI GLOBALI
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
        // Registrazione globale automatica (Funziona ovunque senza bisogno dell'ID Server)
        await client.application.commands.set(commands);
        console.log('| ✅ Comandi Slash caricati globalmente con successo!');
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

            // Timer 20 minuti (Scadenza -> SSD)
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
    // 2. GESTIONE SUI BOTTONI
    // ------------------------------------------
    if (interaction.isButton()) {
        if (!voteData.active) {
            return interaction.reply({ content: '❌ Questa votazione è chiusa o scaduta.', ephemeral: true });
        }

        const userId = interaction.user.id;

        // BOTTONE VERDE (UTENTI REGOLARI - 1 VOTO)
        if (interaction.customId === 'btn_vota') {
            if (voteData.voters.has(userId)) {
                voteData.voters.delete(userId);
                voteData.count--;
            } else {
                voteData.voters.add(userId);
                voteData.count++;
            }
        } 
        
        // BOTTONE BLU (PROVA - SOLO PER IL TUO ID AMMINISTRATORE)
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(ROLE_AMMINISTRATORE)) {
                return interaction.reply({ 
                    content: '❌ Solo gli Amministratori autorizzati possono usare questo tasto.', 
                    ephemeral: true 
                });
            }
            voteData.count++; // Aggiunge voti infiniti per i tuoi test
        }

        // Aggiorna l'Embed con i nuovi voti
        const oldEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .spliceFields(0, 1, { name: 'Voti Attuali', value: `\`\`\`${voteData.count}/6\`\`\``, inline: false });

        await interaction.update({ embeds: [updatedEmbed] });

        // ------------------------------------------
        // 3. SE INVECE RAGGIUNGE I 6 VOTI (PROVA O REALI)
        // ------------------------------------------
        if (voteData.count >= 6 && !voteData.triggered) {
            voteData.triggered = true; 
            voteData.active = false; 

            // Disabilita i pulsanti
            const embedCompletata = EmbedBuilder.from(updatedEmbed)
                .setTitle('⚖️ **VOTAZIONE FIRP** [COMPLETATA]')
                .setColor('#00ff00')
                .setDescription('I voti minimi sono stati raggiunti! Preparazione SSU...');
            
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
            );
            await interaction.message.edit({ embeds: [embedCompletata], components: [disabledRow] });

            // Ping Canale Staff
            const staffChannel = client.channels.cache.get(CH_STAFF_CHAT);
            if (staffChannel) {
                const embedStaff = new EmbedBuilder()
                    .setTitle('🚨 ALLERTA STAFF - SSU IN PREPARAZIONE')
                    .setDescription(`La votazione ha raggiunto i 6 voti.\n\nEntrate in game, la SSU inizierà tra esattamente **1 Minuto**.`)
                    .setColor('#ffaa00')
                    .setTimestamp();

                await staffChannel.send({ content: `<@&${ROLE_STAFF_PING}>`, embeds: [embedStaff] });
            }

            // Timer 1 minuto -> SERVER ON
            setTimeout(async () => {
                const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                if (statusChannel) {
                    const embedServerOn = new EmbedBuilder()
                        .setTitle('🌐 **SERVER STATUS: ONLINE**')
                        .setDescription('Il server è ora ufficialmente **ONLINE** e pronto per l\'RP!\n\nAvviate FiveM e connettetevi subito. Buon divertimento!')
                        .setColor('#00ffaa')
                        .addFields(
                            { name: 'Stato', value: '🟢 `Online`', inline: true },
                            { name: 'Connessione', value: 'Tramite F8', inline: true }
                        )
                        .setTimestamp();

                    await statusChannel.send({ content: '@everyone', embeds: [embedServerOn] });
                }
            }, 60000); 
        }
    }
});

client.login(process.env.TOKEN);
