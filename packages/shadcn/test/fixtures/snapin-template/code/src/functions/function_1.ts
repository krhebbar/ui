// packages/shadcn/test/fixtures/snapin-template/code/src/functions/function_1.ts
import { Session, Event } from '@devrev/typescript-sdk';
export class Function1 {
  async run(event: Event, sdk: Session) {
    console.log('Minimal function 1 running for event:', event);
  }
}
