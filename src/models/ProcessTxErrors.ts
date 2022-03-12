export enum AnalysisResultType {
    success,
    potentialMigrationOrAirdrop,
    simpleTransfer,
    unableToFindContractAddressForToken,
    allLogEventsDoNotHaveIdenticalContractAddress,
    moreThanOneWethEvent,
    moreThanOneSwapLog,
    tooFewSwapEventsForMultiSwapAnalyser,
    couldNotDetermineSwapIndexes,
    couldNotDetermineTokenOutTransferEvent,
    couldNotDetermineTokenInTransferEvent,
    noWethEvents,
    noSwapLogs,
    moreThan2UniqueAddressesInTransferLogs,
}

export const AnalysisResultMessages = {
    success: 'Successs.',
    simpleTransfer: 'TX only has one transfer event, likely a simple transfer between wallets. Nothing to process.',
    potentialMigrationOrAirdrop: 'Tranasction has high number of log events - Likely a migration.',
    unableToFindContractAddressForToken: 'Unable to find token details for contract address, cannot process tx',
    allLogEventsDoNotHaveIdenticalContractAddress:
        'All log events do not have the same contract address after removing WETH events.',
    moreThanOneWethEvent: 'More than 1 WETH event - Unsure how to proceed.',
    moreThanOneSwapLog: 'More than one swap log. Using transfer instead.',
    tooFewSwapEventsForMultiSwapAnalyser: "TX does not have multiple swap events",
    couldNotDetermineSwapIndexes: 'Could not determine swap indexes',
    couldNotDetermineTokenOutTransferEvent: 'Could not determine token OUT transfer event',
    couldNotDetermineTokenInTransferEvent: 'Could not determine token IN transfer event',
    noWethEvents: 'No WETH events, cannot proceed.',
    noSwapLogs: 'No swap events are present in logs.',
    moreThan2UniqueAddressesInTransferLogs: 'More than 2 unique addresses in transfers',
};
