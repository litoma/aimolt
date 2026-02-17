import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { LikeService } from '../application/services/like.service';

import { TranscriptionService } from '../application/services/transcription.service';
import { RelationshipService } from '../../personality/services/relationship.service';
import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';

@Injectable()
export class ReactionGateway implements OnModuleInit {
    constructor(
        private readonly discordService: DiscordService,
        private readonly likeService: LikeService,

        private readonly transcriptionService: TranscriptionService,
        private readonly relationshipService: RelationshipService,
    ) { }

    onModuleInit() {
        if (!this.discordService.client) {
            console.error('[ReactionGateway] Discord Client not found!');
            return;
        }
        this.discordService.client.on('messageReactionAdd', (reaction, user) => {
            this.handleReaction(reaction, user);
        });
        console.log('[ReactionGateway] Subscribed to messageReactionAdd events');
    }

    async handleReaction(
        reaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser
    ) {
        if (user.bot) return;

        // Fetch full structure if partial
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the user:', error);
                return;
            }
        }

        const fullUser = user as User;
        const fullReaction = reaction as MessageReaction;

        // Start typing indicator for any handled reaction
        const stopTyping = this.discordService.startTyping(fullReaction.message.channel);

        try {
            // 👍 Like Reaction
            if (fullReaction.emoji.name === '👍') {
                const message = await fullReaction.message.fetch();
                if (!message.author.bot) {
                    const audioExts = ['.ogg', '.mp3', '.wav', '.m4a'];
                    const hasAudio = message.attachments.some(att =>
                        audioExts.some(ext => (att.name || '').toLowerCase().endsWith(ext))
                    );

                    if (hasAudio) {
                        // Audio: Transcription + Advice + Save + Update Activity
                        await this.transcriptionService.handleTranscription(message, fullUser.id, {
                            saveToDb: true,
                            generateAdvice: true,
                            updateActivity: true
                        });
                    } else {
                        // Text: Normal Like (Save History + Update Activity + Update Personality)
                        await this.likeService.handleLike(message, fullUser.id, true);
                    }
                }
            }

            // 👻 Ghost Reaction
            if (fullReaction.emoji.name === '👻') {
                const message = await fullReaction.message.fetch();
                if (!message.author.bot) {
                    const audioExts = ['.ogg', '.mp3', '.wav', '.m4a'];
                    const hasAudio = message.attachments.some(att =>
                        audioExts.some(ext => (att.name || '').toLowerCase().endsWith(ext))
                    );

                    if (hasAudio) {
                        // Audio: Transcription + Advice (Ephemeral) (No Save, No Activity Update)
                        await this.transcriptionService.handleTranscription(message, fullUser.id, {
                            saveToDb: false,
                            generateAdvice: true,
                            updateActivity: false
                        });
                    } else {
                        // Text: Ephemeral Like (No Save, No Activity Update - by LikeService internal logic)
                        await this.likeService.handleLike(message, fullUser.id, false);
                    }
                }
            }

            // 🎤 Mic Reaction
            if (fullReaction.emoji.name === '🎤') {
                const message = await fullReaction.message.fetch();
                // Audio: Transcription Only (No Advice, No Save, No Activity Update)
                await this.transcriptionService.handleTranscription(message, fullUser.id, {
                    saveToDb: false,
                    generateAdvice: false,
                    updateActivity: false
                });
            }


        } catch (error) {
            console.error('[ReactionGateway] Error processing reaction:', error);
        } finally {
            // Stop typing indicator ensuring it stops regardless of success/fail
            stopTyping();
        }
    }
}
