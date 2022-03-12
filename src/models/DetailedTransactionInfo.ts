import { TokenDetails } from './tokenDetails';

export interface DetailedTransactionInfo {
    tokenOutAmount: number;
    tokenOutDetails: TokenDetails;
    tokenInAmount: number;
    tokenInDetails: TokenDetails;
}
