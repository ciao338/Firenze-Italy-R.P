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
// ⚙️ CONFIGURAZIONE ID
// ==========================================
const ROLE_VOTAZIONE_PERM = '1513989681522413638'; // Chi può usare /votazione
const CH_SERVER_STATUS    = '1521861880883445842'; // Canale Server Status (ON/OFF)
const CH_STAFF_CHAT       = '1521861903436218408'; // Canale chat/log staff
const ROLE_AMMINISTRATORE = '1521868096867012728'; // Tasto blu prova
const ROLE_STAFF_PING     = '1521868096867012728'; // Ruolo staff da avvisare

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
    client.user.setActivity('Roblox ERLC | Firenze RP', { type: 3 });

    const commands = [
        {
            name: 'votazione',
            description: 'Avvia la votazione FIRP per aprire il server ERLC.',
        }
    ];

    try {
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
    // 1. COMANDO SLASH: /votazione
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
                .setTitle('🚓 **VOTAZIONE UFFICIALE FIRP** 🚑')
                .setDescription(`Benvenuti alla votazione per l'apertura del server **Emergency Response: Liberty County**!\n\nPremi il tasto verde qui sotto per confermare la tua presenza. Se raggiungiamo la quota minima, lo Staff aprirà il server.\n\n🎯 **Obiettivo Minimo:** 6 Voti\n▶️ **Iniziata:** <t:${nowUnix}:R>\n⏱️ **Scadenza:** <t:${expireUnix}:R> (Tra 20 minuti)`)
                .setColor('#2b2d31')
                .addFields(
                    { name: '📊 Stato Attuale', value: `\`\`\`0 / 6 VOTI\`\`\``, inline: false }
                )
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Roblox_logo.svg/1200px-Roblox_logo.svg.png') // Logo di default, cambialo con quello di FIRP se vuoi
                .setFooter({ text: 'Firenze RP - Sistema Votazioni ERLC', iconURL: interaction.guild.iconURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_vota')
                    .setLabel('Premi per votare')
                    .setEmoji('✋')
                    .setStyle(ButtonStyle.Success),
                
                new ButtonBuilder()
                    .setCustomId('btn_prova')
                    .setLabel('Votazione Prova')
                    .setStyle(ButtonStyle.Primary) 
            );

            await interaction.reply({ content: '✅ Votazione per ERLC generata con successo!', ephemeral: true });

            const voteMessage = await interaction.channel.send({ 
                content: '@everyone 📢 **Nuova Votazione FIRP!**', 
                embeds: [embedVotazione], 
                components: [row] 
            });

            // Timer Scadenza (SSD)
            voteData.timeoutId = setTimeout(async () => {
                if (!voteData.triggered && voteData.active) {
                    voteData.active = false;
                    
                    const embedScaduta = EmbedBuilder.from(embedVotazione)
                        .setTitle('🛑 **VOTAZIONE FIRP ANNULLATA**')
                        .setColor('#ff0000')
                        .setDescription('La votazione è scaduta. Non abbiamo raggiunto abbastanza giocatori per avviare l\'RP.');
                    
                    const disabledRow = new ActionRowBuilder().addComponents(
                        ButtonBuilder.from(row.components[0]).setDisabled(true),
                        ButtonBuilder.from(row.components[1]).setDisabled(true)
                    );

                    await voteMessage.edit({ embeds: [embedScaduta], components: [disabledRow] });

                    const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                    if (statusChannel) {
                        const embedSsd = new EmbedBuilder()
                            .setTitle('🔴 **SERVER STATUS: OFFLINE (SSD)**')
                            .setDescription('Purtroppo la votazione non è andata a buon fine.\nIl server privato di **ERLC** rimarrà chiuso (SSD attiva).')
                            .setColor('#ff0000')
                            .setTimestamp();
                        
                        await statusChannel.send({ embeds: [embedSsd] });
                    }
                }
            }, 1200000); 
        }
    }

    // ------------------------------------------
    // 2. GESTIONE DEI VOTI SUI BOTTONI
    // ------------------------------------------
    if (interaction.isButton()) {
        if (!voteData.active) {
            return interaction.reply({ content: '❌ Questa votazione è chiusa o scaduta.', ephemeral: true });
        }

        const userId = interaction.user.id;

        if (interaction.customId === 'btn_vota') {
            if (voteData.voters.has(userId)) {
                voteData.voters.delete(userId);
                voteData.count--;
            } else {
                voteData.voters.add(userId);
                voteData.count++;
            }
        } 
        else if (interaction.customId === 'btn_prova') {
            if (!interaction.member.roles.cache.has(ROLE_AMMINISTRATORE)) {
                return interaction.reply({ 
                    content: '❌ Solo gli Amministratori possono forzare i voti.', 
                    ephemeral: true 
                });
            }
            voteData.count++; 
        }

        const oldEmbed = interaction.message.embeds[0];
        const updatedEmbed = EmbedBuilder.from(oldEmbed)
            .spliceFields(0, 1, { name: '📊 Stato Attuale', value: `\`\`\`${voteData.count} / 6 VOTI\`\`\``, inline: false });

        await interaction.update({ embeds: [updatedEmbed] });

        // ------------------------------------------
        // 3. SUCCESSO VOTAZIONE E SSU
        // ------------------------------------------
        if (voteData.count >= 6 && !voteData.triggered) {
            voteData.triggered = true; 
            voteData.active = false; 

            // 1. Aggiorna il messaggio originale per disabilitare i bottoni
            const embedCompletata = EmbedBuilder.from(updatedEmbed)
                .setTitle('✅ **VOTAZIONE FIRP COMPLETATA**')
                .setColor('#00ff00')
                .setDescription('Abbiamo raggiunto il numero necessario di giocatori!\nLo Staff sta attualmente avviando il server privato e preparando la SSU.');
            
            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
                ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true)
            );
            await interaction.message.edit({ embeds: [embedCompletata], components: [disabledRow] });

            // 2. Ping @here nel canale della votazione per avvisare tutti del traguardo
            await interaction.channel.send({
                content: '@here 🎉 **Voti raggiunti!** SSU in preparazione, tenetevi pronti su Roblox!'
            });

            // 3. Ping nel canale privato dello Staff
            const staffChannel = client.channels.cache.get(CH_STAFF_CHAT);
            if (staffChannel) {
                const embedStaff = new EmbedBuilder()
                    .setTitle('🚨 ALLERTA STAFF - AVVIO SSU')
                    .setDescription(`La votazione è andata a buon fine.\n\nEntrate su **ERLC**, prendete servizio e preparate le stazioni. La SSU pubblica inizierà tra esattamente **1 Minuto**.`)
                    .setColor('#ffaa00')
                    .setTimestamp();

                await staffChannel.send({ content: `<@&${ROLE_STAFF_PING}>`, embeds: [embedStaff] });
            }

            // 4. Timer 1 minuto per Annuncio Server ON
            setTimeout(async () => {
                const statusChannel = client.channels.cache.get(CH_SERVER_STATUS);
                if (statusChannel) {
                    
                    // Crea il blocco di ping per tutti quelli che hanno votato
                    const votersArray = Array.from(voteData.voters);
                    let pingVoters = votersArray.length > 0 
                        ? `🔔 ${votersArray.map(id => `<@${id}>`).join(' ')} \nIl server è pronto per voi! Entrate in RP!`
                        : `🔔 **Il server è pronto! Entrate tutti in RP!**`;

                    const embedServerOn = new EmbedBuilder()
                        .setTitle('🌐 **SERVER ERLC: ONLINE**')
                        .setDescription('La città di Firenze vi aspetta. Rispettate sempre il Fear RP, seguite le regole del server e buon divertimento a tutti!')
                        .setColor('#00ffaa')
                        .addFields(
                            { name: 'Stato', value: '🟢 `Online e Aperto`', inline: true },
                            { name: 'Piattaforma', value: 'Roblox - ERLC', inline: true },
                            { name: 'Codice Server', value: '`INSERISCI_CODICE`', inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: 'Firenze RP - Server Status' });

                    await statusChannel.send({ content: pingVoters, embeds: [embedServerOn] });
                }
            }, 60000); 
        }
    }
});

client.login(process.env.TOKEN);
