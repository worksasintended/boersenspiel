class Umsatz {

    constructor(aktie,anzahl){
        if (this.zeit === null) {
            this.zeit = new Date().getTime();
        }
        this.aktie = JSON.parse(JSON.stringify(aktie));
        this.anzahl = anzahl;
    }
}
module.exports=Umsatz;