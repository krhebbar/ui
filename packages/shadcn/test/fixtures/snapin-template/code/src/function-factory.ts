// packages/shadcn/test/fixtures/snapin-template/code/src/function-factory.ts
import { Function1 } from './functions/function_1';
class FunctionFactory {
  createFunction(functionName: string) {
    switch (functionName) {
      case 'function_1':
        return new Function1();
      default:
        console.error('Function not found:', functionName);
        return null;
    }
  }
}
export const functionFactory = new FunctionFactory();
