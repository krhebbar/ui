// packages/shadcn/test/fixtures/airdrop-template/code/src/function-factory.ts
import { Extractor } from './functions/extractor';
import { Loader } from './functions/loader';

class FunctionFactory {
  createFunction(functionName: string) {
    switch (functionName) {
      case 'extraction':
        return new Extractor();
      case 'loading':
        return new Loader();
      default:
        console.error('Function not found:', functionName);
        return null;
    }
  }
}
export const functionFactory = new FunctionFactory();
