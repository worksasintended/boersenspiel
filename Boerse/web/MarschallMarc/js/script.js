"use strict";

//global settings
const interval = 500;
const chartSteps = 100; //number of steps in abscissa
const serverLocation = ""; //assume it is running on same server, add server path if necessary
const globalSharesAddr = serverLocation + "/data/alleAktien";
const userDataAddr = serverLocation + "/data/userData";
const usersDataAddr = serverLocation + "/data/besitzAlle";
const depotAddr = serverLocation + "/data/depot";
const salesAddr = serverLocation + "/data/umsaetze/";
const tradeAddr = serverLocation + "/data/umsaetze/add";
const newsAddr = serverLocation + "/data/nachrichten?letzteZeit=";

window.onload = init;

function init() {
    /*objects to store received data from alleAktien und userData as well as trading queue
    * buy and sells are stored separately to make checks faster (one condition less to check for every share)
    */
    let sharesState = new ShareStateClass([]);
    let userShares = new UserSharesClass([]);
    let buyQueue = new TradeQueue([]);
    let sellQueue = new TradeQueue([]);

    //create chart
    const label = createLabelset(chartSteps);
    let chartData = createChartDataSet(label);

    const chart = new Chart(document.getElementById("chart"), chartData);

    //create and update views, also checks trading queues
    createView(sharesState, userShares, buyQueue, sellQueue, chartData, chart);

    //buy event
    const buyButton = document.getElementById("addBuyElement");
    buyButton.onclick = buyButtonEvent(sharesState, buyQueue);

    //sell event
    const sellButton = document.getElementById("addSellElement");
    sellButton.onclick = sellButtonEvent(sharesState, userShares, sellQueue);
}


/** defined list of colors for plot
 * preferred over random color gen, as to many grays are build
 *
 * @param index index number to choose from array, mod 40
 * @returns {string} string of html hex color
 */
function color(index) {
    let colors = [
        "#00ff00", "#f58341", "#000000", "#0000ff",
        "#00008b", "#008b8b", "#a90008", "#a52a2a",
        "#006400", "#bdb76b", "#8b008b", "#556b2f",
        "#ff8c00", "#9932cc", "#8b0000", "#e9967a",
        "#9400d3", "#ff00ff", "#ffd700", "#008000",
        "#4b0082", "#f0e68c", "#add8e6", "#e0ffff",
        "#90ee90", "#d3d3d3", "#ffb6c1", "#9dceff",
        "#00ff00", "#ff00ff", "#800000", "#000080",
        "#808000", "#ffa500", "#27ff28", "#800080",
        "#800080", "#ff0000", "#c0c0c0", "#ffff00"];
    return colors[index % 40];
}

//print all news to news area
function printNews(newsList) {
    const newsfield = document.getElementById("news");
    //clear newsfield
    newsfield.innerText = "";
    //fill newsfield
    for (let i = newsList.length; i > 0; i--) {
        newsfield.innerText += newsList[i - 1].uhrzeit + "Uhr: " + newsList[i - 1].text + "\n";
    }
}


/**
 *
 * @param steps number of steps on abscissa
 * @returns {Array}
 */
function createLabelset(steps) {
    let label = [];
    for (let i = steps; i > 0; i--) {
        //every fifth step labeled
        if (i % 5 === 0) {
            label.push(-i)
        } else {
            label.push("")
        }
    }
    return label;
}


/** creates chart data set object
 *
 * @param label label array
 * @returns {{type: string, data: {labels: *, datasets: *[]}, options: {title: {display: boolean, text: string}, scales: {yAxes: {scaleLabel: {display: boolean, labelString: string}}[], xAxes: {scaleLabel: {display: boolean, labelString: string}}[]}, responsive: boolean, maintainAspectRatio: boolean}}}
 */
function createChartDataSet(label) {
    return {
        type: 'line',
        data: {
            labels: label,
            datasets: []
        },
        options: {
            title: {
                display: true,
                text: "Share price evolution"
            },
            scales: {
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'value'
                    }
                }],
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'time step'
                    }
                }]
            },
            //responsive with parent size
            responsive: true,
            maintainAspectRatio: true
        }
    };
}


/** /brief print and update all information
 *
 * @param sharesState object to store "alleAktien"
 * @param userShares object to store "userData"
 *
 * sharesState and userShares are only updated here and used in every other function
 */
function createView(sharesState, userShares, buyQueue, sellQueue, chartData, chart) {
    setInterval(function () {
            //global shares info, buying queue check
            getFromApi(globalSharesAddr, updateGlobalShares, printErrorLog, sharesState, buyQueue, chartData, chart);
            //depot info and selling queue check
            getFromApi(depotAddr, updateDepot, printErrorLog, userShares, sellQueue);
            //user data (name and balance)
            getFromApi(userDataAddr, printUserData, printErrorLog, null);
            //users data (name and balance+valueOf(shares)
            getFromApi(usersDataAddr, printBestList, printErrorLog, null);
            //get time one minute ago
            //TODO: change to ntp to sync local time with server time (if local time is ahead more than one minute no messages are shown)
            let time = new Date().getTime() - (60 * 1000);
            getFromApi(newsAddr + time, printNews, printErrorLog, null);
            //trading queue
            printTradingQueue(sellQueue, buyQueue);
        }
        , interval);
}


/**
 * /brief reads buy select and posts buy offer to queue
 *
 * if no amount and max value are given a single share is bought directly
 *
 */
function buyButtonEvent(sharesState, buyQueue) {
    const selectBuyShare = document.getElementById("buyName");
    const buyAmount = document.getElementById("buyAmount");
    const buyMaxValue = document.getElementById("buyMaxValue");
    return function () {
        if (selectBuyShare.selectedIndex < 0) {
            alert("Please select a share and make sure all fields are filled in correctly!");
        } else if (parseFloat(buyMaxValue.value) >= 0 && parseInt(buyAmount.value) > 0) {
            const name = selectBuyShare.options[selectBuyShare.selectedIndex].text;
            addTradeElement(name, buyAmount.value, buyMaxValue.value, buyQueue);
        } else {
            const name = selectBuyShare.options[selectBuyShare.selectedIndex].text;
            tradeShareNonCheck(name, 1, tradeAddr);
        }
    };
}

/**
 * /brief reads sell select and posts buy offer to queue
 *
 * if no amount and max value are given a single share is sold directly
 */
function sellButtonEvent(sharesState, userShares, sellQueue) {
    const selectSellShare = document.getElementById("sellName");
    const sellAmount = document.getElementById("sellAmount");
    const sellMinValue = document.getElementById("sellMinValue");
    return function () {
        if (selectSellShare.selectedIndex < 0) {
            alert("Please select a share and make sure all fields are filled in correctly!");
        } else if (parseFloat(sellMinValue.value) > 0 && parseInt(sellAmount.value) > 0) {
            const name = selectSellShare.options[selectSellShare.selectedIndex].text;
            addTradeElement(name, -sellAmount.value, sellMinValue.value, sellQueue);
        } else {
            const name = selectSellShare.options[selectSellShare.selectedIndex].text;
            tradeShareNonCheck(name, -1, tradeAddr);
        }
    };
}

/**Adds element to trade queues, gets called buy tradeButtonEvent
 *
 * @param name name of the share
 * @param amount amount of shares to sell/buy
 * @param mVal price treshold (min value to sell, max value to buy)
 * @param tradeQueue data object to store sell/buy queue
 *
 * selling and buying are stored in their own queues
 */
function addTradeElement(name, amount, mVal, tradeQueue) {
    //append object with trading assignment to trading queue
    tradeQueue.shares.push({
        "name": name,
        "amount": amount,
        "mVal": mVal
    });
}

/** get request from rest api with callbackfuntions
 *
 * @param serverAddr  url for get request
 * @param successCallback called if success
 * @param failCallback called if error
 * @param prevState previousState, object to store data
 * @param userShares shares in possession of the user
 * @param buyQueue buy assignment list
 * @param sellQueue sell assignment list
 */
function getFromApi(serverAddr, successCallback, failCallback, prevState, tradeQueue, chartData, chart) {
    //start request
    let request = new XMLHttpRequest();
    request.open("GET", serverAddr, true); //async
    //request.setRequestHeader("Content-type", "application/json");
    request.onload = function () {
        //if bad return from rest api
        if (request.status !== 200 || request.readyState !== 4) {
            failCallback("Error connecting to server: " + request.response);
            return;
        }
        //if shareList param  not null go into function that builds global shares and checks trading queues
        if (prevState !== null) {
            prevState.shares = successCallback(JSON.parse(request.responseText), prevState.shares, tradeQueue, chartData, chart);
        } else {
            successCallback(JSON.parse(request.responseText));
        }

    };
    request.send();
}

/** post request to rest api
 *
 * @param serverAddr url for post
 * @param data data object
 * @param successCallback
 * @param failCallback
 */
function postToApi(serverAddr, data, successCallback, failCallback, tradeQueue, mVal, name, amount) {
    //start request
    let request = new XMLHttpRequest();
    request.open("POST", serverAddr, true); //async
    request.setRequestHeader("Content-type", "application/json");
    request.onload = function () {
        //if not expected
        if (request.status !== 201) {
            failCallback("Error trading with status " + request.status + ": " + request.response, name, amount, tradeQueue, mVal);
            return;
        }
        successCallback(JSON.parse(request.responseText));
    };
    request.send(JSON.stringify(data));
}

function tradeShare(_name, _amount, tradeQueue, mVal) {
    const dataObj = {
        "aktie": {"name": _name},
        "anzahl": _amount
    };
    postToApi(tradeAddr, dataObj, getTradeInfo, tradeError, tradeQueue, mVal, _name, _amount);
    return true;
}

function tradeShareNonCheck(_name, _amount) {
    const dataObj = {
        "aktie": {"name": _name},
        "anzahl": _amount
    };
    postToApi(tradeAddr, dataObj, getTradeInfo, printErrorLog);
    return true;
}


function tradeError(errorString, name, amount, tradeQueue, mVal) {
    printErrorLog(errorString);
    addTradeElement(name, amount, mVal, tradeQueue);
}

function printErrorLog(errorString) {
    document.getElementById("logs").innerText = errorString + "\n"
        + document.getElementById("logs").innerText;
}

function printTrade(tradeMessage) {
    document.getElementById("sales").innerText = tradeMessage.anzahl + " " + tradeMessage.aktie.name + ", at " + tradeMessage.aktie.preis + " each\n"
        + document.getElementById("sales").innerText;
}

function getTradeInfo(tradeMessage) {
    getFromApi(salesAddr + tradeMessage.id, printTrade, printErrorLog, null);
}

function printBestList(_usersData) {
    //clear table
    const table = document.getElementById("bestList");
    clearVerticalTable(table);
    //inline sort data by users balance
    _usersData.sort(function (a, b) {
        return b.summe - a.summe
    });
    //write table
    for (let i = _usersData.length; i > 0; i--) {
        const row = table.insertRow(1);
        row.insertCell(0).innerText = _usersData[i - 1].name;
        row.insertCell(1).innerText = formatNumber(_usersData[i - 1].summe);
    }
}

function updateDepot(_userData, prevState, sellQueue) {
    //check selling queue first (no time to loose!)
    checkSellQueue(_userData, sellQueue);
    //clone bcs we need sorted and unsorted version
    let userData = Object.create(_userData.positionen);
    //check if depot changed
    let stateIsTheSame = false;
    if (prevState.length === userData.length) {
        stateIsTheSame = true;
        for (let i = 0; i < userData.length; i++) {
            if (userData[i].aktie.name !== prevState[i].aktie.name || userData[i].anzahl !== prevState[i].anzahl) {
                stateIsTheSame = false;
                break;
            }
        }
    }

    //update sell shares
    if (!stateIsTheSame) {
        const select = document.getElementById("sellName");
        let selected = select.selectedIndex;
        if (selected !== -1) {
            selected = select.options[selected].text;
        }
        //clear select, call legth method once only!
        for (let i = select.options.length; i > 0; i--) {
            select.options.remove(0);
        }
        //fill select
        for (let i = userData.length; i > 0; i--) {
            if (userData[i - 1].anzahl !== 0) {
                const newOption = document.createElement("option");
                newOption.text = userData[i - 1].aktie.name;
                select.options.add(newOption);
            }
        }
        //reselect old element, if not existent anymore set -1
        let stillExists = false;
        for (let i = select.length; i > 0; i--) {
            if (selected === select.options[i - 1].text) {
                select.selectedIndex = i - 1;
                stillExists = true;
                break;
            }
        }
        if (!stillExists) {
            select.selectedIndex = -1;
        }

    }
    //always update depot bcs of resorting by total value
    //clear table
    const table = document.getElementById("depot");
    clearVerticalTable(table);
    //sort data by value*amount
    userData.sort(function (a, b) {
        return b.anzahl * b.aktie.preis - a.anzahl * a.aktie.preis
    });
    let totalDepotValue = 0;
    //write table
    for (let i = userData.length; i > 0; i--) {
        if (userData[i - 1].anzahl !== 0) {
            const row = table.insertRow(1);
            row.insertCell(0).innerText = userData[i - 1].aktie.name;
            row.insertCell(1).innerText = formatNumber(userData[i - 1].aktie.preis);
            row.insertCell(2).innerText = userData[i - 1].anzahl;
            let value = userData[i - 1].anzahl * userData[i - 1].aktie.preis;
            row.insertCell(3).innerText = formatNumber(value);
            totalDepotValue += value;
        }
    }
    //write total depot value into users information
    document.getElementById("userDataTable").rows[2].cells[1].innerText = formatNumber(totalDepotValue);

    //return unsorted data as sort changes to often and makes comparison between states way to expensive
    return _userData.positionen;

}

function printTradingQueue(sellQueue, buyQueue) {
    const table = document.getElementById("tradingQueue");
    clearVerticalTable(table);
    for (let i = 0; i < sellQueue.shares.length; i++) {
        const row = table.insertRow(1);
        row.insertCell(0).innerText = sellQueue.shares[i].name;
        row.insertCell(1).innerText = sellQueue.shares[i].amount;
        row.insertCell(2).innerText = sellQueue.shares[i].mVal;
    }
    for (let i = 0; i < buyQueue.shares.length; i++) {
        const row = table.insertRow(1);
        row.insertCell(0).innerText = buyQueue.shares[i].name;
        row.insertCell(1).innerText = buyQueue.shares[i].amount;
        row.insertCell(2).innerText = buyQueue.shares[i].mVal;
    }
}

function printUserData(_userData) {
    const table = document.getElementById("userDataTable");
    table.rows[0].cells[1].innerText = _userData.name;
    table.rows[1].cells[1].innerText = formatNumber(_userData.kontostand);
}

///delete all rows but first one
function clearVerticalTable(table) {
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
}


//format to xx,xxx.xx
function formatNumber(number) {
    return number.toLocaleString('en-US', {useGrouping: true, minimumFractionDigits: 2});
}


/** compares global stock names to previous state and adds changes in "Global Stock State" and "Buy Shares"
 *  checks trading queues if any assignment is hit
 *
 *
 * @param sharesState obj created from rest api response, new global shares state
 * @param oldSharesState old global shares state
 * @param  userShares depot information of user
 * @param buyQueue buy assignments
 * @param sellQueue sett assignments
 */
function updateGlobalShares(sharesState, oldSharesState, buyQueue, chartData, chart) {
    //check buying queue first, as other users might try to buy after rest api update too
    checkBuyQueue(sharesState, buyQueue);
    //sort by name
    sharesState.sort(function (a, b) {
        return b.name.localeCompare(a.name)
    });
    //update values and available only at "GlobalStockState" if shares available did not change
    if (sharesAreTheSame(sharesState, oldSharesState)) {
        updateChart(chartData, chart, sharesState);
        const table = document.getElementById("globalStockTable");
        for (let i = 0; i < sharesState.length; i++) {
            table.rows[i + 1].cells[1].innerText = formatNumber(sharesState[sharesState.length - i - 1].preis); // need to read from the opposite way
            table.rows[i + 1].cells[2].innerText = sharesState[sharesState.length - i - 1].anzahlVerfuegbar;
        }
    } else { //create new "Global Stock State" and "Buy Shares" select
        createGlobalStockViews(sharesState);
        resetChart(chartData, chart, sharesState);
    }
    //return to set as prevState
    return sharesState;
}

//checks if two shareStates are the same and returns boolean
function sharesAreTheSame(sharesState1, sharesState2) {
    let same = false;
    if (sharesState1.length === sharesState2.length) { //if amount has changed, no need to check each
        same = true;
        //amount is the same, but still the same shares in list?
        for (let i = 0; i < sharesState1.length; i++) {
            if (sharesState1[i].name !== sharesState2[i].name) {
                same = false;
                break; //no need to continue comparing if one has changed
            }
        }
    }
    return same;
}

/**print "Gobal Stock State" and (re)build "Buy Shares" select
 *
 * @param sharesState current global stock state
 */
function createGlobalStockViews(sharesState) {
    const table = document.getElementById("globalStockTable");
    //clear global stock state view
    clearVerticalTable(table);
    const select = document.getElementById("buyName");

    //save which share is selected and reselect after update
    let selected = select.selectedIndex;
    if (selected !== -1) {
        selected = select.options[selected].text;
    }
    const length = select.options.length;

    //clear select
    for (let i = 0; i < length; i++) {
        select.options.remove(0);
    }

    //print global Stock state and new select
    for (let i = 0; i < sharesState.length; i++) {
        //each row is name, price, available
        let row = table.insertRow(1);
        row.insertCell(0).innerText = sharesState[i].name;
        row.insertCell(1).innerText = formatNumber(sharesState[i].preis);
        row.insertCell(2).innerText = sharesState[i].anzahlVerfuegbar;
        //add option to select menu at buy shares
        let newOption = document.createElement("option");
        newOption.text = sharesState[i].name;
        select.options.add(newOption, 0);
    }

    //reselect share
    select.selectedIndex = selected;
}

/**quecks buying queue and buys shares if criteria are met
 *
 * does also partly buys, if more shares are ordered than on the market and edits order to those remaining
 *
 * @param sharesState global stock state
 * @param buyQueue orders
 */
function checkBuyQueue(sharesState, buyQueue) {
    let toSplice = [];
    //check each element in buyQueue
    for (let i = 0; i < buyQueue.shares.length; i++) {
        //search corresponding share in shareState
        for (let j = 0; j < sharesState.length; j++) {
            if (sharesState[j].name === buyQueue.shares[i].name) {
                //if price is <= maxValue
                if (buyQueue.shares[i].mVal >= sharesState[j].preis) {
                    let available = sharesState[j].anzahlVerfuegbar;
                    //if all shares from assignment are available
                    if (available >= buyQueue.shares[i].amount) {
                        tradeShare(buyQueue.shares[i].name, buyQueue.shares[i].amount, buyQueue, buyQueue.shares[i].mVal);
                        toSplice.push(i);
                    } else if (available !== 0) { // buy all available but dont do zero buy event
                        tradeShare(buyQueue.shares[i].name, available, buyQueue, buyQueue.shares[i].mVal);
                        //adjust order
                        buyQueue.shares[i].amount -= available;
                    }
                }
                //dont go through other share from SharesState
                break;
            }
        }
    }
    splice(toSplice, buyQueue);
}

function splice(toSplice, array) {
    //sort that last one gets removed first, so index changing is not affecting splicing
    toSplice.sort((a, b) => b - a);
    //remove hit offers
    for (let i = 0; i < toSplice.length; i++) {
        array.shares.splice(toSplice[i]);
    }
}

/**checks sell queue and sells shares if criteria are met
 *
 * @param userShares users depot
 * @param sharesState global share state
 * @param sellQueue sell assignments
 */
function checkSellQueue(userShares, sellQueue) {
    let toSplice = [];
    for (let i = 0; i < sellQueue.shares.length; i++) {
        //search share in users depot
        for (let j = 0; j < userShares.positionen.length; j++) {
            if (userShares.positionen[j].aktie.name === sellQueue.shares[i].name) {
                let available = userShares.positionen[j].anzahl;
                //remove from queue if not in stock anymore (mutiple assignments can be set for same stock)
                if (available === 0) {
                    toSplice.push(i);
                    break;
                }
                //if price threshold is met
                if (sellQueue.shares[i].mVal <= userShares.positionen[j].aktie.preis) {
                    //if all shares assigned are available
                    if (available >= -(sellQueue.shares[i].amount)) {
                        tradeShare(sellQueue.shares[i].name, sellQueue.shares[i].amount, sellQueue, sellQueue.shares[i].mVal);
                        //splice later to not destroy iterating through sellQueue
                        toSplice.push(i);
                    } else if (available > 0) {
                        tradeShare(sellQueue.shares[i].name, -available, sellQueue, sellQueue.shares[i].mVal);
                        toSplice.push(i);
                    }
                }
            }
        }
    }
    splice(toSplice, sellQueue);
}


function updateChart(chartData, chart, sharesState) {
    for (let i = 0; i < sharesState.length; i++) {
        chartData.data.datasets[i].data.push(sharesState[i].preis);
        chartData.data.datasets[i].data.shift();
    }
    chart.update();
}

function resetChart(chartData, chart, sharesState) {
    //create new chartDataSet
    chartData.data.datasets = [];
    let zeroArray = Array.apply(null, Array(chartSteps - 1)).map(Number.prototype.valueOf, 0);
    //add each share to chart, initialize with zeros
    for (let i = 0; i < sharesState.length; i++) {
        chartData.data.datasets.push(
            {
                data: Object.create(zeroArray),
                label: sharesState[i].name,
                borderColor: color(i),
                fill: false
            }
        );
        //add fist value to last position
        chartData.data.datasets[i].data.push(sharesState[i].preis);
    }
    chart.update();

}


//store global sharesState
class ShareStateClass {
    constructor(shares) {
        this.shares = shares;
    }
}

//store users shares
class UserSharesClass {
    constructor(shares) {
        this.shares = shares;
    }
}

class TradeQueue {
    constructor(shares) {
        this.shares = shares;
    }
}
