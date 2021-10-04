var config = require('./config-loader.js')
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var MusicLibrary = require('./handlers/library')
var YoutubeDownloader = require('./handlers/youtube')
var mediashuffle = require('./handlers/mediashuffle')
var CastV2 = require('./handlers/castv2')
var path = require('path')

process.on('uncaughtException', function (exception) {
  console.log(exception);
});

console.log("Launching server... ");
var cast = undefined;

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
  if (!body || !body.list || body.list.length === 0) {
    res.send("No data provided");
  } else {
    console.log("Downloading " + JSON.stringify(body.list));

    if (!Array.isArray(body.list)) {
      var list = [];
      list.push(body.list);
      body.list = list;
    }

    try {

      const downloader = new YoutubeDownloader();
      for (let index = 0; index < body.list.length; index++) {
        const url = body.list[index];
        downloader.start(url, function (filePath) {
          //library add
          library.parseAndAdd(filePath).then(function (data) {
            console.log("Added to library: " + filePath);
          }, function (err) {
            console.log("Error adding to library " + filePath + " : " + err.message);
          });
        });
      }

      var data = `Download of ${body.list.length} url started`;
      console.log(data);
      res.json(data);
    } catch (e) {
      res.send(e.message);
    }
  }
};


controllers.play = function (req, res) {
  var body = req.body;
  if (!body || !body.list || body.list.length === 0) {
    res.send("No data provided");
  } else if (!body.deviceName && !body.address) {
    res.send("No device name or ip address provided");
  } else {
    console.log("Requested: " + JSON.stringify(body.list));

    if (!Array.isArray(body.list)) {
      var list = [];
      list.push(body.list);
      body.list = list;
    }

    const devices = library.devices();
    const deviceId = Object.keys(devices).find(id=> {
      var data = devices[id];
      return  id.toLowerCase() === body.deviceName.toLowerCase() 
      || data.frendlyName.toLowerCase() === body.deviceName.toLowerCase()
    })

    try {
      //priority to ip address
      cast.play(body.address || deviceId, body.list, body.image);

      var data = `Playing started on ${body.deviceName} with ${body.list.length} files`;
      console.log(data);
      res.json(data);
    } catch (e) {
      res.send(e.message);
    }
  }
};


controllers.say = function (req, res) {
  var body = req.body;
  if (!body || !body.text || body.text.length === 0) {
    res.send("No text provided");
  } else if (!body.deviceName && !body.address) {
    res.send("No device name or ip address provided");
  } else {

    try {
      //priority to ip address
      cast.say(body.address || body.deviceName, body.text, body.lang);
      console.log(`Saying "${body.text}" on ${deviceName}`);
      res.json("OK");
    } catch (e) {
      res.send(e.message);
    }
  }
};

controllers.searchAndPlay = function (req, res) {
  var body = req.body;
  if (!body || !body.query) {
    res.send("No query provided");
  } else if (!body.deviceName && !body.address) {
    res.send("No device name or ip address provided");
  } else {
    console.log("Requested: " + JSON.stringify(body.list));


    try {
      var list = [];
      const searchType = body.type || 'file';
      switch (searchType) {
        case 'file':
          list = library.file(body.query);
          break;
        case 'title':
          list = library.title(body.query);
          break;
        case 'artist':
          list = library.artist(body.query);
          break;
        case 'album':
          list = library.album(body.query);
          break;
        default:
          break;
      }

      //TODO data to list and shuffle  (da nodered)
      list = mediaShuffle(list, body.query, searchType);

      if (!list || list.length === 0) {
        const text = config.notFound.text || "No results";
        const lang = config.notFound.lang || "en";
        cast.say(body.address || body.deviceName, text, lang);
        console.log("No results");
      } else {
        //priority to ip address
        cast.play(body.address || body.deviceName, body.list, body.image);
        console.log(`Playing started on ${deviceName} with ${body.list.length} files`);
      }
      //return the actual size
      res.json(list);
    } catch (e) {
      res.send(e.message);
    }
  }
};


controllers.devices = function (req, res) {
  try {
    //sgoogle cast devices found
    res.json(cast.getDevices());
  } catch (e) {
    res.send(e);
  }
};

controllers.devicesScan = function (req, res) {
  try {
    //search for googlecast devices via mdns
    cast.scan(library.saveDevices);
    res.json("Searching googlecast devices via mdns...");
  } catch (e) {
    res.send(e);
  }
};

//local library api
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
//ytdl related api
app.route('/download/yt').post(controllers.downloadYT);
//googlecast related api
app.route('/play').post(controllers.play);
app.route('/say').post(controllers.say);
//TODO
//app.route('/searchAndPlay').post(controllers.say);
app.route('/devices').get(controllers.devices);
app.route('/devices/scan').get(controllers.devicesScan);

function start(app) {
  app.listen(config.port, '0.0.0.0');
  console.log('Library API server started on: ' + config.port);

  //watch root dir for updates
  if (config.watchdog && config.watchdog.enabled) {
    addWatcher(config.rootDir);
  }

  if (config.cast) {
    cast = new CastV2();
    //search for googlecast devices via mdns
    cast.scan(library.saveDevices);
  }

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

function addWatcher(watchDir) {
  const chokidar = require('chokidar');


  // Initialize watcher.
  const watcher = chokidar.watch(watchDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    ignoreInitial: config.watchdog.ignoreInitial || false, //this avoids tthe emit of add/addDir events at startup
    persistent: true,
    usePolling: config.watchdog.usePolling || false, //default false, set this to true to successfully watch files over a network
    interval: config.watchdog.interval || 100,
    binaryInterval: config.watchdog.binaryInterval || 300
  });

  function check(file, eventName) {
    //extension check
    if (!config.ext.includes(path.extname(file).substring(1))) {
      console.log("skipping " + file);
      return;
    }
    console.log(`File ${file} has been ${eventName}`);
    library.checkFile(file, undefined, eventName);
  }

  //listening for add, change and remove
  watcher
    .on('add', file => {
      check(file, 'added');
    })
    .on('change', file => {
      check(file, 'changed');
    })
    .on('unlink', file => {
      console.log(`File ${file} has been removed`);
      library.removeFromLibrary(file, "unlink");
    })
    .on('ready', () => {
      console.log('Watchdog initial scan complete. Listening.')
    });

}