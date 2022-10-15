import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import genericAbi from './genericAbi';
import { Subject } from 'rxjs';
import { EthereumTransactionDetails } from 'src/models/ethereumTransactionDetails';
import { isFloat32Array } from 'util/types';

@Injectable()
export class EthereumNodeService implements OnModuleInit {
    onReadySubject = new Subject<void>();

    /*
     * BNB ETH SWITCH
     */

    private readonly providerUrl =
        'https://wild-delicate-layer.bsc.discover.quiknode.pro/33e07ee26892111758fcbbbaa7d5aae21d6070be/';
    // private readonly providerUrl = 'https://rpc.ankr.com/bsc';
    // private readonly providerUrl = 'https://mainnet.infura.io/v3/bbe9d9217dc54b1895e1f9b3bfd251c9';
    private readonly provider: any;

    private readonly transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    private readonly swapSignature = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
    private readonly approvalSignature = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(this.providerUrl);
    }

    async onModuleInit(): Promise<void> {
        await this.provider.ready;
        console.log('Ethereum node ready.');
        this.onReadySubject.next();
        // this.signer = this.provider.getSigner(); //Not needed yet
    }

    async getTransactionDetails(txHash: string): Promise<EthereumTransactionDetails> {
        const tx = await this.provider.getTransaction(txHash);
        const txReceipt = await this.provider.getTransactionReceipt(txHash);
        const timestamp = await this.getTimestampFromTx(tx);

        return {
            tx,
            txReceipt,
            timestamp,
        };
    }

    private async getTimestampFromTx(tx: any) {
        let blockNumber = tx.blockNumber;
        let block = await this.provider.getBlock(blockNumber);
        return block.timestamp;
    }

    getAllLogEventsFromTxReceipt(txReceipt: any) {
        return txReceipt.logs;
    }

    getAllTransferLogEventsFromTxReceipt(txReceipt: any) {
        let logEvents = txReceipt.logs;
        return logEvents.filter((x) => x.topics[0] === this.transferSignature);
    }

    getAllSwapLogEventsFromTxReceipt(txReceipt: any) {
        let logEvents = txReceipt.logs;
        return logEvents.filter((x) => x.topics[0] === this.swapSignature);
    }

    getAllApprovalLogEventsFromTxReceipt(txReceipt: any) {
        let logEvents = txReceipt.logs;
        return logEvents.filter((x) => x.topics[0] === this.approvalSignature);
    }

    formatUnits(amount: string, decimals: number) {
        if (!amount.startsWith('0x')) {
            amount = '0x' + amount;
        }

        return ethers.utils.formatUnits(amount, decimals);
    }

    stripHexZeros(input: string) {
        return ethers.utils.hexStripZeros(input);
    }

    splitSwapDataValueIntoArray(swapData: string) {
        let strLength = 32;
        let parts = [];
        for (let i = 0; i < 4; i++) {
            let startStrLength = strLength * i;
            let endStrLength = strLength * (i + 1);
            parts.push(ethers.utils.hexDataSlice(swapData, startStrLength, endStrLength));
        }

        parts = this.checkDataArrayValid(parts);

        return parts;

        // return parts.filter(
        //     (x) => x.toLowerCase() !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        // );
    }

    checkDataArrayValid(array: string[]) {
        let validArrayElements = array.map(
            (x) => x.toLowerCase() !== '0x0000000000000000000000000000000000000000000000000000000000000000',
        );

        if (validArrayElements[0] && validArrayElements[3] && !(validArrayElements[1] && validArrayElements[2])) {
            return [array[0], array[3]];
        }

        if (validArrayElements[1] && validArrayElements[2] && !(validArrayElements[0] && validArrayElements[3])) {
            return [array[1], array[2]];
        }

        throw new Error("Couldn't determine data array values to return.");
    }

    // splitSwapDataValueIntoArray(swapData: string) {
    //     let strLength = 32;
    //     let parts = {};
    //     for (let i = 0; i < 4; i++) {
    //         let startStrLength = strLength * i;
    //         let endStrLength = strLength * (i + 1);

    //         let dataSlice = ethers.utils.hexDataSlice(swapData, startStrLength, endStrLength);
    //         let sliceName = this.dataIndexToName(i);
    //         parts[sliceName] = dataSlice;
    //     }

    //     let partsKeys = Object.keys(parts);
    //     partsKeys.forEach((key) => {
    //         if (parts[key].toLowerCase() === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    //             delete parts[key];
    //         }
    //     });

    //     return parts;
    // }

    // dataIndexToName(index: number) {
    //     switch (index) {
    //         case 0:
    //             return 'amount0In';
    //         case 1:
    //             return 'amount1In';
    //         case 2:
    //             return 'amount0Out';
    //         case 3:
    //             return 'amount1Out';
    //     }
    // }

    // get Provider() {
    //     return this.provider;
    // }
}
