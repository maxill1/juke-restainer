'use strict';

var library = require('../handlers/library');



exports.find_filename = function (req, res) {
  var keyword = req.params.fileName;
  console.log("Searching fileName " + keyword);
  try {
    var data = new library().file(keyword);
    console.log("Results for fileName " + keyword, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

exports.update_library = function (req, res) {
  console.log("Updating library");
  try {
    var handler = new library();
    handler.update().then(function (results) {
      console.log("SEARCH: " + results);

      res.json(results);
    }, function (error) {
      res.send(e);
    });

  } catch (e) {
    res.send(e);
  }
};

exports.all_library = function (req, res) {
  console.log("Requested full library");
  try {
    var data = new library().all();
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};


exports.find = function (req, res) {
  var keyword = req.params.keyword;
  console.log("Searching in all fields " + keyword);

  try {
    var data = new library().searchAll(keyword);
    console.log("Results for all fields " + keyword, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

exports.find_song = function (req, res) {
  var song = req.params.song;
  console.log("Searching song " + song);

  try {
    var data = new library().song(song);
    console.log("Results for song " + song, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

exports.find_artist = function (req, res) {
  var artist = req.params.artist;
  console.log("Searching artist " + artist);

  try {
    var data = new library().song(artist);
    console.log("Results for artist " + artist, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};

exports.find_album = function (req, res) {
  var album = req.params.album;
  console.log("Searching album " + album);

  try {
    var data = new library().song(album);
    console.log("Results for album " + album, data);
    res.json(data);
  } catch (e) {
    res.send(e);
  }
};