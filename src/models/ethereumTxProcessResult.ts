import { AnalysisResults } from './AnalysisErrors';
import { TransactionAction } from './DetailedTransactionInfo';
import { AnalysisResultType } from './ProcessTxErrors';

export interface EthereumTxProcessResult {
    success: boolean;
    unprocessable: boolean;
    analysisResults: AnalysisResults;
    transactionAnalysisDetails: TransactionAnalysisDetails;
}

export interface TransactionAnalysisDetails {
    txHash: string;
    timestamp: number;
    nearest5minTimestamp: number;
    numberOfLogEvents: number;
    transactionActions?: TransactionAction[];
}
