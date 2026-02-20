import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BlueskyPostingService } from '../src/bluesky/bluesky-posting.service';
import { GeminiService } from '../src/core/gemini/gemini.service';
import { BlueskyService } from '../src/bluesky/bluesky.service';

async function run() {
    console.log(`Setting GEMINI_AI_MODEL_BLUESKY to: undefined`);
    console.log(`Default GEMINI_AI_MODEL is: ${process.env.GEMINI_AI_MODEL}`);

    const app = await NestFactory.createApplicationContext(AppModule);
    const postingService = app.get(BlueskyPostingService);

    // We will just call a private method using bracket notation to test the model passing
    // Actually, calling the execute() method directly might post to Bluesky if we aren't careful.
    // Let's just mock the gemini service temporarily inside the app context to spy on it.

    const geminiService: any = app.get(GeminiService); // Get original instance
    const originalGenerateText = geminiService.generateText.bind(geminiService);

    let usedModels: string[] = [];
    geminiService.generateText = async (sys: string, usr: string, override?: string) => {
        usedModels.push(override || 'DEFAULT');
        // don't actually generate anything to save money & avoid posting
        return "Mocked post content";
    };

    const blueskyService: any = app.get(BlueskyService); // get original
    blueskyService.post = async (content: string) => {
        console.log("MOCK POSTED:", content);
    };

    await postingService.execute();

    console.log("Models requested by execute():", usedModels);

    if (usedModels.every(m => m === process.env.GEMINI_AI_MODEL_BLUESKY)) {
        console.log("✅ SUCCESS: The override model was used completely.");
    } else {
        console.error("❌ ERROR: The override model was NOT used consistently.");
    }

    await app.close();
}

run();
