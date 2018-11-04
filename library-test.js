var library = require('./handlers/library')

var main = new library();
main.update().then(function(results){
    console.log("SEARCH "+ results);

    var item = main.searchAll("Remember");
    console.log(item);
}, function (error){
    console.log(error);
});

