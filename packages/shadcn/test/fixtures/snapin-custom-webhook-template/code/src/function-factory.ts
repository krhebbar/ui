// packages/shadcn/test/fixtures/snapin-custom-webhook-template/code/src/function-factory.ts
import { OnMinimalEvent } from './functions/on_minimal_event';
class FunctionFactory {
  createFunction(functionName: string) {
    switch (functionName) {
      case 'on_minimal_event':
        return new OnMinimalEvent();
      default:
        console.error('Function not found:', functionName);
        return null;
    }
  }
}
export const functionFactory = new FunctionFactory();
