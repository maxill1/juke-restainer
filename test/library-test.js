var library = require('../handlers/library')

var handler = new library();

handler.on('done', (message, indexDone, chunks) => {
    console.log(indexDone + "/" + chunks + " - " + message);

    if (indexDone === chunks) {
        var item = library.searchAll("Remember");
        console.log(item);
    }
});

handler.update();