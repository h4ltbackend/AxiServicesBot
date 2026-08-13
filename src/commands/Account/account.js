import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import fs from 'node:fs/promises';
import path from 'node:path';

import { createEmbed } from '../../utils/embeds.js';

const ACCOUNTS_FILE = path.join(process.cwd(), 'accounts.txt');
const PANEL_KEY = 'account_giver:panel';

async function readAccounts() {
    const text = await fs.readFile(ACCOUNTS_FILE, 'utf8');

    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && line.includes(':'));
}

async function updatePanel(client, db) {
    const panel = await db.get(PANEL_KEY);

    if (!panel?.channelId || !panel?.messageId) {
        return;
    }

    try {
        const channel = await client.channels.fetch(panel.channelId);
        const message = await channel.messages.fetch(panel.messageId);

        const accounts = await readAccounts();
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

        await message.edit({
            embeds: [embed],
            components: [
                {
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
                },
            ],
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
                .setName('panel')
                .setDescription('Create the Account Giver panel')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('stock')
                .setDescription('Check the current account stock')
        )

        .addSubcommand(subcommand =>
            subcommand
                .setName('reload')
                .setDescription('Reload the account stock from accounts.txt')
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

        try {
            const accounts = await readAccounts();

            if (subcommand === 'stock') {
                return interaction.reply({
                    content:
                        `📦 Current stock: **${accounts.length} accounts**`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (subcommand === 'reload') {
                await updatePanel(interaction.client, db);

                return interaction.reply({
                    content:
                        `✅ Stock reloaded.\n📦 Current stock: **${accounts.length} accounts**`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (subcommand === 'panel') {
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

                const message = await interaction.reply({
                    embeds: [embed],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 3,
                                    label:
                                        stock > 0
                                            ? 'Get Account'
                                            : 'Stock Empty',
                                    emoji: {
                                        name:
                                            stock > 0
                                                ? '🎁'
                                                : '📦',
                                    },
                                    custom_id: 'account_giver_get',
                                    disabled: stock === 0,
                                },
                            ],
                        },
                    ],
                    fetchReply: true,
                });

                await db.set(PANEL_KEY, {
                    channelId: message.channel.id,
                    messageId: message.id,
                });

                return;
            }
        } catch (error) {
            console.error('Account command error:', error);

            return interaction.reply({
                content:
                    `❌ Failed to read \`accounts.txt\`.\nError: \`${error.message}\``,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
