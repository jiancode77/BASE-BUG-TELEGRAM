// Sixt.js
module.exports = {
    // Konfigurasi token dan setting lainnya
    tokens: {},
    
    addToken: function(key, token) {
        this.tokens[key] = token;
    },
    
    getToken: function(key) {
        return this.tokens[key];
    },
    
    removeToken: function(key) {
        delete this.tokens[key];
    }
};
