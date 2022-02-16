import fetch from "node-fetch";
import { promises as fs } from 'fs';

var month = 0; // January

let year = 2021
let timestamps = [];
for(let i = 0; i < 13; i++){
    var d = new Date(year, i, 1);
    let dateString = `Start of ${i+1}-` + year;
    let timestamp = Math.floor(d.getTime() / 1000)
    // console.log(d + " - " +timestamp);
    timestamps.push({
        date: d,
        timestamp: timestamp
    });
}

let allData = [];
for(let i = 0; i < timestamps.length; i++){
    if(i === 12){
        continue;
    }
    
    console.log(i);
    let start = timestamps[i].timestamp;
    let startDate = timestamps[i].date;
    let end = timestamps[i+1].timestamp;
    let endDate = timestamps[i+1].date;

    let url = `https://poloniex.com/public?command=returnChartData&currencyPair=USDT_ETH&start=${start}&end=${end}&period=300`
    let data = await (await fetch(url)).json();

    for(let i = 0; i < data.length;i++){
        if(i === data.length-1){
            continue;
        }
        try {
            let date1 = data[i].date;
            let date2 = data[i+1].date;
            if(date1 && date2){
                let dif = date2 - date1;
                if(dif !== 300){
                    throw new Error("Bad dates - " + date1 + " / " + date2);
                }
            } else {
                console.log(date1);
                console.log(date2);
            }    
        } catch (error) {
            console.log("Ended at " + i);
        }
        
    }
    console.log("Passed timestamp diff");

    allData = allData.concat(data);
    
    let filename = `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
    filename = filename.replace(/\//g, '-');
    
    await fs.writeFile("./eth-historical-prices/" + year + "/" + i + " " + filename, JSON.stringify(data));

    console.log(allData.length);
}

console.log(allData.length);
await fs.writeFile("./eth-historical-prices/" + year + "-all", JSON.stringify(allData));

