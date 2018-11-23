class Finder{

    constructor(users,alleAktien){
        this.users=users;
        this.alleAktien=alleAktien;
    }

    /** finders */
    findUserByName(aName) {
        for (let index = 0; index < this.users.length; index++) {
            if (this.users[index].name === aName) {
                return (this.users[index]);
            }
        }
        throw "user \"" + aName + "\" not found";
    }

    findAktieByName(anAktie) {
        for (let index = 0; index < this.alleAktien.length; index++) {
            if (this.alleAktien[index].name === anAktie) {
                return (this.alleAktien[index]);
            }
        }
        throw "aktie \"" + anAktie + "\" not found";
    }

}
module.exports=Finder;
