// packages/shadcn/test/fixtures/snapin-custom-webhook-template/code/src/main.ts
import { session, Session } from '@devrev/typescript-sdk';
import { functionFactory } from './function-factory';

export const run = async (events: any[]) => {
  for (const event of events) {
    const devrevSDK = session(event);
    const functionName = event.context.function_name;
    const functionToRun = functionFactory.createFunction(functionName);
    if (functionToRun) {
      await functionToRun.run(event, devrevSDK as Session);
    } else {
      console.error(`Function ${functionName} not found`);
    }
  }
};
export default run;
