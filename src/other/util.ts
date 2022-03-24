import { AnalysisResultType } from 'src/models/ProcessTxErrors';

export const RemoveDuplicates = (array, key) => {
    return array.reduce((arr, item) => {
        const removed = arr.filter((i) => i[key] !== item[key]);
        return [...removed, item];
    }, []);
};

export const getTxTypeFromResultType = (type: AnalysisResultType | string) => {
    if (typeof type === 'string') {
        type = AnalysisResultType[type];
    }

    switch (type) {
        case AnalysisResultType.failure:
            return 'failure';
        case AnalysisResultType.success:
            return 'swap';
        case AnalysisResultType.potentialMigrationOrAirdrop:
            return 'migrationAirdrop';
        case AnalysisResultType.simpleTransfer:
            return 'transfer';
        default:
            'failure;';
    }
};
