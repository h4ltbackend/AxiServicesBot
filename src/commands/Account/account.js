import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import { createEmbed } from '../../utils/embeds.js';

const DB_KEY = 'account_giver:stock';
const PANEL_KEY = 'account_giver:panel';

async function getAccounts(db) {
    const accounts = await db.get(DB_KEY, []);
    return Array.isArray(accounts) ? accounts : [];
}

async function updateAccountPanel(client, db) {
    const panel = await db.get(PANEL_KEY);

    if (!panel?.channelId || !panel?.messageId) {
        return;
    }

    try {
        const channel = await client.channels.fetch(panel.channelId);

        if (!channel) return;

        const message = await channel.messages.fetch(panel.messageId);

        const accounts = await getAccounts(db);
        const stock = accounts.length;

        const embed = createEmbed({
            title: '🎁 Account Giver',
            description:
                'Click the button below to receive a random account in your DMs.',
            color: stock > 0 ? 'primary' : 'error',
            fields: [
                {
                    name: '📦 Available Stock',
                    value: `**${stock}** account(s)`,
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
                    label: stock > 0 ? 'Get Account' : 'Stock Empty',
                    emoji: {
                        name: stock > 0 ? '🎁' : '📦',
                    },
                    custom_id: 'account_giver_get',
                    disabled: stock === 0,
                },
            ],
        };

        await message.edit({
            embeds: [embed],
            components: [button],
        });

    } catch (error) {
        console.error('Failed to update Account Giver panel:', error);
    }
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
        // ADD ACCOUNT
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

            await updateAccountPanel(
                interaction.client,
                db
            );

            return interaction.reply({
                content:
                    `✅ Account added successfully!\n📦 Current stock: **${accounts.length}**`,
                flags: MessageFlags.Ephemeral,
            });
        }

        // =========================
        // IMPORT TXT FILE
        // =========================

        if (subcommand === 'import') {
            const file = interaction.options.getAttachment('file');

            if (!file) {
                return interaction.reply({
                    content: '❌ No file was provided.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Check the actual filename instead of MIME type.
            // Discord may not always report .txt as text/plain.
            const fileName = file.name?.toLowerCase() || '';

            if (!fileName.endsWith('.txt')) {
                return interaction.reply({
                    content: '❌ The file must be a `.txt` file.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            try {
                // Download the attachment
                const response = await fetch(file.url);

                if (!response.ok) {
                    throw new Error(
                        `Failed to download file: HTTP ${response.status}`
                    );
                }

                const text = await response.text();

                // Read every line
                const importedAccounts = text
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => {
                        // Ignore empty lines
                        if (!line) return false;

                        // Must contain username:password
                        return line.includes(':');
                    });

                if (importedAccounts.length === 0) {
                    return interaction.editReply(
                        '❌ No valid accounts were found in the file.\n\n' +
                        'Each line must use this format:\n' +
                        '`username:password`'
                    );
                }

                const accounts = await getAccounts(db);

                // Add the entire file to the stock
                accounts.push(...importedAccounts);

                await db.set(DB_KEY, accounts);

                // Refresh the Account Giver panel
                await updateAccountPanel(
                    interaction.client,
                    db
                );

                return interaction.editReply(
                    `✅ **${importedAccounts.length}** accounts imported successfully!\n` +
                    `📦 Total stock: **${accounts.length}**`
                );

            } catch (error) {
                console.error(
                    'Account import error:',
                    error
                );

                return interaction.editReply(
                    '❌ Failed to read the TXT file.'
                );
            }
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
            const stock = accounts.length;

            const embed = createEmbed({
                title: '🎁 Account Giver',
                description:
                    'Click the button below to receive a random account in your DMs.',
                color: stock > 0 ? 'primary' : 'error',
                fields: [
                    {
                        name: '📦 Available Stock',
                        value: `**${stock}** account(s)`,
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
                        label: stock > 0 ? 'Get Account' : 'Stock Empty',
                        emoji: {
                            name: stock > 0 ? '🎁' : '📦',
                        },
                        custom_id: 'account_giver_get',
                        disabled: stock === 0,
                    },
                ],
            };

            const message = await interaction.reply({
                embeds: [embed],
                components: [button],
                fetchReply: true,
            });

            // Remember which message is the Account Giver panel
            await db.set(PANEL_KEY, {
                channelId: message.channel.id,
                messageId: message.id,
            });
        }
    },
};
