import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createEmbed } from '../../utils/embeds.js';

const DB_KEY = 'account_giver:stock';
const PANEL_KEY = 'account_giver:panel';

// The accounts.txt file is in the bot's root folder
const ACCOUNTS_FILE = path.join(process.cwd(), 'accounts.txt');

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

        .addSubcommand(subcommand =>
            subcommand
                .setName('import')
                .setDescription('Import all accounts from accounts.txt')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription('Check the current account stock')
        )

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
        // IMPORT ACCOUNTS.TXT
        // =========================

        if (subcommand === 'import') {
            await interaction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            try {
                // Check if accounts.txt exists
                try {
                    await fs.access(ACCOUNTS_FILE);
                } catch {
                    return interaction.editReply(
                        '❌ `accounts.txt` was not found in the bot root folder.'
                    );
                }

                // Read the entire file
                const text = await fs.readFile(
                    ACCOUNTS_FILE,
                    'utf8'
                );

                // Convert file into accounts
                const importedAccounts = text
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => {
                        if (!line) return false;

                        // Expected:
                        // username:password
                        return line.includes(':');
                    });

                if (importedAccounts.length === 0) {
                    return interaction.editReply(
                        '❌ No valid accounts were found in `accounts.txt`.\n\n' +
                        'Expected format:\n' +
                        '`username:password`'
                    );
                }

                const accounts = await getAccounts(db);

                // Add all accounts
                accounts.push(...importedAccounts);

                // Save them
                await db.set(DB_KEY, accounts);

                // Update panel
                await updateAccountPanel(
                    interaction.client,
                    db
                );

                return interaction.editReply(
                    `✅ Successfully imported **${importedAccounts.length} accounts**!\n` +
                    `📦 Total stock: **${accounts.length}**`
                );

            } catch (error) {
                console.error(
                    'Account file import error:',
                    error
                );

                return interaction.editReply(
                    '❌ Failed to read `accounts.txt`.\n\n' +
                    `Error: \`${error.message}\``
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

            // Save panel location
            await db.set(PANEL_KEY, {
                channelId: message.channel.id,
                messageId: message.id,
            });
        }
    },
};
