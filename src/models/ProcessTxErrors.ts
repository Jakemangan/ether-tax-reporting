export enum ProcessTxErrors {
    OneTransferEvent,
    UnableToFindContractAddressForToken,
    AllLogEventsDoNotHaveIdenticalContractAddress,
    MoreThanOneWethEvent,
    NoWethEvents,
    HighNumberOfTransferEvents,
    
}