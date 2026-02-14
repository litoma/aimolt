
import { Module } from '@nestjs/common';
import { EmotionAnalyzerService } from './emotion-analyzer.service';
import { CoreModule } from '../../core/core.module';

@Module({
    imports: [CoreModule],
    providers: [EmotionAnalyzerService],
    exports: [EmotionAnalyzerService],
})
export class EmotionModule { }
