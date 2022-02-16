let genericAbi = [
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_spender",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "approve",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_from",
                "type": "address"
            },
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "transferFrom",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [
            {
                "name": "",
                "type": "uint8"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "name": "balance",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [
            {
                "name": "",
                "type": "string"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {
                "name": "_to",
                "type": "address"
            },
            {
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "transfer",
        "outputs": [
            {
                "name": "",
                "type": "bool"
            }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            {
                "name": "_owner",
                "type": "address"
            },
            {
                "name": "_spender",
                "type": "address"
            }
        ],
        "name": "allowance",
        "outputs": [
            {
                "name": "",
                "type": "uint256"
            }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "payable": true,
        "stateMutability": "payable",
        "type": "fallback"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "spender",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Approval",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "name": "from",
                "type": "address"
            },
            {
                "indexed": true,
                "name": "to",
                "type": "address"
            },
            {
                "indexed": false,
                "name": "value",
                "type": "uint256"
            }
        ],
        "name": "Transfer",
        "type": "event"
    }
]

//https://etherscan.io/tx/0x03ab0bf5dcae6a35f96b502d51cd42be7dc3880a9d19e51fea7f08a06946f4f5
import { ethers } from "ethers";

const providerUrl = "https://mainnet.infura.io/v3/bbe9d9217dc54b1895e1f9b3bfd251c9";

const provider = new ethers.providers.JsonRpcProvider(providerUrl);
await provider.ready;
const signer  = provider.getSigner();

let blockNumber = await provider.getBlockNumber();
// console.log("Current block: ", blockNumber);

let txHash = "0xe4d29099546c49e1fa2d912f930f23415295ae76f88febf0bdb7b9ebc337203b";

//console.log(JSON.stringify(tx));
// console.log(JSON.stringify(txReceipt));
// console.log(JSON.stringify(txReceipt));

//let totalSent = "0x0000000000000000000000000000000000000000000000002c68a1ade27349b9";
//console.log(ethers.utils.formatUnits(totalSent, 9));
//let recipientContractAddress = "0x494Cd82786a86eA842f8D80545Ff841Bcbf42dED";

//let amountSentMGC = "0x000000000000000000000000000000000000000000000000369781b18c93d2f2";
//let amountRecEth = "0x00000000000000000000000000000000000000000000000017ca1f2afb3773ff";
//console.log(ethers.utils.formatUnits(amountSentMGC, 9));
//console.log(ethers.utils.formatUnits(amountRecEth, 18));

//let mgcContract = new ethers.Contract(recipientContractAddress, genericAbi, provider);

//console.log(await mgcContract.decimals());





/*
1. Remove all non-transfer logs
2. Determine which logs we care about - First log with invoking wallet in topics array and 
3. If wallet is topics[1] - It's a sell transaction
4. If wallet is topics[2] - It's a buy transaction
5. 
*/

//EXPO transfer check 
let myWalletNonHex = "7cbbba14c573fa52aadad44c7ae8085dc0764ebd";
let wethContractAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
let wethDecimals = 18;

let tokenDetails = [
    {
        address: "0xc7260D904989fEbB1a2d12e46dd6679aDB99A6F7",
        name: "EXPO",
        decimals: 18
    },
    {
        address: "0xb1F4b66104353eC63D8d59D3da42C0b4Fb06E7f3",
        name: "FLOKI",
        decimals: 9
    },
    {
        address:"0x8cde35f711fc72cec61c1182b9a20dffb48f1b64",
        name:"SHERMAN",
        decimals: 9
    },
    {
        address:"0x4B2C54b80B77580dc02A0f6734d3BAD733F50900",
        name:"KIBA",
        decimals: 9
    },
    {
        address:"0x1454232149A0dC51e612b471fE6d3393e60D09Ad",
        name:"MCC",
        decimals: 9
    },
    {
        address:"0xfa18cbc7e4a18cf42887b078cede36ed75c20946",
        name:"KFC",
        decimals:9
    },
    {
        address:"0x58530a272bf650827ae05fadee76f36271089f7f",
        name:"ARCANE",
        decimals:9
    }
]

// let depositSignature = "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c";
let transferSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
let swapSignature = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

let txHashesToProcess = [
    "0x9b64134984bf22c87bc7ad7a66a66d1a368e368c0587ddcebf74c8a2e66cd74d",
    "0x16dba677f69b438a14e095f6bbf4d6136924805d963b7967d68a710039a4b8ac",
    "0x82d0ecf26611503f23df1f9cf0032aac9aba0d30331700e692493ded282a0ed5",
    "0xf787ac65cf70979aa6a0c16a515a0600416e2eab7161da2398326aafbd0c4496",
    "0xe4d29099546c49e1fa2d912f930f23415295ae76f88febf0bdb7b9ebc337203b",
    "0x35c9bce1523aa5ad62b5121196087100aea27e7a895293119fc1c8af7ebca5e5",
    "0x345689833c0a820d6d462ed9f2859485dd7b4b3fede53b4bf1183b719fb7f7e6",
    "0xe68cc42564847e25c38aa828d8fb3196228200910acd50cee79fef35e0c795bd",
    "0xaf559ca47c6438e5ff3ad5593226b30c55430f35547ec4f121c9abceab7d46bf",
    "0x45a26e6419ac5bfa30cf94dd09ea2d56076502b008907cf8066331b6ecf64cd8",
    "0xcaf5f3ce1708df7a1b6e626728800dad0c04ccd2e1bd6209d685986ff1e33b80"
]

// txHashesToProcess.forEach(async txHash => {
//     await processTxHash(txHash);
// })

for(const txHash of txHashesToProcess){
    await processTxHash(txHash);
}

async function processTxHash(txHash){
    const tx = await provider.getTransaction(txHash);
    const txReceipt = await provider.getTransactionReceipt(txHash);
    let logEvents = txReceipt.logs;

    let swapEvents = ([].concat(txReceipt.logs));
    swapEvents = swapEvents.filter(x => x.topics[0] === swapSignature);
    /*
    Filter out all non-transfer events
    */
    logEvents = logEvents.filter(x => x.topics[0] === transferSignature);

    // if(logEvents.length > 2 && logEvents.length % 2 !== 0){
    //     console.log(JSON.stringify(txReceipt));
    //     throw new Error("Odd number of transfer events - " + txHash);
    // }

    /*
    If there's more than 2 transfer events, get the last two as these
    are the ones we care about
    */
    logEvents = logEvents.slice(logEvents.length-2, logEvents.length);

    let type = logEvents[0].address === wethContractAddress ? 'BUY' : 'SELL'

    let wethEvent;
    let tokenEvent;

    if(type === "BUY"){
        wethEvent = logEvents[0];
        tokenEvent = logEvents[1];

        if(!tokenEvent.topics[1].includes(myWalletNonHex)){
            console.log("BUY transaction token log topic #2 is not equal to wallet address - May be a simple swap, checking swap event..");
            if(swapEvents.length > 1){
                throw Error("More than one swap event, not sure what to do. Exiting.")
            }
            if(swapEvents[0].topics[2].includes(myWalletNonHex)){
                console.log("Wallet address is present in swap event.")
            } else {
                throw Error("Could not find waller address in swap event");
            }
        }
    } else { //SELL 
        tokenEvent = logEvents[0];
        wethEvent = logEvents[1];

        if(!tokenEvent.topics[1].includes(myWalletNonHex)){
            console.log("SELL transaction token log topic #2 is not equal to wallet address - May be a simple swap, checking swap event..");
            if(swapEvents.length > 1){
                throw Error("More than one swap event, not sure what to do. Exiting.")
            }
            if(swapEvents[0].topics[1].includes(myWalletNonHex)){
                console.log("Wallet address is present in swap event.")
            } else {
                throw Error("Could not find waller address in swap event");
            }
        }
    }

    let tokenContractAddress = tokenEvent.address;
    let tokenUsedDetails = tokenDetails.find(token => token.address.toUpperCase() === tokenContractAddress.toUpperCase());

    let amountOfTokensInEvent = tokenEvent.data;
    let amountOfWEthInEvent = wethEvent.data;

    let tokenAmountDecimal = ethers.utils.formatUnits(amountOfTokensInEvent, tokenUsedDetails.decimals); 
    let wethAmountDecimal = ethers.utils.formatUnits(amountOfWEthInEvent, wethDecimals);

    let outStr;
    if(type === "BUY"){
        outStr = `${type} - Bought ${tokenAmountDecimal} ${tokenUsedDetails.name} for ${wethAmountDecimal} WETH.`
    } else {
        outStr = `${type} - Sold ${tokenAmountDecimal} ${tokenUsedDetails.name} for ${wethAmountDecimal} WETH.`
    }

    console.log(outStr);
}





// let exitAddress = undefined;
// let entry = logs[0];
// let exit = logs.find(x => {
//     let index = x.logIndex;
//     try{
//         // let hasCorrectAddress = x.address === flokiContractAddres;
//         let matchExitAddress = allowedExitAddresses.find(address => address.address === x.address);
//         exitAddress = matchExitAddress;
//         let hasCorrectTopicAction = x.topics[0] === transferSignature;
//         let hasCorrectRecipient = x.topics[2].includes(myWalletNonHex);
//         return matchExitAddress && hasCorrectTopicAction && hasCorrectRecipient;
//     }catch(err){
//         return false;
//     }
// });

// let entryAmountDeposited = entry.data;
// let exitAmountTransfered = exit.data;

// entryAmountDeposited = ethers.utils.formatUnits(entryAmountDeposited, wethDecimals);
// exitAmountTransfered = ethers.utils.formatUnits(exitAmountTransfered, exitAddress.decimals);

// console.log(`${entryAmountDeposited} WETH transferred for ${exitAmountTransfered} ${exitAddress.name}`);

