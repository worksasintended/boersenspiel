const DepotPosition=require("./DepotPosition");
class Depot {

    constructor(alleAktien){
        this.depotPositionen = new Array(alleAktien.length);
        for (let i = 0; i < alleAktien.length; i++) {
            this.depotPositionen[i] = new DepotPosition(alleAktien[i]);
        }
    }

    wert() {
        let summe = 0;
        for (let i = 0; i < this.depotPositionen.length; i++) {
            summe += this.depotPositionen[i].wert();
        }
        return summe;
    };

    /**
     * kauft/verkauf Aktien
     * liefert die Kosten für die Transaktion
     *  exception, wenn zu wenige Aktien für Verkauf
     */
    buy (aktie, anzahl) {
        for (let i = 0; i < this.depotPositionen.length; i++) {
            if (this.depotPositionen[i].aktie === aktie) {

                if (this.depotPositionen[i].anzahl + anzahl < 0) {
                    throw "Zu wenige Aktien für Verkauf im Depot.";
                }

                aktie.kaufe(anzahl);

                this.depotPositionen[i].anzahl += anzahl;
                return anzahl * aktie.preis;
            }
        }
    }
}
module.exports=Depot;