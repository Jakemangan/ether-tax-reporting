export enum ProcessTxErrors {
    oneTransferEvent,
    unableToFindContractAddressForToken,
    allLogEventsDoNotHaveIdenticalContractAddress,
    moreThanOneWethEvent,
    moreThanOneSwapLog,
    noWethEvents,
    noSwapEvents,
    highNumberOfTransferEvents,
    cantUseSwap
}
