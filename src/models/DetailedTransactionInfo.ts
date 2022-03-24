import { AnalysisResultType } from './ProcessTxErrors';
import { TokenDetails } from './tokenDetails';

export interface TransactionAction {
    tokenInAmount: number;
    tokenInDetails: TokenDetails;
    intermediateSwaps?: IntermediateSwap[];
    destinationAddress: string;
    tokenOutAmount: number;
    tokenOutDetails: TokenDetails;
}

export interface IntermediateSwap {
    index: number;
    logIndex: number;
    destinationAddress: string;
    tokenOutAmount: number;
    tokenOutDetails: TokenDetails;
    tokenInAmount: number;
    tokenInDetails: TokenDetails;
}
