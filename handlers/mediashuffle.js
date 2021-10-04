module.exports = function (items, query, searchType, maxLengthList) {

    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }

    function shuffleAndMeasure(array, query, searchType) {

        node.warn("shuffling " + searchType + " - " + query)

        var titlePoints = searchType === 'title' ? 10000 : 5000;
        var artistPoints = searchType === 'artist' ? 10000 : 4000;
        var albumPoints = searchType === 'album' ? 10000 : 3000;

        var newArray = [];
        for (var i = 0; i < array.length; i++) {
            var item = array[i];
            node.warn(item);
            var points = Math.floor(getRandomArbitrary(0, array.length));
            if (query && item.title === query) {
                points += titlePoints;
            }
            if (query && item.artist === query) {
                points += albumPoints;
            }
            if (query && item.album === query) {
                points += artistPoints;
            }

            newArray[points] = item;
        }

        var ordered = newArray.filter(function (el) {
            return el !== null && el !== undefined;
        });

        return ordered;
    }


    //no data
    if (!items || items.length === 0) {
        return [];
    }

    if (!maxLengthList) {
        maxLengthList = 99
    }

    const listUrl = [];
    if (items.length > 0) {
        //randomize, with priority over artist, title and album
        items = shuffleAndMeasure(items, query, searchType);

        var imageUrl;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            //recupero copertina
            if (!imageUrl && item.albumArtUrl) {
                //la prima che troviamo
                imageUrl = item.albumArtUrl;
            }
            var url = item.url;
            listUrl.push(url);
        }
    }


    //limite a 100 e randomized
    if (listUrl.length > 0) {
        //listUrl = shuffle(listUrl);
        if (listUrl.length > maxLengthList) {
            listUrl = listUrl.slice(0, maxLengthList);
        }
    }

    return { listUrl: listUrl, imageUrl: imageUrl }
}