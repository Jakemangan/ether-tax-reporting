import { TransactionAction } from './DetailedTransactionInfo';
import { AnalysisResultType } from './ProcessTxErrors';

export interface TxAnalyserResult {
    success: boolean;
    resultType: AnalysisResultType | string;
    transactionInfo: TransactionAction[];
}
