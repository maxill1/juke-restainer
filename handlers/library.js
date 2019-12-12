var config = require('../config-loader.js')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
var path = require('path')
const mm = require('music-metadata')
var fs = require('fs')

const adapter = new FileSync(config.configPath+'db.json')
const db = low(adapter)


function library(verbose) {
    var self = this;

    var rootDir = config.rootDir;

    var log = function(text, data){
        if(verbose){
            console.log(text, data)
        }else{
            console.log(text)
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

    var parseTag = function (audioFiles, index) {

        var removeFromLibrary = function (file) {
            log("Removing data for " + file);
            db.get('songs')
                .remove({ file: file })
                .write()
        }

        var addToLibrary = function (data, file, fileSize) {
            log("Updating data for " + file, data);
            
            data.file = file;
            data.fileSize = fileSize;
            data.url = file.replace(config.rootDir, config.webPath);

            var exists = db.get('songs').find({ file: file }).value();
            if (exists) {
                //log("file exists ", exists)
                db.get('songs').find({ file: file }).assign(data).write();
            } else {
                log("added file " + file);
                db.get('songs').push(data).write();
            }
        }
        
        var nextPromise = function (audioFiles, index) {
            var next = index + 1;
            return parseTag(audioFiles, next);
        }

        return new Promise((resolve, reject) => {
            try {
                var file = audioFiles[index];
                if (!audioFiles || audioFiles.length <= index) {
                    var songs = db.get('songs').value();
                    resolve("Found "+audioFiles.length + " files and parsed correctly "+songs.length+ " songs");// fulfilled
                } else {
                    var file = audioFiles[index];

                    //existing file and size, skip
                    const stats = fs.statSync(file);
                    const fileSize = stats.size;
                    const existingFile = self.file(file, true);
                    if(existingFile && existingFile.length > 0 && existingFile[0].fileSize == fileSize){
                        log("Skipping unchanged " + file);
                        return nextPromise(audioFiles, index).then(lastParsed=>{
                            resolve(lastParsed);// fulfilled
                        });
                    }

                    return mm.parseFile(file)
                        .then(metadata => {
                            //remove unused data
                            metadata.common.picture = undefined;
                            addToLibrary(metadata.common, file, fileSize);
                            return nextPromise(audioFiles, index);
                        }).then(lastParsed=>{
                            resolve(lastParsed);// fulfilled
                        })
                        .catch(err => {
                            removeFromLibrary(file);
                            error(err.message);
                            return nextPromise(audioFiles, index);
                        });
                }
            } catch (error) {
                reject(error); // rejected
            }
        });
    }

    self.clearDb = function(){
        db.defaults({ songs: [] }).write();
    }

    self.update = function (clear) {

        //init db
        if(clear || self.size() === 0){
            self.clearDb();
        }
        var audioFiles = walkSync(rootDir, []);

        return new Promise((resolve, reject) => {
            try {
                return parseTag(audioFiles, 0).then(function (result) {
                    resolve(result);
                }, function (error) {
                    throw error;
                });
            } catch (error) {
                reject(error); // rejected
            }
        });
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
            return result;
        } catch (error) {
            console.log("Error searching "+text, error);
        }
    }

    post => /some regexp/.test(post.title)

}

module.exports = library;