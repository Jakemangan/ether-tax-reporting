import { AnalysisResultType } from './ProcessTxErrors';
import { TokenDetails } from './tokenDetails';

export interface TransactionAction {
    tokenExitAmount: number;
    tokenExitDetails: TokenDetails;
    intermediateSwaps?: IntermediateSwap[];
    destinationAddress: string;
    tokenEntryAmount: number;
    tokenEntryDetails: TokenDetails;
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
