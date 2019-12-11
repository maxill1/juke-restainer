var controllers = require('./api/controllers');
var library = require('./handlers/library')
var config = require('./config-loader.js')
express = require('express'),
  app = express(),
  bodyParser = require('body-parser');

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

app.route('/file/:fileName')
  .get(controllers.find_filename);

app.route('/artist/:artist')
  .get(controllers.find_artist);

app.route('/song/:song')
  .get(controllers.find_song);

app.route('/album/:album')
  .get(controllers.find_album);

app.route('/library/update')
  .get(controllers.update_library);

app.route('/library')
  .get(controllers.all_library);

//updating db
console.log("Updating db...");
new library().update().then(res => {
  console.log(res);
  app.listen(config.port, '0.0.0.0');
  console.log('Library API server started on: ' + config.port);
});
