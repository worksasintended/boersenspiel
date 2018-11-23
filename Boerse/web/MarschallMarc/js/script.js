//@author Marc Marschall

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

    //create and update views, automated trading
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

/** create news view
 **
 * @param newsList list of news to display
 */
function printNews(newsList) {
    const newsfield = document.getElementById("news");
    //clear newsfield
    newsfield.innerText = "";
    //fill newsfield
    for (let i = newsList.length; i > 0; i--) {
        newsfield.innerText += newsList[i - 1].uhrzeit + "Uhr: " + newsList[i - 1].text + "\n";
    }
}


/**create chart label of given length
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
        //plot type line points
        type: 'line',
        data: {
            labels: label,
            // plot data arrays
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


/** /brief print and update all information, trigger auto trade
 *
 * @param sharesState global share state
 * @param userShares users depot state
 * @param buyQueue buy assignments
 * @param sellQueue sell assignments
 * @param chartData plot data
 * @param chart chart object
 *
 * all information that can be used multiple times are stored and only requested once
 * view update depends on changes. If the shares on the market available change (apple not on the market anymore but samung added)
 * a lot more updated on the view are done. Commonly nothing gets updated, that did not change.
 */
function createView(sharesState, userShares, buyQueue, sellQueue, chartData, chart) {
    setInterval(function () {
            /*update chartData, sharesState, select at "Buy Shares", "Global Stock State"
             * trigger buy events
             */
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
            //get news of the last 60 seconds
            getFromApi(newsAddr + time, printNews, printErrorLog, null);
            //trading queue view update
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
 * @param serverAddr  url/ip for get request
 * @param successCallback called if success
 * @param failCallback called if error
 * @param prevState previous global shares state, object to store data
 * @param tradeQueue trade assingment list
 * @param chartData arrays with data to plot
 * @param chart object
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
        //null check used for two different succesCallBackFunctions
        if (prevState !== null) {
            prevState.shares = successCallback(JSON.parse(request.responseText), prevState.shares, tradeQueue, chartData, chart);
        } else {
            successCallback(JSON.parse(request.responseText));
        }

    };
    request.send();
}

/** rest api post request
 *
 * @param serverAddr url/ip of rest server api
 * @param data data to post
 * @param successCallback call if successfully posted
 * @param failCallback call if post failed
 * @param tradeQueue trading queue
 * @param mVal value treshold for trading
 * @param name name of the share
 * @param amount amount of shares to sell
 *
 * can be called by buy event. in this case: if buy event fails (market availability changed between last update and post, not enough money, etc)
 * an identical assignment is added to the tradeQueue for compensation (trade will be done later if criteria are met again)
 */
function postToApi(serverAddr, data, successCallback, failCallback, tradeQueue, mVal, name, amount) {
    //start request
    let request = new XMLHttpRequest();
    request.open("POST", serverAddr, true); //async
    request.setRequestHeader("Content-type", "application/json");
    request.onload = function () {
        //if not expected return
        if (request.status !== 201) {
            failCallback("Error trading with status " + request.status + ": " + request.response, name, amount, tradeQueue, mVal);
            return;
        }
        successCallback(JSON.parse(request.responseText));
    };
    request.send(JSON.stringify(data));
}

/** normal trade event (buy/sell)
 *
 * in postToApi checks for succesfull trades are triggert. If not succesfull, they get reassigned
 *
 * @param _name name of the share
 * @param _amount amount to trade
 * @param tradeQueue
 * @param mVal value treshold (max buying, min selling value)
 */
function tradeShare(_name, _amount, tradeQueue, mVal) {
    const dataObj = {
        "aktie": {"name": _name},
        "anzahl": _amount
    };
    postToApi(tradeAddr, dataObj, getTradeInfo, tradeError, tradeQueue, mVal, _name, _amount);
}

/** trade event for quick buy function (buying a single share without min selling value or max buying value)
 *
 * if this event fails, only log is generated and the assignment is not beeing reassinged but dropped
 *
 * @param _name of share to trade
 * @param _amount of shares to trade
 */
function tradeShareNonCheck(_name, _amount) {
    const dataObj = {
        "aktie": {"name": _name},
        "anzahl": _amount
    };
    postToApi(tradeAddr, dataObj, getTradeInfo, printErrorLog);
}

/**gets called by postToApi() failCallback() after unsuccessful trading
 *
 * post information about failed trade to logs and reassigns the offer
 *
 * @param errorString server response and status code
 * @param name of the share to trade
 * @param amount to trade
 * @param tradeQueue as target for addTradeElemnt()
 * @param mVal (max buy price/min sell price)
 */
function tradeError(errorString, name, amount, tradeQueue, mVal) {
    printErrorLog(errorString);
    addTradeElement(name, amount, mVal, tradeQueue);
}


/** appends error string to top of logs
 *
 * @param errorString log content line
 */
function printErrorLog(errorString) {
    document.getElementById("logs").innerText = errorString + "\n"
        + document.getElementById("logs").innerText;
}

/**adds successfully finished trade events to sales list top
 *
 * @param tradeMessage sales information from rest api umsaetze/id
 */
function printTrade(tradeMessage) {
    document.getElementById("sales").innerText = tradeMessage.anzahl + " " + tradeMessage.aktie.name + ", at " + tradeMessage.aktie.preis + " each\n"
        + document.getElementById("sales").innerText;
}

/**gets information about trade after successfull trade from rest api
 *
 * only the information about the specific trade is requested
 *
 * @param tradeMessage rest api return of successful trade
 */
function getTradeInfo(tradeMessage) {
    getFromApi(salesAddr + tradeMessage.id, printTrade, printErrorLog, null);
}

/** updates element "The Best of the Best" sorted buy account value*
 *
 * @param _usersData name and balance of all users
 */
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


/** gets new depot information and checks sell assignments if criteria are met
 * updates views
 *
 * @param _userData complete depot information of user
 * @param prevState depot information of old request
 * @param sellQueue
 * @returns {*}
 */
function updateDepot(_userData, prevState, sellQueue) {
    //check selling queue first (no time to loose after updated!)
    checkSellQueue(_userData, sellQueue);
    //clone bcs we need sorted and unsorted version of informatuib
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

    //update "Sell Shares" select if status changed
    if (!stateIsTheSame) {
        const select = document.getElementById("sellName");
        //check which share is currently seleceted at select to reselect after update (musst be done by name, bcs index might change)
        let selected = select.selectedIndex;
        if (selected !== -1) {
            selected = select.options[selected].text;
        }
        //clear select, call length method once only!
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
        reselectSelected(select, selected);
    }
    //always update "Your Depot" as sort by total value changes very often
    //therefore cheaper to just change instead of check first than change most ot the times

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
    //write total depot value into "User Data"
    document.getElementById("userDataTable").rows[2].cells[1].innerText = formatNumber(totalDepotValue);

    //return unsorted data as sorted changes to often and makes comparison between states way to expensive
    return _userData.positionen;
}

/** reselect select after updates
 *
 * @param select DOM obj
 * @param selected previous selected value
 */
function reselectSelected(select, selected) {
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

/**create "Trading Queue" view
 *
 * @param sellQueue
 * @param buyQueue
 */
function printTradingQueue(sellQueue, buyQueue) {
    const table = document.getElementById("tradingQueue");
    clearVerticalTable(table);
    //print sell queue
    for (let i = 0; i < sellQueue.shares.length; i++) {
        const row = table.insertRow(1);
        row.insertCell(0).innerText = sellQueue.shares[i].name;
        row.insertCell(1).innerText = sellQueue.shares[i].amount;
        row.insertCell(2).innerText = sellQueue.shares[i].mVal;
    }
    //print buy queue
    for (let i = 0; i < buyQueue.shares.length; i++) {
        const row = table.insertRow(1);
        row.insertCell(0).innerText = buyQueue.shares[i].name;
        row.insertCell(1).innerText = buyQueue.shares[i].amount;
        row.insertCell(2).innerText = buyQueue.shares[i].mVal;
    }
}


/** updates view "User Data"
 *
 * @param _userData
 */
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


//format to xx,xxx.xx (better readability if all are formated the same)
function formatNumber(number) {
    //correct number of arguments (mistake by webstorm)
    return number.toLocaleString('en-US', {useGrouping: true, minimumFractionDigits: 2});
}


/**gets called by getFromApi() after global shares info got updated
 *
 * calls checkBuyQueue() and therefore triggers buyEvents from queue if criteria are met
 * compares new list of shares with last list of shares and recreates view or updated view based
 * on comparison result
 *
 *
 * @param sharesState new global shares state
 * @param oldSharesState last global shares state for comparison
 * @param buyQueue
 * @param chartData plot data
 * @param chart object
 * @returns {*}
 */
function updateGlobalShares(sharesState, oldSharesState, buyQueue, chartData, chart) {
    //check buying queue first, as other users might try to buy after rest api update too
    checkBuyQueue(sharesState, buyQueue);
    //sort shares from rest api respne by name
    sharesState.sort(function (a, b) {
        return b.name.localeCompare(a.name)
    });
    //small update if shares on the market are still the same
    if (sharesAreTheSame(sharesState, oldSharesState)) {
        updateChart(chartData, chart, sharesState);
        const table = document.getElementById("globalStockTable");
        for (let i = 0; i < sharesState.length; i++) {
            table.rows[i + 1].cells[1].innerText = formatNumber(sharesState[sharesState.length - i - 1].preis); // need to read from the opposite way
            table.rows[i + 1].cells[2].innerText = sharesState[sharesState.length - i - 1].anzahlVerfuegbar;
        }
    } else { //create new "Global Stock State" and "Buy Shares" select if shares available in the market changed
        createGlobalStockViews(sharesState);
        resetChart(chartData, chart, sharesState);
    }
    //return sharesState (gets assinged as old state in getFromApi()
    return sharesState;
}

/** checks if shares on stock market changed
 *
 * @param sharesState1
 * @param sharesState2
 * @returns {boolean}
 */
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
    //clear "Global Stock State"
    clearVerticalTable(table);
    //clear "Buy Shares" select
    const select = document.getElementById("buyName");
    //save which share is selected and reselect after update if still available
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
    reselectSelected(select, selected);
}

/**checks buying queue and buys shares if criteria are met
 *
 * does also partly buys, if more shares are ordered than on the market buy all available
 * and reassing order with updated amount to buy
 *
 * @param sharesState global stock state
 * @param buyQueue orders
 */
function checkBuyQueue(sharesState, buyQueue) {
    //list of elements to splice from buyQueue after operation (those who meet the criteria will get bought)
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
                //dont go through other share from SharesState if the right one is found
                break;
            }
        }
    }
    //remove all successfull trades
    //if local information tell a trade will be successfull they get removed from list but readed in failureCallback() of postToApi()
    splice(toSplice, buyQueue);
}

/** removes elements from array for given index array
 *
 * @param toSplice array of indexes where to splice
 * @param array where splices are done
 */
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
 * @param sellQueue sell assignments
 */
function checkSellQueue(userShares, sellQueue) {
    let toSplice = [];
    for (let i = 0; i < sellQueue.shares.length; i++) {
        //search share in users depot
        for (let j = 0; j < userShares.positionen.length; j++) {
            if (userShares.positionen[j].aktie.name === sellQueue.shares[i].name) {
                let available = userShares.positionen[j].anzahl;
                //remove from queue if not in stock anymore (multiple assignments can be set for same stock)
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

/** changes chartData and triggers update of chart
 *
 * gets called by updateGlobalShares()
 *
 * chartData length stays the same, first element removed, last element appended
 *
 * @param chartData dataset of plot
 * @param chart plot obj
 * @param sharesState global shares state
 */
function updateChart(chartData, chart, sharesState) {
    for (let i = 0; i < sharesState.length; i++) {
        chartData.data.datasets[i].data.push(sharesState[i].preis);
        chartData.data.datasets[i].data.shift();
    }
    chart.update();
}

/**resets chart completly (new labels, new data)
 *
 * gets called by updateGlobalShares() if shares available on the market changed
 *
 * @param chartData plot data set
 * @param chart obj
 * @param sharesState global shares state
 */
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
                //use different color for each
                borderColor: color(i),
                fill: false
            }
        );
        //add fist value to last position
        chartData.data.datasets[i].data.push(sharesState[i].preis);
    }
    //update chart View
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
