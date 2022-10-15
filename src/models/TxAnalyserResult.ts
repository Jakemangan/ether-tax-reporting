import { TransactionAction } from './DetailedTransactionInfo';
import { AnalysisResultType } from './ProcessTxErrors';

export interface TxAnalyserResult {
    success: boolean;
    shouldContinue: boolean;
    resultType: AnalysisResultType | string;
    transactionActions: TransactionAction[];
    other?: any;
    message?: string;
}
