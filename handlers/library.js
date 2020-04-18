var config = require('../config-loader.js')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
var path = require('path')
const mm = require('music-metadata')
var fs = require('fs')
const EventEmitter = require('events');
class MyEmitter extends EventEmitter {}

const adapter = new FileSync(config.configPath+'db.json')
const db = low(adapter);

function library(verbose) {

    var self = this;
    var rootDir = config.rootDir;

    const myEmitter = new MyEmitter();
    this.on =  myEmitter.on;
    this.emit = myEmitter.emit;

    var log = function(text, data){
        if(verbose){
            console.log(text, data)
        }else{
            console.log(text)
        }
    }

    //worker
    myEmitter.on('updateLibrary', (audioFiles, index, chunckIndex) => {

        var file = audioFiles[index];
        if (!audioFiles || audioFiles.length <= index) {
            //done
            myEmitter.emit('done', "Found "+audioFiles.length + " files and parsed correctly "+db.get('songs').value().length+ " songs", index, audioFiles.length);
            return;
        } else {
            var file = audioFiles[index];

            //existing file and size, skip
            const stats = fs.statSync(file);
            const fileSize = stats.size;
            const existingFile = self.file(file, true);
            if(existingFile && existingFile.length > 0 && existingFile[0].fileSize == fileSize){
                log(index + " - skipping unchanged " + file);
                myEmitter.emit('updateLibrary', audioFiles, index+1, chunckIndex);
                return;
            }

            mm.parseFile(file).then(metadata => {
                addToLibrary(metadata.common, file, fileSize, index, chunckIndex);
                myEmitter.emit('updateLibrary', audioFiles, index+1, chunckIndex);
            }, err=>{
                removeFromLibrary(file, index, chunckIndex);
                console.error(err.message);
                myEmitter.emit('updateLibrary', audioFiles, index+1, chunckIndex);
            }).catch(err => {
                console.error(index+"/"+chunckIndex+" - catched exception " +err.message);
                removeFromLibrary(file, index);
                myEmitter.emit('updateLibrary', audioFiles, index+1, chunckIndex);
            });
        }
    });

    var removeFromLibrary = function (file, index, chunckIndex) {
        log(index+"/"+chunckIndex+" - removing data for " + file);
        db.get('songs').remove({ file: file }).write()
    }

    var addToLibrary = function (data, file, fileSize, index, chunckIndex) {
        log(index+"/"+chunckIndex+" - updating data for " + file, data);
        
        data.file = file;
        data.fileSize = fileSize;
        data.url = file.replace(config.rootDir, config.webPath);

        //cache and remove album images
        try {
            if(data.album && data.picture && data.picture.length >0 && data.picture[0].data) {
                var exists = db.get('albumArt').find({ album: data.album }).value();
                var parent = path.dirname(file);
                var coverFile = parent+path.sep+data.album+".jpg";
                var pictureUrl = coverFile.replace(config.rootDir, config.webPath);
                var pictureData = {album: data.album, file: coverFile, url: pictureUrl};
                if (exists) {
                    db.get('albumArt').find({ file: coverFile  }).assign(pictureData).write();
                } else {
                    fs.writeFileSync(coverFile, data.picture[0].data);
                    log(index+"/"+chunckIndex+" - saved cover for album " + data.album +" to "+coverFile);
                    db.get('albumArt').push(pictureData).write();
                }
            }
        } catch (error) {
            console.error(index+"/"+chunckIndex+" - album art not cached for "+file);
        }
        data.picture = undefined;

        var songs = db.get('songs');
        var exists = songs.find({ file: file }).value();
        if (exists) {
            //log("file exists ", exists)
            songs.find({ file: file }).assign(data).write();
        } else {
            log(index+"/"+chunckIndex+" - added file " + file);
            songs.push(data).write();
        }
    }

    // List all files in a directory in Node.js recursively in a synchronous fashion
    var walkSync = function (dir, filelist) {
            files = fs.readdirSync(dir);
        filelist = filelist || [];
        files.forEach(function (file) {
            if (fs.statSync(dir + '/' + file).isDirectory()) {
                filelist = walkSync(dir + '/' + file, filelist);
            } else if (path.extname(file) === '.mp3') {
                filelist.push(dir + '/' + file);
            }
        });
        return filelist;
    };

    self.update = function (clear) {
        try {
            //init db
            if(clear || self.size() === 0){
                self.clearDb();
            }
            var audioFiles = walkSync(rootDir, []);

            //myEmitter.emit('updateLibrary', audioFiles, 0);

            Object.defineProperty(Array.prototype, 'chunk_inefficient', {
                value: function(chunkSize) {
                  var array = this;
                  return [].concat.apply([],
                    array.map(function(elem, i) {
                      return i % chunkSize ? [] : [array.slice(i, i + chunkSize)];
                    })
                  );
                }
              });
              
            var chunks = audioFiles.chunk_inefficient(500);
            for (let chunckIndex = 0; chunckIndex < chunks.length; chunckIndex++) {
                const c = chunks[chunckIndex];
                myEmitter.emit('updateLibrary', c, 0, chunckIndex);

                console.log("Chunck "+chunckIndex+"/"+chunks.length+" requested...");
                let time = new Date().getTime();
                while (time+5000 > new Date().getTime()) {
                    continue;
                }
                //db.saveSync(config.configPath+'db.json');
                console.log("Resuming...");
            }
            
            return "Update requested";
                
        } catch (error) {
            console.error("catched exception " +error);
        }
    }

    self.clearDb = function(){
        db.defaults({ songs: [], albumArt: [] }).write();
    }

    self.drop = function(){
        db.set('songs', []).write();
        db.set('albumArt', []).write();
    }

    self.size = function () {
        return db.get('songs').size().value();
    }

    self.all = function () {
        return db.get('songs').value();
    }

    self.searchAll = function (text, like) {
        return self.search(text, 'all', like);
    }
    
    self.file = function (text, like) {
        return self.search(text, 'file', like);
    }

    /**
     * alias of title()
     */
    self.song = function (text, like) {
        return self.title(text, like);
    }

    self.title = function (text, like) {
        return self.search(text, 'title', like);
    }

    self.artist = function (text, like) {
        return self.search(text, 'artist', like);
    }

    self.album = function (text, like) {
        return self.search(text, 'album', like);
    }

    self.search = function (text, type, exactMatch) {

        if(!text){
            return [];
        }

        var getSearchExpr = function(text, properties, exactMatch){
            if(!exactMatch){
                return function(item){

                    if(text.indexOf(" ")>-1){
                        text = text.split(' ').join('.*');
                    }

                    for (let index = 0; index < properties.length; index++) {
                        const element = properties[index];
                        var searchRegex = new RegExp("^(.*?(\\b"+text+"\\b)[^$]*)$", "i");
                        if(searchRegex.test(item[element])){
                            return true;
                        }
                    }
                    return false;
                };
            }else{
                var searchExpr = {};
                for (let index = 0; index < properties.length; index++) {
                    const element = properties[index];
                    searchExpr[element] = text;
                }
                return searchExpr;
            }
        }

        try {
         
            if(!type){
                type = "title";
            }
            var properties = [type];
            if(type === 'all'){
                properties = ['title', 'album', 'artist'];
            }

            //var result = db.get('songs').find(searchExpr).value(); //Only one
            var results = db.get('songs').filter(getSearchExpr(text, properties, exactMatch)).value();

            //if generic search, dig deeper
            if(type === 'all' || type === 'title'){
                //filename search
                var files = db.get('songs').filter(getSearchExpr(text, ['file'], exactMatch)).value();
                if(files){}
                //if no results, fileResults matters
                if(results.length === 0){
                    results = results.concat(files);
                }else{
                    //we assume file with no tag may be releated to the search keywords
                    results = results.concat(files.filter((item)=>{ return item.title === undefined || item.artist === undefined }))
                }
            }
            //add album art url
            if(results && results.length > 0){
                try {
                    for (let index = 0; index < results.length; index++) {
                        const item = results[index];
                        var albumArt = db.get('albumArt').find({ album: item.album }).value();
                        if(albumArt){
                            item.albumArtUrl = albumArt.url;
                        }
                    }
                } catch (error) {
                    console.error("cannot check albumArt for '"+item.album+"'" );
                }
            }

            return results;
        } catch (error) {
            console.log("Error searching "+text, error);
            return [];
        }
    }

    self.random = function (numberOfSongs) {
        var result = [];
        if(numberOfSongs){

            //failsafe
            if(numberOfSongs > 100){
                numberOfSongs = 100;
            }

            var randomIndexes = [];
            var maxIndex = self.size();
            while (randomIndexes.length<numberOfSongs) {
                var randomInRange = Math.floor(Math.random() * (maxIndex + 1));
                if(randomIndexes.indexOf(randomInRange) === -1){
                    randomIndexes.push(randomInRange);
                }
            }

            result = db.get('songs').filter(function(item, index){
                if(item){
                    return randomIndexes.indexOf(index) > -1;
                }
                return false;
            }).value();
        }
        return result;
    }
}

module.exports = library;