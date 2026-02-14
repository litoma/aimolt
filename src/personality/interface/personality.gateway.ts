import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { PersonalityService } from '../services/personality.service';
import { RelationshipService } from '../services/relationship.service';
import { Message, EmbedBuilder } from 'discord.js';

@Injectable()
export class PersonalityGateway implements OnModuleInit {
    constructor(
        private readonly discordService: DiscordService,
        private readonly personalityService: PersonalityService,
        private readonly relationshipService: RelationshipService,
    ) { }

    onModuleInit() {
        if (!this.discordService.client) {
            console.error('[PersonlityGateway] Discord Client not found!');
            return;
        }
        this.discordService.client.on('messageCreate', (message) => this.handleMessage(message));
        console.log('[PersonalityGateway] Subscribed to messageCreate events');
    }

    async handleMessage(message: Message) {

        if (message.author.bot) return;

        if (message.content.startsWith('!personality status')) {
            console.log('[DEBUG] Matched !personality status command');
            await this.handleStatus(message);
        }

        // TODO: Integrate processUserMessage in the main message flow (e.g. in Core or Interaction module)
        // For now, we just expose status.
    }

    private async handleStatus(message: Message) {
        // Determine target user (mentioned or author)
        const targetUser = message.mentions.users.first() || message.author;
        const targetUserId = targetUser.id;

        const stopTyping = this.discordService.startTyping(message.channel);

        try {
            const [emotionSummary, relationship] = await Promise.all([
                this.personalityService.getEmotionSummary(targetUserId),
                this.relationshipService.getRelationship(targetUserId),
            ]);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Personality Status: ${targetUser.username}`)
                .addFields(
                    {
                        name: '🎭 Emotion (VAD)',
                        value: emotionSummary,
                        inline: true
                    },
                    {
                        name: '🤝 Relationship',
                        value: `Impression: ${(relationship.impression_summary || '').slice(0, 50)}...\nFocus: ${relationship.mentor_focus}\nAffection: ${relationship.affection_score}`,
                        inline: false
                    }
                )
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error handling personality status:', error);
            await message.reply('❌ An error occurred while fetching user status.');
        } finally {
            stopTyping();
        }
    }
}
