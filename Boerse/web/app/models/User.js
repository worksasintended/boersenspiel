const Depot=require("./Depot");
class User {

    constructor(name,passwd,alleAktien){
        this.name = name;
        /* eindeutige ID*/
        this.passwd = passwd;
        this.kontostand = 10000;   //ein beliebiger Startwert
        this.depot = new Depot(alleAktien);
        this.umsaetze = [];
    }

    buy (aktie, anzahl) {
        let kurs = aktie.preis;
        if (aktie.preis * anzahl > this.kontostand) {
            throw "Zu wenig Guthaben für Aktienkauf.";
        }
        this.kontostand -= this.depot.buy(aktie, anzahl);
    };

    toJSON () {
        return {
            "name": this.name,
            "kontostand": this.kontostand
        };
    };
}
module.exports=User;