const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Necessario per leggere i membri del server
    ] 
});

// ================= COSTANTI E ID =================
const CH_RICHIESTA = '1521641905090461837'; // Canale invio /richiesta
const CH_STAFF = '1521641929501315375';     // Canale ricezione log staff
const CH_RISULTATI = '1521642290421039124'; // Canale risultati finali
const RUOLO_STAFF = '1513989681522413638';  // Ruolo Staff
const RUOLO_FDO = '1516932333977079999';    // Ruolo Forze dell'Ordine

// ================= MEMORIA (Database Temporaneo) =================
const databaseCittadini = new Map();
const richiestePendenti = new Map();

// ================= AVVIO BOT E REGISTRAZIONE COMANDI =================
client.once('ready', async () => {
    console.log(`[SISTEMA] Bot avviato correttamente come ${client.user.tag}`);

    const comandi = [
        {
            name: 'richiesta',
            description: 'Avvia la pratica per richiedere la cittadinanza.'
        },
        {
            name: 'database',
            description: 'Accedi al terminale di rete (Solo Staff e FdO).'
        },
        {
            name: 'personaggio',
            description: 'Visualizza il tuo documento di identità digitale.'
        }
    ];

    await client.application.commands.set(comandi);
    console.log('[SISTEMA] Comandi Slash sincronizzati.');
});

// ================= GESTIONE EVENTI =================
client.on('interactionCreate', async interaction => {
    
    // ================= 1. COMANDI SLASH =================
    if (interaction.isChatInputCommand()) {
        
        // --- COMANDO: /richiesta ---
        if (interaction.commandName === 'richiesta') {
            if (interaction.channelId !== CH_RICHIESTA) {
                return interaction.reply({ 
                    content: `⚠️ Questo comando è utilizzabile esclusivamente presso gli uffici competenti: <#${CH_RICHIESTA}>.`, 
                    ephemeral: true 
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('modal_cittadinanza')
                .setTitle('🏛️ Modulo Anagrafico Nazionale');
            
            const inputNome = new TextInputBuilder().setCustomId('nome').setLabel('Nome e Cognome In-Game').setStyle(TextInputStyle.Short).setRequired(true);
            const inputDataGenere = new TextInputBuilder().setCustomId('data_genere').setLabel('Data Nascita & Sesso (es. 12/04/1990 - M)').setStyle(TextInputStyle.Short).setRequired(true);
            const inputStato = new TextInputBuilder().setCustomId('stato').setLabel('Stato Civile / Cittadinanza Richiesta').setStyle(TextInputStyle.Short).setRequired(true);
            const inputRobloxName = new TextInputBuilder().setCustomId('roblox_name').setLabel('Nome Utente (Account)').setStyle(TextInputStyle.Short).setRequired(true);
            const inputRobloxScreen = new TextInputBuilder().setCustomId('roblox_screen').setLabel('Link Fototessera Personaggio').setStyle(TextInputStyle.Short).setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputNome),
                new ActionRowBuilder().addComponents(inputDataGenere),
                new ActionRowBuilder().addComponents(inputStato),
                new ActionRowBuilder().addComponents(inputRobloxName),
                new ActionRowBuilder().addComponents(inputRobloxScreen)
            );

            await interaction.showModal(modal);
        }

        // --- COMANDO: /database ---
        if (interaction.commandName === 'database') {
            const isStaff = interaction.member.roles.cache.has(RUOLO_STAFF);
            const isFdo = interaction.member.roles.cache.has(RUOLO_FDO);

            if (!isStaff && !isFdo) {
                return interaction.reply({ content: '⛔ **ACCESSO NEGATO:** Credenziali di rete insufficienti.', ephemeral: true });
            }

            // Database STAFF
            if (isStaff) {
                const totalMembers = interaction.guild.memberCount;
                const botCount = interaction.guild.members.cache.filter(member => member.user.bot).size;
                const humanCount = totalMembers - botCount;

                const embedStaff = new EmbedBuilder()
                    .setAuthor({ name: 'Terminal Amministrazione Globale', iconURL: interaction.guild.iconURL() })
                    .setTitle('🗄️ DATABASE STAFF: Statistiche Server')
                    .setColor(0x2B2D31)
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/825/825590.png')
                    .addFields(
                        { name: '👥 Ingressi Server', value: `Totale Membri: **${totalMembers}**\nUtenti: **${humanCount}** | Bot: **${botCount}**`, inline: false },
                        { name: '📄 Pratiche Cittadinanza', value: `Approvate: **${databaseCittadini.size}**\nIn Attesa: **${richiestePendenti.size}**`, inline: false }
                    )
                    .setFooter({ text: `Amministratore: ${interaction.user.tag}` })
                    .setTimestamp();

                return interaction.reply({ embeds: [embedStaff], ephemeral: true });
            }

            // Database FDO
            if (isFdo) {
                const embedFdo = new EmbedBuilder()
                    .setAuthor({ name: 'SDI - Sistema di Indagine', iconURL: 'https://cdn-icons-png.flaticon.com/512/912/912316.png' })
                    .setTitle('🚓 DATABASE F.D.O: Terminale Operativo')
                    .setColor(0x001A57) // Blu Notte FdO
                    .setDescription('Accesso al database anagrafico della popolazione civile autorizzato.')
                    .addFields(
                        { name: 'Cittadini Schedati', value: `Attualmente vi sono **${databaseCittadini.size}** cittadini con fascicolo attivo.`, inline: false },
                        { name: 'Stato Sistema', value: '🟢 ONLINE - Connesso al CED', inline: true }
                    )
                    .setFooter({ text: `Agente: ${interaction.user.tag} | Tracciamento IP Attivo` })
                    .setTimestamp();

                return interaction.reply({ embeds: [embedFdo], ephemeral: true });
            }
        }

        // --- COMANDO: /personaggio ---
        if (interaction.commandName === 'personaggio') {
            const cittadino = databaseCittadini.get(interaction.user.id);

            if (!cittadino) {
                return interaction.reply({ content: '❌ **Nessun documento trovato.** Il tuo profilo anagrafico non è presente nel database statale.', ephemeral: true });
            }

            const embedID = new EmbedBuilder()
                .setAuthor({ name: 'Repubblica Italiana', iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Emblem_of_Italy.svg/1024px-Emblem_of_Italy.svg.png' })
                .setTitle('CARTA D\'IDENTITÀ ELETTRONICA')
                .setColor(0x00A368) // Verde documentale
                .setThumbnail(cittadino.screen) // Usa il link della fototessera del pg
                .addFields(
                    { name: 'Cognome e Nome', value: `**${cittadino.nome}**`, inline: true },
                    { name: 'Sesso / Nascita', value: `**${cittadino.data_genere}**`, inline: true },
                    { name: 'Cittadinanza', value: `**${cittadino.stato}**`, inline: false },
                    { name: 'Codice Fiscale', value: `\`${cittadino.cf}\``, inline: false },
                    { name: 'Dati OOC', value: `Utente: ${cittadino.robloxName}`, inline: false }
                )
                .setImage('https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Flag_of_Italy.svg/200px-Flag_of_Italy.svg.png') // Bandiera piccola sotto
                .setFooter({ text: 'Ministero dell\'Interno - Valido a fini di identificazione RP' })
                .setTimestamp();

            await interaction.reply({ embeds: [embedID] }); // Reso visibile a tutti nel canale
        }
    }

    // ================= 2. MODAL SUBMIT (Invio Moduli) =================
    if (interaction.type === InteractionType.ModalSubmit) {
        
        // --- RICEZIONE NUOVA RICHIESTA ---
        if (interaction.customId === 'modal_cittadinanza') {
            const userId = interaction.user.id;
            
            richiestePendenti.set(userId, {
                nome: interaction.fields.getTextInputValue('nome'),
                data_genere: interaction.fields.getTextInputValue('data_genere'),
                stato: interaction.fields.getTextInputValue('stato'),
                robloxName: interaction.fields.getTextInputValue('roblox_name'),
                screen: interaction.fields.getTextInputValue('roblox_screen'),
                applicantTag: interaction.user.toString()
            });

            const embedRichiesta = new EmbedBuilder()
                .setAuthor({ name: 'Nuova Istanza Anagrafica', iconURL: 'https://cdn-icons-png.flaticon.com/512/2965/2965879.png' })
                .setColor(0xE67E22)
                .setDescription(`Il cittadino ${interaction.user} ha depositato una nuova richiesta di cittadinanza.`)
                .addFields(
                    { name: 'Dati RP', value: `**Nome:** ${richiestePendenti.get(userId).nome}\n**Nascita:** ${richiestePendenti.get(userId).data_genere}`, inline: true },
                    { name: 'Dati OOC', value: `**Account:** ${richiestePendenti.get(userId).robloxName}`, inline: true },
                    { name: 'Fototessera', value: `[Apri Immagine](${richiestePendenti.get(userId).screen})`, inline: false }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`accetta_${userId}`).setLabel('APPROVA PRATICA').setStyle(ButtonStyle.Success).setEmoji('📑'),
                new ButtonBuilder().setCustomId(`rifiuta_${userId}`).setLabel('RESPINGI PRATICA').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await client.channels.cache.get(CH_STAFF).send({ embeds: [embedRichiesta], components: [row] });
            await interaction.reply({ content: '✅ **Documentazione inviata.** Lo staff analizzerà la pratica a breve.', ephemeral: true });
        }

        // --- RICEZIONE MOTIVO RIFIUTO ---
        if (interaction.customId.startsWith('motivo_rifiuto_')) {
            const userId = interaction.customId.split('_')[2];
            const motivo = interaction.fields.getTextInputValue('motivo_text');
            const dataRichiesta = richiestePendenti.get(userId);

            const embedRifiuto = new EmbedBuilder()
                .setTitle('🔴 PRATICA RESPINTA')
                .setColor(0xED4245)
                .setDescription(`Avviso per l'utente ${dataRichiesta ? dataRichiesta.applicantTag : `<@${userId}>`}. La documentazione fornita non ha superato i controlli.`)
                .addFields({ name: 'Motivazione Ufficiale', value: `\`\`\`${motivo}\`\`\`` })
                .setFooter({ text: 'Rifai la richiesta compilando correttamente i campi.' });

            richiestePendenti.delete(userId); 
            
            await client.channels.cache.get(CH_RISULTATI).send({ content: `<@${userId}>`, embeds: [embedRifiuto] });
            await interaction.reply({ content: 'Rifiuto archiviato. Utente notificato.', ephemeral: true });
        }
    }

    // ================= 3. BOTTONI STAFF =================
    if (interaction.isButton()) {
        if (!interaction.member.roles.cache.has(RUOLO_STAFF)) {
            return interaction.reply({ content: '⛔ **ERRORE:** Autorizzazione di livello Amministrativo richiesta.', ephemeral: true });
        }

        const action = interaction.customId.split('_')[0];
        const userId = interaction.customId.split('_')[1];
        const dataRichiesta = richiestePendenti.get(userId);

        if (!dataRichiesta) {
            return interaction.reply({ content: '⚠️ Impossibile procedere: i dati di questa richiesta non sono più nel buffer.', ephemeral: true });
        }

        if (action === 'accetta') {
            const codiceCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const cfGenerato = `${dataRichiesta.nome.substring(0,3).toUpperCase()}${codiceCode}X`;

            databaseCittadini.set(userId, { ...dataRichiesta, cf: cfGenerato });

            const embedAccettato = new EmbedBuilder()
                .setTitle('🟢 PRATICA APPROVATA')
                .setColor(0x57F287)
                .setDescription(`Congratulazioni ${dataRichiesta.applicantTag}, i tuoi documenti sono pronti.`)
                .addFields(
                    { name: 'Intestatario', value: `**${dataRichiesta.nome}**`, inline: true },
                    { name: 'C.F. Assegnato', value: `\`${cfGenerato}\``, inline: true }
                )
                .setFooter({ text: 'Usa /personaggio per visualizzare la Carta d\'Identità' });

            richiestePendenti.delete(userId);
            
            await interaction.update({ content: '✅ **Pratica approvata con successo.**', components: [], embeds: [interaction.message.embeds[0]] });
            await client.channels.cache.get(CH_RISULTATI).send({ content: `<@${userId}>`, embeds: [embedAccettato] });

        } else if (action === 'rifiuta') {
            const modalRifiuto = new ModalBuilder()
                .setCustomId(`motivo_rifiuto_${userId}`)
                .setTitle('Compila Verbale di Rigetto');
            
            const inputMotivo = new TextInputBuilder()
                .setCustomId('motivo_text')
                .setLabel('Inserire le motivazioni del rifiuto anagrafico')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modalRifiuto.addComponents(new ActionRowBuilder().addComponents(inputMotivo));

            await interaction.message.edit({ content: '⏳ *Compilazione verbale di rigetto in corso...*', components: [] });
            await interaction.showModal(modalRifiuto);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
