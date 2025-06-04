// packages/shadcn/test/fixtures/airdrop-template/code/src/functions/loader.ts
import { Session, Event } from '@devrev/typescript-sdk';
export class Loader {
  async run(event: Event, sdk: Session) {
    console.log('Minimal Loader running for event:', event);
    // Minimal logic, possibly none needed for structure testing
  }
}
