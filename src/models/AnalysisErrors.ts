import { AnalysisResultType as AnalysisResultTypes } from "./ProcessTxErrors";

export interface AnalysisResults {
    [key: string]: {
        analysisResultType: AnalysisResultTypes | string;
        analysisMessage?: string;
    };
}