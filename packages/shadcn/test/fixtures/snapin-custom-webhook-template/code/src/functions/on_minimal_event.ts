// packages/shadcn/test/fixtures/snapin-custom-webhook-template/code/src/functions/on_minimal_event.ts
import { Session, Event } from '@devrev/typescript-sdk';
export class OnMinimalEvent {
  async run(event: Event, sdk: Session) {
    console.log('Minimal event function running for event:', event);
    // Minimal logic
  }
}
