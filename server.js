var config = require('./config-loader.js')
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var MusicLibrary = require('./handlers/library')
var YoutubeDownloader = require('./handlers/youtube')

process.on('uncaughtException', function (exception) {
  console.log(exception);
});

console.log("Launching server... ");

function logErrors(err, req, res, next) {
  console.error(err.stack)
  next(err)
}
function clientErrorHandler(err, req, res, next) {
  if (req.xhr) {
    res.status(500).send({ error: 'Something failed!' })
  } else {
    next(err)
  }
}
function errorHandler(err, req, res, next) {
  res.status(500)
  res.render('error', { error: err })
}

function checkAuth(req, res, next) {
  if (config.token) {
    console.log('checkAuth ' + req.url);
    if (config.token !== req.get('api-token')) {
      res.status(400).send('Bad Request')
      return;
    }
  }

  next();
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(logErrors)
app.use(checkAuth);
app.use(clientErrorHandler)
app.use(errorHandler)



var controllers = {};

const library = new MusicLibrary();
library.on('done', (message, indexDone, chunks) => {
  console.log(indexDone + "/" + chunks + " - " + message);
  if (indexDone === chunks) {
    console.log("UPDATE COMPLETED!");
  }
});

controllers.find_filename = function (req, res) {
  var keyword = req.params.fileName;
  console.log("Searching fileName " + keyword);
  try {
    var data = library.file(keyword);
    console.log("Results for fileName " + keyword, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.update_library = function (req, res) {
  console.log("Updating library");
  try {
    res.json("Update requested");
    var handler = library;
    handler.update()
  } catch (e) {
    res.send(e);
  }
};

controllers.rebuild_library = function (req, res) {
  console.log("Clearing and rebuilding library");
  var handler = library;
  handler.drop();
  console.log("Library dropped...");
  controllers.update_library(req, res);
};

controllers.all_library = function (req, res) {
  console.log("Requested full library");
  try {
    var data = library.all();
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};


controllers.find = function (req, res) {
  var keyword = req.params.keyword;
  console.log("Searching in all fields " + keyword);

  try {
    var data = library.searchAll(keyword);
    console.log("Results for all fields " + keyword, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.find_title = function (req, res) {
  var title = req.params.title;
  console.log("Searching title " + title);

  try {
    var data = library.title(title);
    console.log("Results for title " + title, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.find_artist = function (req, res) {
  var artist = req.params.artist;
  console.log("Searching artist " + artist);

  try {
    var data = library.artist(artist);
    console.log("Results for artist " + artist, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.find_album = function (req, res) {
  var album = req.params.album;
  console.log("Searching album " + album);

  try {
    var data = library.album(album);
    console.log("Results for album " + album, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.random = function (req, res) {
  var count = parseInt(req.params.count) || 10;
  console.log("Random songs (" + count + ")");

  try {
    var data = library.random(count);
    console.log("Results for random " + count, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.downloadYT = function (req, res) {
  var body = req.body;
  if (!body || !body.list || body.list.size === 0) {
    res.send("No data provided");
  } else {
    console.log("Downloading " + JSON.stringify(body.list));

    try {

      const downloader = new YoutubeDownloader();
      body.list.forEach(url => {
        downloader.start(url);
      });

      var data = `Download of ${body.list.size} url started`;
      console.log(data);
      res.json(data);
    } catch (e) {
      res.send(e);
    }
  }
};

app.route('/search/:keyword').get(controllers.find);
app.route('/file/:fileName').get(controllers.find_filename);
app.route('/artist/:artist').get(controllers.find_artist);
app.route('/song/:title').get(controllers.find_title);
app.route('/title/:title').get(controllers.find_title);
app.route('/album/:album').get(controllers.find_album);
app.route('/random/:count').get(controllers.random);
app.route('/random').get(controllers.random);
app.route('/library').get(controllers.all_library);
app.route('/library/update').get(controllers.update_library);
app.route('/library/rebuild').get(controllers.rebuild_library);
app.route('/download/yt').post(controllers.downloadYT);

function start(app) {
  app.listen(config.port, '0.0.0.0');
  console.log('Library API server started on: ' + config.port);
}

//updating db
const current = library;
var size = current.size();
if (size === 0) {
  console.log("Updating library...");

  current.on('done', (index) => {
    console.log("Library updated.");
    console.log(res);
    start(app);
  });

  current.update();
} else {
  console.log("Library has " + size + " files");
  start(app);
}