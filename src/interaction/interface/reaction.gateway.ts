import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { LikeService } from '../application/services/like.service';
import { MemoService } from '../application/services/memo.service';
import { TranscriptionService } from '../application/services/transcription.service';
import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';

@Injectable()
export class ReactionGateway implements OnModuleInit {
    constructor(
        private readonly discordService: DiscordService,
        private readonly likeService: LikeService,
        private readonly memoService: MemoService,
        private readonly transcriptionService: TranscriptionService,
    ) { }

    onModuleInit() {
        if (!this.discordService.client) {
            console.error('[ReactionGateway] Discord Client not found!');
            return;
        }
        this.discordService.client.on('messageReactionAdd', (reaction, user) =>
            this.handleReaction(reaction, user)
        );
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
            if (fullReaction.emoji.name === '👍') {
                const message = await fullReaction.message.fetch();
                if (!message.author.bot) {
                    await this.likeService.handleLike(message, fullUser.id, true);
                }
            }

            // Ephemeral Like (Ghost)
            if (fullReaction.emoji.name === '👻') {
                const message = await fullReaction.message.fetch();
                if (!message.author.bot) {
                    await this.likeService.handleLike(message, fullUser.id, false);
                }
            }

            // Memo Feature
            if (fullReaction.emoji.name === '📝') {
                const message = await fullReaction.message.fetch();
                await this.memoService.handleMemo(message, fullUser.id);
            }

            // Transcription Feature
            if (fullReaction.emoji.name === '🎤') {
                const message = await fullReaction.message.fetch();
                await this.transcriptionService.handleTranscription(message, fullUser.id);
            }

        } catch (error) {
            console.error('[ReactionGateway] Error processing reaction:', error);
        } finally {
            // Stop typing indicator ensuring it stops regardless of success/fail
            stopTyping();
        }
    }
}
