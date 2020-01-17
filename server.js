var config = require('./config-loader.js')
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var MusicLibrary = require('./handlers/library')

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
  console.log(indexDone+"/"+chunks+ " - " +message);
  if(indexDone === chunks){
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
      var handler = library;
      res.json(handler.update());
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

controllers.find_song = function (req, res) {
  var song = req.params.song;
  console.log("Searching song " + song);

  try {
    var data = library.song(song);
    console.log("Results for song " + song, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.find_artist = function (req, res) {
  var artist = req.params.artist;
  console.log("Searching artist " + artist);

  try {
    var data = library.song(artist);
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
    var data = library.song(album);
    console.log("Results for album " + album, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

controllers.random = function (req, res) {
  var count = parseInt(req.params.count) || 10;
  console.log("Random songs ("+count+")");

  try {
    var data = library.random(count);
    console.log("Results for random " + count, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

app.route('/search/:keyword').get(controllers.find);
app.route('/file/:fileName').get(controllers.find_filename);
app.route('/artist/:artist').get(controllers.find_artist);
app.route('/song/:song').get(controllers.find_song);
app.route('/title/:song').get(controllers.find_song);
app.route('/album/:album').get(controllers.find_album);
app.route('/random/:count').get(controllers.random);
app.route('/random').get(controllers.random);
app.route('/library').get(controllers.all_library);
app.route('/library/update').get(controllers.update_library);
app.route('/library/rebuild').get(controllers.rebuild_library);


function start(app){
  app.listen(config.port, '0.0.0.0');
  console.log('Library API server started on: ' + config.port);
}

//updating db
const current = library;
var size = current.size();
if(size === 0){
  console.log("Updating library...");

  current.on('done', (index) => {
    console.log("Library updated.");
    console.log(res);
    start(app);
  });

  current.update();
}else{
  console.log("Library has "+size + " files");
  start(app);
}