import { DetailedTransactionInfo } from './DetailedTransactionInfo';

export interface EthereumTxProcessResult {
    success: boolean;
    resultType: EthereumTxProcessResultType | string;
    failureMessage: string;
    resultTransactionDetails: ResultTransactionDetails;
}

export interface ResultTransactionDetails {
    txHash: string;
    timestamp: number;
    nearest5minTimestamp: number;
    numberOfLogEvents: number;
    transactionInfo?: DetailedTransactionInfo;
}

export enum EthereumTxProcessResultType {
    success,
    failure,
    simpleTransfer,
    migration,
    oneTransferEvent,
    unableToFindContractAddressForToken,
    allLogEventsDoNotHaveIdenticalContractAddress,
    moreThanOneWethEvent,
    moreThanOneSwapLog,
    noWethEvents,
    noSwapEvents,
    highNumberOfTransferEvents,
    cantUseSwap,
}

export interface EthereumTxProcessError {
    txHash: string;
    errorReason: string;
}
