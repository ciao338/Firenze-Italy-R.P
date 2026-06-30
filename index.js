const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    InteractionType,
    ApplicationCommandOptionType
} = require('discord.js');

// ==========================================
// 1. CONFIGURAZIONE INIZIALE E INTENTS
// ==========================================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

// ID Canali
const CH_RICHIESTA = '1521641905090461837'; // Canale dove usare /richiesta
const CH_STAFF = '1521641929501315375';     // Canale ricezione richieste per lo staff
const CH_RISULTATI = '1521642290421039124'; // Canale esiti (Accettato/Rifiutato)

// ID Ruoli
const RUOLO_STAFF = '1513989681522413638';  // Ruolo che può accettare/rifiutare
const RUOLO_FDO = '1516932333977079999';    // Ruolo che può consultare il database

// ==========================================
// 2. SISTEMA DI DATABASE (RAM)
// ==========================================
// In un progetto futuro, potrai sostituire queste Map() con un vero database come SQLite o MongoDB.
const databaseRP = new Map();       // Salva i cittadini approvati. Chiave: ID Utente
const richiestePendenti = new Map();// Salva le pratiche in corso. Chiave: ID Utente

// ==========================================
// 3. AVVIO DEL BOT E REGISTRAZIONE COMANDI
// ==========================================
client.once('ready', async () => {
    console.log(`[SISTEMA] Connessione stabilita. Bot loggato come ${client.user.tag}`);

    // Definizione dei 3 comandi richiesti
    const comandi = [
        { 
            name: 'richiesta', 
            description: 'Invia la documentazione per richiedere la cittadinanza.' 
        },
        { 
            name: 'portafoglio', 
            description: 'Visualizza i tuoi documenti e la tua posizione RP attuale.' 
        },
        { 
            name: 'database', 
            description: 'Terminale di ricerca per Staff e FdO.',
            options: [
                { 
                    name: 'utente', 
                    type: ApplicationCommandOptionType.User, 
                    description: 'Seleziona l\'utente di cui vuoi controllare i documenti', 
                    required: true 
                }
            ]
        }
    ];

    try {
        await client.application.commands.set(comandi);
        console.log('[SISTEMA] Comandi Slash (/richiesta, /portafoglio, /database) registrati con successo.');
    } catch (error) {
        console.error('[ERRORE] Impossibile registrare i comandi:', error);
    }
});

// ==========================================
// 4. GESTORE DEGLI EVENTI (INTERAZIONI)
// ==========================================
client.on('interactionCreate', async interaction => {
    
    // ----------------------------------------------------
    // A. GESTIONE COMANDI SLASH (Chat Input)
    // ----------------------------------------------------
    if (interaction.isChatInputCommand()) {
        
        // --- COMANDO: /richiesta ---
        if (interaction.commandName === 'richiesta') {
            // Controllo Canale
            if (interaction.channelId !== CH_RICHIESTA) {
                return interaction.reply({ 
                    content: `⛔ **Errore:** Questo comando può essere utilizzato solo in <#${CH_RICHIESTA}>.`, 
                    ephemeral: true 
                });
            }

            // Controllo Anti-Spam / Doppia Richiesta
            if (databaseRP.has(interaction.user.id)) {
                return interaction.reply({ 
                    content: '❌ **Impossibile procedere:** Risulti già registrato nel database cittadino. Usa `/portafoglio` per vedere i tuoi dati.', 
                    ephemeral: true 
                });
            }
            if (richiestePendenti.has(interaction.user.id)) {
                return interaction.reply({ 
                    content: '⏳ **Attenzione:** Hai già una pratica in attesa di revisione da parte dello Staff.', 
                    ephemeral: true 
                });
            }

            // Creazione Modal (Finestra popup)
            const modal = new ModalBuilder()
                .setCustomId('modal_richiesta')
                .setTitle('Modulo Richiesta Cittadinanza');
            
            // Campi della Modal
            const inputNick = new TextInputBuilder()
                .setCustomId('input_nick')
                .setLabel('Nickname Roblox')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Inserisci il tuo nome utente di Roblox')
                .setRequired(true);

            const inputData = new TextInputBuilder()
                .setCustomId('input_data')
                .setLabel('Data di Nascita (RP)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('GG/MM/AAAA')
                .setRequired(true);

            const inputCitt = new TextInputBuilder()
                .setCustomId('input_citt')
                .setLabel('Cittadinanza Richiesta')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Es: Italiana, Americana, ecc.')
                .setRequired(true);

            // Aggiunta dei campi alla Modal
            modal.addComponents(
                new ActionRowBuilder().addComponents(inputNick),
                new ActionRowBuilder().addComponents(inputData),
                new ActionRowBuilder().addComponents(inputCitt)
            );

            await interaction.showModal(modal);
        }

        // --- COMANDO: /portafoglio ---
        if (interaction.commandName === 'portafoglio') {
            const utenteDati = databaseRP.get(interaction.user.id);

            if (!utenteDati) {
                return interaction.reply({ 
                    content: '🪪 **Nessun documento trovato.** Non hai ancora una cittadinanza approvata.', 
                    ephemeral: true 
                });
            }

            const embedPortafoglio = new EmbedBuilder()
                .setTitle('💼 Il Tuo Portafoglio Personale')
                .setColor(0x00A86B)
                .setDescription('Ecco i documenti attualmente registrati a tuo nome nel sistema statale.')
                .addFields(
                    { name: '👤 Nickname Roblox', value: `\`${utenteDati.nick}\``, inline: true },
                    { name: '📅 Data di Nascita', value: utenteDati.data, inline: true },
                    { name: '🌍 Cittadinanza', value: utenteDati.citt, inline: false },
                    { name: '🔢 Codice Identificativo', value: `\`${utenteDati.cf}\``, inline: false }
                )
                .setFooter({ text: 'Ministero dell\'Interno - Sistema Anagrafico' })
                .setTimestamp();

            await interaction.reply({ embeds: [embedPortafoglio], ephemeral: true });
        }

        // --- COMANDO: /database ---
        if (interaction.commandName === 'database') {
            const hasStaffRole = interaction.member.roles.cache.has(RUOLO_STAFF);
            const hasFdoRole = interaction.member.roles.cache.has(RUOLO_FDO);

            // Controllo Permessi (Solo Staff o FdO)
            if (!hasStaffRole && !hasFdoRole) {
                return interaction.reply({ 
                    content: '⛔ **Accesso Negato:** Non hai l\'autorizzazione per accedere al database.', 
                    ephemeral: true 
                });
            }

            const utenteTarget = interaction.options.getUser('utente');
            const targetDati = databaseRP.get(utenteTarget.id);

            if (!targetDati) {
                return interaction.reply({ 
                    content: `❌ L'utente **${utenteTarget.tag}** non è presente nel database.`, 
                    ephemeral: true 
                });
            }

            const embedDatabase = new EmbedBuilder()
                .setTitle('🖥️ Terminale di Ricerca Dati')
                .setColor(0x005A9C) // Blu Polizia/Staff
                .setThumbnail(utenteTarget.displayAvatarURL())
                .setDescription(`Risultati ricerca per: ${utenteTarget}`)
                .addFields(
                    { name: 'Nome Account', value: `\`${targetDati.nick}\``, inline: true },
                    { name: 'Data Nascita', value: targetDati.data, inline: true },
                    { name: 'Cittadinanza', value: targetDati.citt, inline: false },
                    { name: 'Codice Fiscale RP', value: `\`${targetDati.cf}\``, inline: false },
                    { name: 'Stato Pratica', value: '🟢 APPOVATA E VERIFICATA', inline: false }
                )
                .setFooter({ text: `Ricerca effettuata dall'operatore: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.reply({ embeds: [embedDatabase], ephemeral: true });
        }
    }

    // ----------------------------------------------------
    // B. GESTIONE INVIO MODULI (Modal Submit)
    // ----------------------------------------------------
    if (interaction.type === InteractionType.ModalSubmit) {
        
        // Modal Inserimento Dati Cittadinanza
        if (interaction.customId === 'modal_richiesta') {
            const userId = interaction.user.id;
            
            // Estrazione dati dai campi
            const inputNick = interaction.fields.getTextInputValue('input_nick');
            const inputData = interaction.fields.getTextInputValue('input_data');
            const inputCitt = interaction.fields.getTextInputValue('input_citt');

            // Salvataggio Temporaneo
            richiestePendenti.set(userId, {
                nick: inputNick,
                data: inputData,
                citt: inputCitt,
                userTag: interaction.user.tag
            });

            // Creazione Avviso per lo Staff
            const embedStaff = new EmbedBuilder()
                .setTitle('📝 Nuova Richiesta di Cittadinanza')
                .setColor(0xFFA500)
                .setDescription(`L'utente ${interaction.user} ha inviato una nuova pratica.`)
                .addFields(
                    { name: 'Nickname Roblox', value: inputNick, inline: true },
                    { name: 'Data di Nascita', value: inputData, inline: true },
                    { name: 'Cittadinanza', value: inputCitt, inline: false }
                )
                .setTimestamp();

            // Bottoni Accetta/Rifiuta per lo staff
            const rowBottoni = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`accetta_${userId}`)
                    .setLabel('Accetta Pratica')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`rifiuta_${userId}`)
                    .setLabel('Rifiuta Pratica')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

            await client.channels.cache.get(CH_STAFF).send({ 
                embeds: [embedStaff], 
                components: [rowBottoni] 
            });

            await interaction.reply({ 
                content: '✅ **Pratica inviata con successo.** Attendi l\'esito dallo Staff.', 
                ephemeral: true 
            });
        }

        // Modal Motivazione Rifiuto
        if (interaction.customId.startsWith('modal_rifiuto_')) {
            const userId = interaction.customId.split('_')[2];
            const motivo = interaction.fields.getTextInputValue('input_motivo');
            
            const userData = richiestePendenti.get(userId);
            
            const embedRifiuto = new EmbedBuilder()
                .setTitle('🔴 PRATICA RIFIUTATA')
                .setColor(0xFF0000)
                .setDescription(`La richiesta di cittadinanza di <@${userId}> è stata respinta.`)
                .addFields(
                    { name: 'Motivazione dello Staff:', value: `\`\`\`${motivo}\`\`\`` }
                )
                .setFooter({ text: 'Verifica i tuoi dati e compila una nuova richiesta.' });

            // Rimuove la pratica pendente
            richiestePendenti.delete(userId);

            await client.channels.cache.get(CH_RISULTATI).send({ 
                content: `<@${userId}>`, 
                embeds: [embedRifiuto] 
            });

            await interaction.reply({ 
                content: '✅ Il rifiuto è stato registrato e l\'utente è stato avvisato.', 
                ephemeral: true 
            });
        }
    }

    // ----------------------------------------------------
    // C. GESTIONE BOTTONI (Accetta / Rifiuta)
    // ----------------------------------------------------
    if (interaction.isButton()) {
        
        // Controllo per assicurarsi che solo lo staff possa usare i bottoni
        if (!interaction.member.roles.cache.has(RUOLO_STAFF)) {
            return interaction.reply({ 
                content: '⛔ Non sei autorizzato a valutare le pratiche.', 
                ephemeral: true 
            });
        }

        const action = interaction.customId.split('_')[0];
        const targetUserId = interaction.customId.split('_')[1];
        
        const pendingData = richiestePendenti.get(targetUserId);

        if (!pendingData) {
            return interaction.reply({ 
                content: '⚠️ I dati di questa richiesta non sono più validi o sono già stati processati.', 
                ephemeral: true 
            });
        }

        if (action === 'accetta') {
            // Genera un finto codice fiscale / codice identificativo
            const randomID = Math.random().toString(36).substring(2, 8).toUpperCase();
            const cfGenerato = `ID-${randomID}`;

            // 1. INSERIMENTO NEL DATABASE
            databaseRP.set(targetUserId, {
                nick: pendingData.nick,
                data: pendingData.data,
                citt: pendingData.citt,
                cf: cfGenerato
            });

            // 2. RIMOZIONE DALLE PRATICHE PENDENTI
            richiestePendenti.delete(targetUserId);

            // 3. MESSAGGIO DI CONFERMA PUBBLICA
            const embedAccettato = new EmbedBuilder()
                .setTitle('🟢 CITTADINANZA APPROVATA')
                .setColor(0x00FF00)
                .setDescription(`La richiesta di <@${targetUserId}> è stata approvata ed inserita nel Database.`)
                .addFields(
                    { name: 'Nickname Roblox', value: pendingData.nick, inline: true },
                    { name: 'Codice Assegnato', value: `\`${cfGenerato}\``, inline: true }
                )
                .setFooter({ text: 'Ora puoi usare il comando /portafoglio' });

            await client.channels.cache.get(CH_RISULTATI).send({ 
                content: `<@${targetUserId}>`, 
                embeds: [embedAccettato] 
            });

            // 4. AGGIORNO IL MESSAGGIO DELLO STAFF
            await interaction.update({ 
                content: `✅ Pratica approvata da ${interaction.user.tag}`, 
                components: [], // Rimuove i bottoni originali
                embeds: [interaction.message.embeds[0]] 
            });

        } else if (action === 'rifiuta') {
            // Selezionato "Rifiuta": Apro la modal per chiedere la motivazione
            const modalRifiuto = new ModalBuilder()
                .setCustomId(`modal_rifiuto_${targetUserId}`)
                .setTitle('Inserisci la Motivazione');
            
            const inputMotivo = new TextInputBuilder()
                .setCustomId('input_motivo')
                .setLabel('Perché stai rifiutando?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modalRifiuto.addComponents(new ActionRowBuilder().addComponents(inputMotivo));

            // Disattivo il bottone visivamente mentre lo staff compila
            await interaction.message.edit({ 
                content: '⏳ Compilazione del rifiuto in corso...', 
                components: [] 
            });
            
            await interaction.showModal(modalRifiuto);
        }
    }
});

// ==========================================
// 5. CONNESSIONE AL BOT
// ==========================================
client.login(process.env.DISCORD_TOKEN);
