import { MessageFlags } from 'discord.js';
import { createEmbed } from '../../../utils/embeds.js';

const DB_KEY = 'account_giver:stock';

// Petit verrou pour éviter que deux personnes récupèrent
// le même compte en cliquant exactement au même moment.
let accountLock = false;

async function getAccounts(db) {
    const accounts = await db.get(DB_KEY, []);
    return Array.isArray(accounts) ? accounts : [];
}

export default {
    name: 'account_giver_get',

    async execute(interaction) {
        const db = interaction.client.db;

        if (!db) {
            return interaction.reply({
                content: '❌ Database not reachable.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (accountLock) {
            return interaction.reply({
                content: '⏳ Wait a minute before generating.',
                flags: MessageFlags.Ephemeral,
            });
        }

        accountLock = true;

        try {
            const accounts = await getAccounts(db);

            if (accounts.length === 0) {
                await interaction.reply({
                    content: '❌ No accounts left in stock.',
                    flags: MessageFlags.Ephemeral,
                });

                await updatePanel(interaction, 0);
                return;
            }

            // Compte random
            const randomIndex = Math.floor(Math.random() * accounts.length);
            const account = accounts[randomIndex];

            // On retire immédiatement le compte du stock
            accounts.splice(randomIndex, 1);

            await db.set(DB_KEY, accounts);

            // Envoi du compte en DM
            try {
                await interaction.user.send({
                    embeds: [
                        createEmbed({
                            title: '🎁 Valorant nfa',
                            description:
                                'Heres your valorant nfa:',
                            color: 'success',
                            fields: [
                                {
                                    name: '🔐 Password & Email',
                                    value: `\`\`\`\n${account}\n\`\`\``,
                                    inline: false,
                                },
                            ],
                            footer: 'Removed account from stock.',
                        }),
                    ],
                });
            } catch (dmError) {
                // Si les DM sont fermés, on remet le compte
                // dans le stock pour ne pas le perdre.
                accounts.push(account);
                await db.set(DB_KEY, accounts);

                return interaction.reply({
                    content:
                        '❌ I cannot send you dms turn on ur dms',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Confirmation éphémère
            await interaction.reply({
                content: '✅ Ur account has been sent in dms',
                flags: MessageFlags.Ephemeral,
            });

            // Mise à jour du panel
            await updatePanel(interaction, accounts.length);

        } catch (error) {
            console.error('Account Giver error:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error reaching the code',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } finally {
            accountLock = false;
        }
    },
};

async function updatePanel(interaction, stock) {
    try {
        const message = interaction.message;

        if (!message) return;

        const embed = createEmbed({
            title: '🎁 Account Giver',
            description:
                'After pressing the button you will recieve a dm from the bot',
            color: stock > 0 ? 'primary' : 'error',
            fields: [
                {
                    name: '📦 Available stock',
                    value: `**${stock}** compte(s)`,
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
