class Aktie {

    constructor (name) {
        this.name = name;
        this.preis = 500;
        this.anzahlVerfuegbar = 500;

        //diese Parameter sind für internen Nutzen
        this.grundWert = Math.random() * 200 + 200;
        this.amplitude = Math.random() * 80 + 20;
        this.phasenLaenge = Math.random() * 50 + 30;
        this.phase = Math.random() * 100;
    }
    /**
     * @param anzahl positiv: entnehme aktien, negativ: lege Aktien zurück
     */
    kaufe(anzahl) {
        if (anzahl > 0 && this.anzahlVerfuegbar < anzahl) {
            throw "Nicht genügend Aktien im Markt verfügbar.";
        }
        this.anzahlVerfuegbar -= anzahl;
    };

    toJSON() {
        return {
            "name": this.name,
            "preis": this.preis,
            "anzahlVerfuegbar": this.anzahlVerfuegbar
        };
    }
}
module.exports=Aktie;