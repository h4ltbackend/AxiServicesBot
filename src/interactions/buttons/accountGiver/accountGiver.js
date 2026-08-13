import { MessageFlags } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const ACCOUNTS_FILE = path.join(process.cwd(), 'accounts.txt');
const PANEL_KEY = 'account_giver:panel';

let accountLock = false;

async function readAccounts() {
    const text = await fs.readFile(ACCOUNTS_FILE, 'utf8');

    return text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && line.includes(':'));
}

async function writeAccounts(accounts) {
    await fs.writeFile(
        ACCOUNTS_FILE,
        accounts.length > 0
            ? accounts.join('\n') + '\n'
            : '',
        'utf8'
    );
}

export default {
    name: 'account_giver_get',

    async execute(interaction) {
        if (accountLock) {
            return interaction.reply({
                content:
                    '⏳ Someone else is currently receiving an account. Try again in a moment.',
                flags: MessageFlags.Ephemeral,
            });
        }

        accountLock = true;

        try {
            const accounts = await readAccounts();

            if (accounts.length === 0) {
                return interaction.reply({
                    content: '❌ No accounts are currently available.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Pick a random account
            const randomIndex = Math.floor(
                Math.random() * accounts.length
            );

            const account = accounts[randomIndex];

            // Remove it from the stock
            accounts.splice(randomIndex, 1);

            // Save the new stock
            await writeAccounts(accounts);

            // Send account privately
            try {
                await interaction.user.send({
                    content:
                        `🎁 **Your Account**\n\n` +
                        `\`\`\`\n${account}\n\`\`\`\n` +
                        `📦 Remaining stock: **${accounts.length}**`,
                });
            } catch (dmError) {
                // Put the account back if DM failed
                accounts.splice(randomIndex, 0, account);

                await writeAccounts(accounts);

                return interaction.reply({
                    content:
                        '❌ I could not send you a DM. Please enable your DMs and try again.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.reply({
                content:
                    '✅ Your account has been sent to your DMs!',
                flags: MessageFlags.Ephemeral,
            });

            // Update panel
            const db = interaction.client.db;
            const panel = await db.get(PANEL_KEY);

            if (panel?.channelId && panel?.messageId) {
                try {
                    const channel =
                        await interaction.client.channels.fetch(
                            panel.channelId
                        );

                    const message =
                        await channel.messages.fetch(
                            panel.messageId
                        );

                    const stock = accounts.length;

                    await message.edit({
                        embeds: [
                            {
                                title: '🎁 Account Giver',
                                description:
                                    'Click the button below to receive a random account in your DMs.',
                                fields: [
                                    {
                                        name: '📦 Available Stock',
                                        value: `**${stock}** account(s)`,
                                        inline: false,
                                    },
                                ],
                            },
                        ],
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
                                        custom_id:
                                            'account_giver_get',
                                        disabled: stock === 0,
                                    },
                                ],
                            },
                        ],
                    });
                } catch (error) {
                    console.error(
                        'Failed to update panel:',
                        error
                    );
                }
            }
        } catch (error) {
            console.error(
                'Account Giver error:',
                error
            );

            if (!interaction.replied) {
                await interaction.reply({
                    content:
                        '❌ Something went wrong while getting the account.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } finally {
            accountLock = false;
        }
    },
};
