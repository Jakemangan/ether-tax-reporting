export interface EthereumTxProcessResult {
    txHash: string;
    timestamp: number;
    nearest5minTimestamp: number;
    numberOfLogEvents: number;
    type: string;
    wethAmountDecimal: number;
    tokenAmountDecimal: number;
    tokenName: string;
    processResult: EthereumTxProcessResultType;
}

export enum EthereumTxProcessResultType {
    successful,
    simpleTransfer,
    failed,
}

export interface EthereumTxProcessError {
    txHash: string;
    errorReason: string;
}
