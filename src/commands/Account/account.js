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
        .setDescription('Manage the Account Giver')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // /account add
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a single account to the stock')
                .addStringOption(option =>
                    option
                        .setName('account')
                        .setDescription('Account in username:password format')
                        .setRequired(true)
                )
        )

        // /account import
        .addSubcommand(subcommand =>
            subcommand
                .setName('import')
                .setDescription('Import a complete account file')
                .addAttachmentOption(option =>
                    option
                        .setName('file')
                        .setDescription('TXT file containing username:password per line')
                        .setRequired(true)
                )
        )

        // /account stock
        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription('Check the current account stock')
        )

        // /account panel
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Create the Account Giver panel')
        ),

    async execute(interaction) {
        const db = interaction.client.db;

        if (!db) {
            return interaction.reply({
                content: '❌ Database unavailable.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // =========================
        // IMPORT FILE
        // =========================
        if (subcommand === 'import') {
            const file = interaction.options.getAttachment('file');

            if (!file) {
                return interaction.reply({
                    content: '❌ No file was provided.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (
                file.contentType &&
                !file.contentType.includes('text/plain')
            ) {
                return interaction.reply({
                    content: '❌ The file must be a .txt file.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            try {
                const response = await fetch(file.url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const text = await response.text();

                const importedAccounts = text
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => {
                        if (!line) return false;

                        // Expected format: username:password
                        return line.includes(':');
                    });

                if (importedAccounts.length === 0) {
                    return interaction.editReply(
                        '❌ No valid accounts were found in the file.\n\nExpected format: `username:password`'
                    );
                }

                const accounts = await getAccounts(db);

                accounts.push(...importedAccounts);

                await db.set(DB_KEY, accounts);

                return interaction.editReply(
                    `✅ **${importedAccounts.length}** accounts imported successfully!\n📦 Total stock: **${accounts.length}**`
                );

            } catch (error) {
                console.error('Account import error:', error);

                return interaction.editReply(
                    '❌ Failed to read the file.'
                );
            }
        }

        // =========================
        // ADD ONE ACCOUNT
        // =========================
        if (subcommand === 'add') {
            const account = interaction.options
                .getString('account', true)
                .trim();

            if (!account.includes(':')) {
                return interaction.reply({
                    content:
                        '❌ Invalid format. Use `username:password`.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const accounts = await getAccounts(db);

            accounts.push(account);

            await db.set(DB_KEY, accounts);

            return interaction.reply({
                content:
                    `✅ Account added successfully!\n📦 Current stock: **${accounts.length}**`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // =========================
        // STOCK
        // =========================
        if (subcommand === 'stock') {
            const accounts = await getAccounts(db);

            return interaction.reply({
                content:
                    `📦 Current stock: **${accounts.length} accounts**`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // =========================
        // PANEL
        // =========================
        if (subcommand === 'panel') {
            const accounts = await getAccounts(db);

            const embed = createEmbed({
                title: '🎁 Account Giver',
                description:
                    'Click the button below to receive a random account in your DMs.',
                color: 'primary',
                fields: [
                    {
                        name: '📦 Available Stock',
                        value: `**${accounts.length}** account(s)`,
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
