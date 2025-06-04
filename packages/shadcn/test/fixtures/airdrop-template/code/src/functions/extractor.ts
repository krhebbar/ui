// packages/shadcn/test/fixtures/airdrop-template/code/src/functions/extractor.ts
import { Session, Event } from '@devrev/typescript-sdk';
export class Extractor {
  async run(event: Event, sdk: Session) {
    console.log('Minimal Extractor running for event:', event);
    // Minimal logic, possibly none needed for structure testing
  }
}
