class DepotPosition {

    constructor(aktie) {
        this.aktie = aktie;
        this.anzahl = 0;
    }

    wert () {
        return this.aktie.preis * this.anzahl;
    }
}
module.exports=DepotPosition;