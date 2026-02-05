import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { VADService } from '../application/services/vad.service';
import { RelationshipService } from '../application/services/relationship.service';
import { Message, EmbedBuilder } from 'discord.js';

@Injectable()
export class PersonalityGateway implements OnModuleInit {
    constructor(
        private readonly discordService: DiscordService,
        private readonly vadService: VADService,
        private readonly relationshipService: RelationshipService,
    ) { }

    onModuleInit() {
        this.discordService.client.on('messageCreate', (message) => this.handleMessage(message));
    }

    async handleMessage(message: Message) {
        if (message.author.bot) return;

        if (message.content.startsWith('!personality status')) {
            await this.handleStatus(message);
        }
    }

    private async handleStatus(message: Message) {
        // Determine target user (mentioned or author)
        const targetUser = message.mentions.users.first() || message.author;
        const targetUserId = targetUser.id;

        try {
            const [emotion, relationship] = await Promise.all([
                this.vadService.getCurrentEmotion(targetUserId),
                this.relationshipService.getRelationship(targetUserId),
            ]);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Personality Status: ${targetUser.username}`)
                .addFields(
                    {
                        name: '🎭 Emotion (VAD)',
                        value: `Valence: ${emotion.valence}\nArousal: ${emotion.arousal}\nDominance: ${emotion.dominance}\nMood: ${emotion.mood_type}`,
                        inline: true
                    },
                    {
                        name: '🤝 Relationship',
                        value: `Stage: ${relationship.relationship_stage}\nAffection: ${relationship.affection_level}\nTrust: ${relationship.trust_level}`,
                        inline: true
                    }
                )
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error handling personality status:', error);
            await message.reply('❌ An error occurred while fetching user status.');
        }
    }
}
