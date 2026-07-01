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
const CH_SERVER_STATUS    = '1521861880883445842'; // Canale dove andrà "Server ON"
const CH_STAFF_CHAT       = '1521861903436218408'; // Canale log staff (arrivo 6 voti)
const ROLE_STAFF          = 'INSERISCI_QUI_ID_RUOLO_STAFF'; // Ruolo staff (ping e voti infiniti)

// Variabili globali per salvare lo stato della votazione in corso
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
    client.user.setActivity('Centrale Firenze RP', { type: 3 }); // "Guardando Centrale Firenze RP"

    // Registrazione automatica del comando Slash
    const commands = [
        {
            name: 'votazione',
            description: 'Avvia la votazione FIRP per aprire il server.',
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('| ✅ Comandi Slash caricati con successo!');
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
            
            // Controllo permessi: solo il ruolo specifico può avviarla
            if (!interaction.member.roles.cache.has(ROLE_VOTAZIONE_PERM)) {
                return interaction.reply({ 
                    content: '❌ Non hai le autorizzazioni per avviare una votazione.', 
                    ephemeral: true 
                });
            }

            // Reset dei dati della votazione per una nuova sessione
            voteData = {
                active: true,
                count: 0,
                voters: new Set(),
                triggered: false,
                timeoutId: null
            };

            // Creazione Embed Grafico Principale
            const embedVotazione = new EmbedBuilder()
                .setTitle('⚖️ **VOTAZIONE FIRP**')
                .setDescription('Votazione ufficiale per decidere l\'entrata in RP.\n\n🎯 **Obiettivo:** 6 voti minimi\n⏱️ **Durata:** Questa votazione scade automaticamente tra 20 minuti.')
                .setColor('#2b2d31') // Colore scuro stile Discord UI
                .addFields(
                    { name: 'Voti Attuali', value: `\`\`\`0/6\`\`\``, inline: false }
                )
                .setFooter({ text: 'Firenze RP - Sistema Votazioni', iconURL: interaction.guild.iconURL() })
                .setTimestamp();

            // Creazione Bottone
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_vota')
                    .setLabel('Vota per il Server')
                    .setEmoji('🔥')
                    .setStyle(ButtonStyle.Success)
            );

            // Risposta iniziale obbligatoria per lo slash command (invisibile)
            await interaction.reply({ content: '✅ Votazione generata con successo!', ephemeral: true });

            // Invio del messaggio ufficiale con ping a @everyone
            const voteMessage = await interaction.channel.send({ 
                content: '@everyone', 
                embeds: [embedVotazione], 
                components: [row] 
            });

            // Impostazione scadenza 20 minuti (1.200.000 ms)
            voteData.timeoutId = setTimeout(async () => {
                if (!voteData.triggered && voteData.active) {
                    voteData.active = false;
                    
                    const embedScaduta = EmbedBuilder.from(embedVotazione)
                        .setTitle('⚖️ **VOTAZIONE FIRP** [SCADUTA]')
                        .setColor('#ff0000') // Rosso
                        .setDescription('La votazione è scaduta senza raggiungere i voti necessari.');
                    
                    // Disabilita il bottone
                    const disabledRow = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(row.components[0]).setDisabled(true)
                    );

                    await voteMessage.edit({ embeds: [embedScaduta], components: [disabledRow] });
                }
            }, 1200000); // 20 min
        }
    }

    // ------------------------------------------
    // 2. GESTIONE CLICK SUL BOTTONE
    // ------------------------------------------
    if (interaction.isButton()) {
        if (interaction.customId === 'btn_vota') {
            
            if (!voteData.active) {
                return interaction.reply({ content: '❌ Questa votazione è chiusa o scaduta.', ephemeral: true });
            }

            const userId = interaction.user.id;
            const isStaff = interaction.member.roles.cache.has(ROLE_STAFF);

            // Logica dei Voti
            if (isStaff) {
                // Lo staff aggiunge infiniti voti per fare prove
                voteData.count++;
            } else {
                // Utente normale: se ha già votato toglie il voto, altrimenti lo aggiunge
                if (voteData.voters.has(userId)) {
                    voteData.voters.delete(userId);
                    voteData.count--;
                } else {
                    voteData.voters.add(userId);
                    voteData.count++;
                }
            }

            // Aggiornamento visivo dell'Embed
            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .spliceFields(0, 1, { name: 'Voti Attuali', value: `\`\`\`${voteData.count}/6\`\`\``, inline: false });

            await interaction.update({ embeds: [updatedEmbed] });

            // ------------------------------------------
            // 3. RAGGIUNGIMENTO SOGLIA (6 VOTI)
            // ------------------------------------------
            if (voteData.count >= 6 && !voteData.triggered) {
                voteData.triggered = true; // Impedisce trigger multipli
                voteData.active = false; // Blocca nuovi voti

                // Aggiorna l'embed a Votazione Completata disabilitando i pulsanti
                const embedCompletata = EmbedBuilder.from(updatedEmbed)
                    .setTitle('⚖️ **VOTAZIONE FIRP** [COMPLETATA]')
                    .setColor('#00ff00') // Verde
                    .setDescription('I voti minimi sono stati raggiunti! Preparazione in corso...');
                
                const disabledRow = new ActionRowBuilder().addComponents(
                    ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true)
                );
                await interaction.message.edit({ embeds: [embedCompletata], components: [disabledRow] });

                // Avviso in chat Staff (Channel ID: CH_STAFF_CHAT)
                const staffChannel = client.channels.cache.get(CH_STAFF_CHAT);
                if (staffChannel) {
                    const embedStaff = new EmbedBuilder()
                        .setTitle('🚨 ALLERTA STAFF - SSU IN PREPARAZIONE')
                        .setDescription(`La votazione ha raggiunto i 6 voti.\n\nRecatevi immediatamente in gioco, la Server Start Up avverrà tra esattamente **1 Minuto**.`)
                        .setColor('#ffaa00') // Arancione avviso
                        .setTimestamp();

                    await staffChannel.send({ content: `<@&${ROLE_STAFF}>`, embeds: [embedStaff] });
                }

                // Timer 1 minuto per annuncio "Server ON" (60.000 ms)
                setTimeout(async () => {
                    const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                    if (statusChannel) {
                        const embedServerOn = new EmbedBuilder()
                            .setTitle('🌐 **SERVER STATUS: ONLINE**')
                            .setDescription('Il server è ora ufficialmente **ONLINE** e pronto per l\'RP!\n\nAvviate FiveM e connettetevi ora. Vi auguriamo un buon Roleplay!')
                            .setColor('#00ffaa') // Verde fluo
                            .setImage('https://i.imgur.com/8JhZ4tQ.png') // Inserisci qui l'URL di un bel banner di Firenze RP se lo hai
                            .addFields(
                                { name: 'Stato', value: '🟢 `Online`', inline: true },
                                { name: 'Connessione', value: 'Tramite F8 o lista server', inline: true }
                            )
                            .setFooter({ text: 'Firenze RP - Gestione Server' })
                            .setTimestamp();

                        await statusChannel.send({ content: '@everyone', embeds: [embedServerOn] });
                    }
                }, 60000); // 1 minuto
            }
        }
    }
});

// Avvio Bot (Ricordati che nel file .env devi avere: TOKEN=il_tuo_token)
client.login(process.env.TOKEN);
