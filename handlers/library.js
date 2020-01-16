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
    myEmitter.on('updateLibrary', (audioFiles, index) => {

        var file = audioFiles[index];
        if (!audioFiles || audioFiles.length <= index) {
            //done
            myEmitter.emit('done');
        return "Found "+audioFiles.length + " files and parsed correctly "+db.get('songs').value().length+ " songs";
        } else {
            var file = audioFiles[index];

            //existing file and size, skip
            const stats = fs.statSync(file);
            const fileSize = stats.size;
            const existingFile = self.file(file, true);
            if(existingFile && existingFile.length > 0 && existingFile[0].fileSize == fileSize){
                log(index + " - skipping unchanged " + file);
                myEmitter.emit('updateLibrary', audioFiles, index+1);
                return;
            }

            mm.parseFile(file).then(metadata => {
                addToLibrary(metadata.common, file, fileSize, index);
                myEmitter.emit('updateLibrary', audioFiles, index+1);
            }, err=>{
                removeFromLibrary(file, index);
                console.error(err.message);
                myEmitter.emit('updateLibrary', audioFiles, index+1);
            }).catch(err => {
                console.error(index + " - catched exception " +err.message);
                removeFromLibrary(file, index);
                myEmitter.emit('updateLibrary', audioFiles, index+1);
            });
        }
    });

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

            var removeFromLibrary = function (file, index) {
                log(index + " - removing data for " + file);
                db.get('songs').remove({ file: file }).write()
            }

            var addToLibrary = function (data, file, fileSize, index) {
                log(index+" - updating data for " + file, data);
                
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
                            log("saved cover for album " + data.album +" to "+coverFile);
                            db.get('albumArt').push(pictureData).write();
                        }
                    }
                } catch (error) {
                    console.error(index+" - album art not cached for "+file);
                }
                data.picture = undefined;

                var songs = db.get('songs');
                var exists = songs.find({ file: file }).value();
                if (exists) {
                    //log("file exists ", exists)
                    songs.find({ file: file }).assign(data).write();
                } else {
                    log(index+" - added file " + file);
                    songs.push(data).write();
                }
            }

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
            for (let index = 0; index < chunks.length; index++) {
                const c = chunks[index];
                myEmitter.emit('updateLibrary', c, 0);

                console.log("Chunck "+index+"/"+chunks.length+" done...");
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

        var getSearchExpr = function(text, properties, exactMatch){
            if(!exactMatch){
                return function(item){
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
            /*
            if(!type){
                type = "title";
            }
            var searchExpr = {};
            searchExpr[type] = text;
            if(!exactMatch){
                var searchRegex = new RegExp("^(.*?(\\b"+text+"\\b)[^$]*)$", "i");
                searchExpr = item => searchRegex.test(item[type]);
            }*/

         
            if(!type){
                type = "title";
            }
            var properties = [type];
            if(type === 'all'){
                properties = ['title', 'album', 'artist'];
            }

            //var result = db.get('songs').find(searchExpr).value(); //Only one
            var result = db.get('songs').filter(getSearchExpr(text, properties, exactMatch)).value();
            if(type === 'all' && result.length === 0){
                //if no results we will try with file name
                db.get('songs').filter(getSearchExpr(text, ['file'], exactMatch)).value();
            }else{
                //add album art url
                try {
                    for (let index = 0; index < result.length; index++) {
                        const item = result[index];
                        var albumArt = db.get('albumArt').find({ album: item.album }).value();
                        if(albumArt){
                            item.albumArtUrl = albumArt.url;
                        }
                    }
                } catch (error) {
                    console.error("cannot check albumArt for '"+item.album+"'" );
                }

            }

            return result;
        } catch (error) {
            console.log("Error searching "+text, error);
        }
    }

    post => /some regexp/.test(post.title)

}

module.exports = library;