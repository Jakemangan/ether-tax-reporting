import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import genericAbi from './genericAbi';
import { Subject } from 'rxjs';
import { EthereumTransactionDetails } from 'src/models/EthereumTransactionDetails';

@Injectable()
export class EthereumNodeService implements OnModuleInit {
    onReadySubject = new Subject<void>();

    private readonly providerUrl = 'https://mainnet.infura.io/v3/bbe9d9217dc54b1895e1f9b3bfd251c9';
    private readonly provider: any;

    private readonly transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    private readonly swapSignature = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';

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

    formatUnits(amount: string, decimals: number) {
        if (!amount.startsWith('0x')) {
            amount = '0x' + amount;
        }
        return ethers.utils.formatUnits(amount, decimals);
    }

    // get Provider() {
    //     return this.provider;
    // }
}
