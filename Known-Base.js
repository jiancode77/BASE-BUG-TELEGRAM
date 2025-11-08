module.exports = {
   
    knownNumbers: [],
    
    addKnownNumber: function(number) {
        if (!this.knownNumbers.includes(number)) {
            this.knownNumbers.push(number);
            return true;
        }
        return false;
    },
    
    removeKnownNumber: function(number) {
        const index = this.knownNumbers.indexOf(number);
        if (index > -1) {
            this.knownNumbers.splice(index, 1);
            return true;
        }
        return false;
    },
    
    getKnownNumbers: function() {
        return this.knownNumbers;
    }
};
