/**
 * BOT GESTIONE CITTADINANZA RP - VERSIONE 2.0
 * Creato per: Server Roleplay
 * Funzionalità: Richiesta, Approva/Rifiuta, Database FdO/Staff
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, 
    ApplicationCommandOptionType, Partials 
} = require('discord.js');

// Configurazione Client con permessi estesi
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ID Canali e Ruoli (Configurazione)
const CH_RICHIESTA = '1521641905090461837';
const CH_STAFF = '1521641929501315375';
const CH_RISULTATI = '1521642290421039124';
const RUOLO_STAFF = '1513989681522413638';
const RUOLO_FDO = '1516932333977079999';

// Database in memoria (Map)
const dbCittadini = new Map();
const dbRichieste = new Map();

/**
 * Funzione per generare un Codice Fiscale simulato
 * Segue la struttura: 6 lettere (nome/cognome) + 2 numeri (anno) + 1 lettera (mese) + 2 numeri (giorno) + 1 lettera + 3 numeri + 1 lettera
 */
function generaCodiceFiscale() {
    const l = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const n = "0123456789";
    const rand = (s, len) => Array.from({length: len}, () => s[Math.floor(Math.random() * s.length)]).join('');
    return `${rand(l, 6)}${rand(n, 2)}${rand(l, 1)}${rand(n, 2)}${rand(l, 1)}${rand(n, 3)}${rand(l, 1)}`;
}

client.once('ready', async () => {
    console.log('----------------------------------------------------');
    console.log(`[LOG] Bot avviato con successo: ${client.user.tag}`);
    console.log(`[LOG] Connessione al database RAM completata.`);
    console.log('----------------------------------------------------');

    const comandi = [
        { name: 'richiesta', description: 'Avvia la procedura di cittadinanza.' },
        { name: 'portafoglio', description: 'Consulta i tuoi documenti ufficiali.' },
        { 
            name: 'database', 
            description: 'Ricerca cittadino nel registro statale.',
            options: [{ name: 'utente', type: ApplicationCommandOptionType.User, description: 'Utente da cercare', required: true }]
        }
    ];

    await client.application.commands.set(comandi);
});

client.on('interactionCreate', async interaction => {
    
    // 1. GESTIONE COMANDI SLASH
    if (interaction.isChatInputCommand()) {
        
        // COMANDO RICHIESTA
        if (interaction.commandName === 'richiesta') {
            if (dbCittadini.has(interaction.user.id)) return interaction.reply({ content: '❌ Sei già in possesso della cittadinanza.', ephemeral: true });
            if (dbRichieste.has(interaction.user.id)) return interaction.reply({ content: '⏳ Hai già una pratica in sospeso.', ephemeral: true });

            const modal = new ModalBuilder().setCustomId('mod_citt').setTitle('Formulario Cittadinanza');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome_cognome').setLabel('Nome e Cognome').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data_nascita').setLabel('Data di Nascita').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().setCustomId('genere').setLabel('Genere (Maschio/Femmina/Altro)').setStyle(TextInputStyle.Short).setRequired(true),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nick_roblox').setLabel('Nick Roblox').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cittadinanza').setLabel('Stato di provenienza').setStyle(TextInputStyle.Short).setRequired(true))
            );
            await interaction.showModal(modal);
        }

        // COMANDO PORTAFOGLIO
        if (interaction.commandName === 'portafoglio') {
            const d = dbCittadini.get(interaction.user.id);
            if (!d) return interaction.reply({ content: '⚠️ Non risulti registrato nei sistemi statali.', ephemeral: true });
            
            await interaction.reply({ content: `**📁 DOCUMENTAZIONE CITTADINO**\n\n👤 **Nome:** ${d.nome}\n📅 **Data Nascita:** ${d.data}\n⚧️ **Genere:** ${d.genere}\n🎮 **Nick Roblox:** ${d.nick}\n🌍 **Provenienza:** ${d.citt}\n📑 **Codice Fiscale:** \`${d.cf}\``, ephemeral: true });
        }

        // COMANDO DATABASE
        if (interaction.commandName === 'database') {
            if (!interaction.member.roles.cache.has(RUOLO_STAFF) && !interaction.member.roles.cache.has(RUOLO_FDO)) 
                return interaction.reply({ content: '⛔ Permessi insufficienti.', ephemeral: true });
            
            const target = interaction.options.getUser('utente');
            const d = dbCittadini.get(target.id);
            if (!d) return interaction.reply({ content: '❌ Utente non trovato nel database.', ephemeral: true });
            
            await interaction.reply({ content: `**🔎 VERIFICA DATABASE STATALE**\n\nUtente: ${target.tag}\nNome: ${d.nome}\nCF: \`${d.cf}\`\nNick: ${d.nick}`, ephemeral: true });
        }
    }

    // 2. GESTIONE MODAL (INVIO RICHIESTA)
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'mod_citt') {
        const uId = interaction.user.id;
        dbRichieste.set(uId, {
            nome: interaction.fields.getTextInputValue('nome_cognome'),
            data: interaction.fields.getTextInputValue('data_nascita'),
            genere: interaction.fields.getTextInputValue('genere'),
            nick: interaction.fields.getTextInputValue('nick_roblox'),
            citt: interaction.fields.getTextInputValue('cittadinanza')
        });

        await client.channels.cache.get(CH_STAFF).send({
            content: `📢 **Nuova richiesta cittadinanza**\nDa: ${interaction.user}\nNick Roblox: ${dbRichieste.get(uId).nick}`,
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`acc_${uId}`).setLabel('Accetta Pratica').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rif_${uId}`).setLabel('Rifiuta').setStyle(ButtonStyle.Danger)
            )]
        });
        await interaction.reply({ content: '✅ Richiesta inviata allo staff.', ephemeral: true });
    }

    // 3. GESTIONE BOTTONI STAFF
    if (interaction.isButton()) {
        const [azione, uId] = interaction.customId.split('_');
        
        if (azione === 'acc') {
            const data = dbRichieste.get(uId);
            const cf = generaCodiceFiscale();
            dbCittadini.set(uId, { ...data, cf });
            dbRichieste.delete(uId);

            await client.channels.cache.get(CH_RISULTATI).send(
                `🎉 **CITTADINANZA APPROVATA**\n\nUtente: <@${uId}>\nNome: ${data.nome}\nCF: \`${cf}\`\nGenere: ${data.genere}`
            );
            await interaction.update({ content: '✅ Pratica approvata.', components: [] });
        } else if (azione === 'rif') {
            dbRichieste.delete(uId);
            await interaction.update({ content: '❌ Pratica rifiutata.', components: [] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
