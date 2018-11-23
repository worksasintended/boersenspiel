const express = require("express"),
    url = require("url"),
    path = require("path"),
    morgan = require("morgan"),
    basicAuth = require("basic-auth-connect"),
    bodyParser = require("body-parser"),
    app = express();
const Boerse=require("./web/app/Boerse");


/**
 * Start der Börse
 * @type {Boerse}
 */
let boerse=new Boerse();
let finder=boerse.finder;

/**
 * aktiviere Logger des Servers in passendem Logging-Level
 */
app.use(morgan("dev"));
/* change here for more verbous output, e.g. tiny or combined) */

// parse application/json
app.use(bodyParser.json());

/**
 * aktiviere einfache Authentifizierung
 */
app.use(basicAuth(function (user, pass) {
    // Authentifizierung OK, wenn daten zu einem Nutzer passen
    for (let i = 0; i < boerse.users.length; i++) {
        if (user === boerse.users[i].name && pass === boerse.users[i].passwd) {
            return true;
        }
    }
    return false;
}));

/**
 * Ordner als statischen Inhalt bereitstellen
 */
app.use(express.static('web'));

/**
 * Port setzen
 */
let port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log("Listening on " + port);
});

//Middleware
app.use('/appData**', function (req, res) {
    res.status(301).send({"msg":"hier wird nicht geschummelt!!!!"});
});

/**
 * REST Schnittstellen / API
 */
app.get('/data/alleAktien', function (req, res) {
    res.jsonp(boerse.alleAktien);
});

app.get('/data/userData', function (req, res) {
    res.jsonp(finder.findUserByName(req.user));
});

app.get('/data/besitzAlle', function (req, res) {
    let besitzAlle = new Array(boerse.users.length);
    for (let i = 0; i < boerse.users.length; i++) {
        besitzAlle[i] = {"name": boerse.users[i].name, "summe": boerse.users[i].kontostand + boerse.users[i].depot.wert()}
    }
    res.jsonp(besitzAlle);
});

app.get('/data/depot', function (req, res) {
    let user = finder.findUserByName(req.user);
    res.jsonp({"positionen": user.depot.depotPositionen, "wert": user.depot.wert()});
    //res.jsonp(user.depot);
});

/* mit dem Parameter letzteZeit kommen nur neuere Nachrichten*/
app.get('/data/nachrichten', function (req, res) {
    if (req.query.letzteZeit) {
        let letzteZeit = parseInt(req.query.letzteZeit);
        let messages = [];
        for (let i = 0; i < boerse.nachrichten.length; i++) {
            if (boerse.nachrichten[i].zeit > letzteZeit) {
                messages[messages.length] = boerse.nachrichten[i];
            }
        }
        res.jsonp(messages);
    }
    else {
        res.jsonp(boerse.nachrichten);
    }
});

app.get('/data/umsaetze/:id', function (req, res) {
    let user = finder.findUserByName(req.user);
    let index = parseInt(req.params.id);
    if (!user.umsaetze[index]) {
        res.jsonp("error: index not found");
    }
    res.jsonp(user.umsaetze[index]);
});

app.get('/data/umsaetze', function (req, res) {
    let user = finder.findUserByName(req.user);
    res.jsonp(user.umsaetze);
});

/** kauft oder verkauft Aktien
 * liefert success- oder error-Objekt
 * */
app.post('/data/umsaetze/add', function (req, res) {
    let user;
    let aktie;
    let anzahl;
    try {
        user = finder.findUserByName(req.user);
        aktie = finder.findAktieByName(req.body.aktie.name);
        anzahl = parseInt(req.body.anzahl);
        if (anzahl === null || isNaN(anzahl)) {
            throw "error: ungueltige anzahl";
        }
        user.buy(aktie, anzahl);
    }
    catch (err) {
        //console.log(JSON.stringify(err));
        res.status(200).send({"error": err});
        return;
    }

    if (anzahl > 0) {
        nachrichtenText = "KAUF: " + user.name + ": " + anzahl + " " + aktie.name;
    }
    else {
        nachrichtenText = "VERKAUF: " + user.name + ": " + (-1 * anzahl) + " " + aktie.name;
    }
    let date = new Date();
    boerse.nachrichten[boerse.nachrichten.length] = {
        "zeit": date.getTime(),
        "uhrzeit": date.getHours() + ":" + date.getMinutes(),
        "text": nachrichtenText
    };
    let umsatz = Boerse.createUmsatz(aktie,anzahl);
    user.umsaetze.push(umsatz);
    res.status(201).send({"success": nachrichtenText, "id": user.umsaetze.length - 1});
});



