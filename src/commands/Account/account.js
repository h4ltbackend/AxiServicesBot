import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';

const DB_KEY = 'account_giver:stock';

async function getAccounts(db) {
    const accounts = await db.get(DB_KEY, []);
    return Array.isArray(accounts) ? accounts : [];
}

export default {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('Gestion du Account Giver')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Ajouter un compte au stock')
                .addStringOption(option =>
                    option
                        .setName('account')
                        .setDescription('Compte au format email:motdepasse')
                        .setRequired(true)
                )
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription('Voir le nombre de comptes disponibles')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Envoyer le panneau Account Giver')
        ),

    async execute(interaction) {
        const db = interaction.client.db;

        if (!db) {
            return interaction.reply({
                content: '❌ La base de données n’est pas disponible.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // =========================
        // /account add
        // =========================
        if (subcommand === 'add') {
            const account = interaction.options.getString('account', true).trim();

            if (!account.includes(':')) {
                return interaction.reply({
                    content: '❌ Utilise le format `esmail:motdepasse`.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const accounts = await getAccounts(db);

            accounts.push(account);

            await db.set(DB_KEY, accounts);

            return interaction.reply({
                content: `✅ Added Account to stock\n📦 Current stock : **${accounts.length}**`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // =========================
        // /account stock
        // =========================
        if (subcommand === 'stock') {
            const accounts = await getAccounts(db);

            return interaction.reply({
                content: `📦 Theres currently **${accounts.length} compte(s)**.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // =========================
        // /account panel
        // =========================
        if (subcommand === 'panel') {
            const accounts = await getAccounts(db);

            const embed = createEmbed({
                title: '🎁 Account Giver',
                description:
                    'After pressing you will recieve a dm from the bot.',
                color: 'primary',
                fields: [
                    {
                        name: '📦 Available Stock',
                        value: `**${accounts.length}** compte(s)`,
                        inline: false,
                    },
                ],
            });

            const button = {
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 3,
                        label: 'Get Account',
                        emoji: {
                            name: '🎁',
                        },
                        custom_id: 'account_giver_get',
                        disabled: accounts.length === 0,
                    },
                ],
            };

            return interaction.reply({
                embeds: [embed],
                components: [button],
            });
        }
    },
};
