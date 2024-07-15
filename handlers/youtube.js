const ytdl = require('@distube/ytdl-core');
const Fs = require('fs');
const ytpl = require('@distube/ytpl');
const NodeID3 = require('node-id3')
var config = require('../config-loader.js')
var downloaderStatus = require('./downloaderStatus.js')

module.exports = function () {

    const mp3Converter = new (require('./mp3-converter'))();


    const handleError = function (url_, e, path_) {
        var errorText = e + ": cannot download " + url_;
        if (path_) {
            errorText = errorText + " on " + path_;
        }
        console.log(errorText);
    }

    const cleanupTitle = function (title) {
        if (!title) {
            return "";
        }
        title = title.replace('/', '-');
        title = title.replace('\\', '-');
        title = title.replace('&', 'and');
        title = title.replace(' HQ', '');
        title = title.replace(/"/g, '');
        return title;
    }

    const writeId3Tag = function (file, title, artist, album, trackNumber) {
        //  Define the tags for your file using the ID (e.g. APIC) or the alias (see at bottom)
        let tags = {
            title: title,
            artist: artist,
            album: album || "Youtube",
            TRCK: trackNumber || 1
        }

        let success = NodeID3.write(tags, file)
        if (!success) {
            throw 'NO Tag written ' + JSON.stringify(tags);
        }

        let tagsOut = NodeID3.read(file);
        console.log(tagsOut);
    }

    const download = function (index, urlList, path_, onEnd, downloadVideo, playlistTitle) {

        var size = urlList.length;
        if (index >= size) {
            console.log("Completed");
            return;
        }
        var url_ = urlList[index];

        const prefix = (index + 1) + "/" + size;

        console.log(prefix + " starting");

        //audio only (default)
        var options = { filter: 'audioonly' }; // quality: 'highestaudio',filter: 'audioonly'
        var ext = "opus";
        if (downloadVideo) {
            options = { filter: function (format) { return format.container === 'mp4'; } };
            ext = "mp4";
        }

        //get info
        ytdl.getInfo(url_).then(function (info) {
            //video title as file name
            var title = cleanupTitle(info.videoDetails.title);
            var output = path_ + title + "." + ext;

            downloaderStatus.addToQueue(url_, path_, downloadVideo, playlistTitle)

            console.log("Downloading " + url_ + " on " + output);

            const video = ytdl.downloadFromInfo(info, options)
            let starttime;
            video.pipe(Fs.createWriteStream(output));
            video.once('response', () => {
                starttime = Date.now();
                downloaderStatus.addToDownloading(url_)
            });
            video.on('error', (err)=>{
                console.log('\n');
                console.log(`${prefix} Error: ${JSON.stringify(err)}`);

                downloaderStatus.addToErrors(url_, err)

                if (video && video.destroy) {
                    video.destroy();
                }

                //next
                var next = index + 1;
                download(next, urlList, path_, onEnd, downloadVideo, playlistTitle);
            });
            video.on('progress', (chunkLength, downloaded, total) => {
                //const floatDownloaded = downloaded / total;
                //const downloadedMinutes = (Date.now() - starttime) / 1000 / 60;
                var diagn = prefix + ' ' + `(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`;
                downloaderStatus.progress(url_, 'downloading', diagn)
            });
            video.on('end', () => {
                downloaderStatus.addToConverting(url_)

                console.log('\n\n');
                console.log(prefix + " Done");

                if (video && video.destroy) {
                    video.destroy();
                }

                //to mp3 using ffmpeg
                mp3Converter.convert(output, function (filePath) {
                    try {
                        var artist = title;
                        var song = title;
                        var test = /^(.*)[:-](.*)/gm.exec(title);
                        if (test?.length === 3) {
                            artist = test[1].trim();
                            song = test[2].trim();
                        }
                        //id3 tag
                        writeId3Tag(filePath, song, artist, playlistTitle, index);

                        downloaderStatus.addToDone(url_)

                        if (onEnd) {
                            onEnd(filePath);
                        }

                    } catch (e) {
                        console.log("Error writing tags to " + filePath, e);
                    }
                });

                //next
                var next = index + 1;
                download(next, urlList, path_, onEnd, downloadVideo, playlistTitle);
            });
        }, function (err) {
            console.error(err.message);
            downloaderStatus.addToErrors(url_)
        }).catch(err => {
            console.error(err);
            downloaderStatus.addToErrors(url_)
            throw err;
        });;

    }

    const isPlaylist = function (url_) {
        if (url_.indexOf('list=') > -1) {
            return true;
        }
        return false;
    }

    const downloadPlaylist = function (playlistUrl, path_, onEnd, downloadVideo) {

        ytpl(playlistUrl).then(playlist => {
            console.log("Downloading playlist " + playlist.title + " " + playlist.items.length + " videos");
            //console.logJSON.stringify(playlist));

            //playlist folder
            var title = cleanupTitle(playlist.title);
            var playlistPath = path_ + title + "/";
            if (!Fs.existsSync(playlistPath)) {
                Fs.mkdirSync(playlistPath);
            }
            var playlistTitle = title;
            //extracting video's id
            var urlList = [];
            for (var i = 0; i < playlist.items.length; i++) {
                var item = playlist.items[i];
                urlList.push(item.id);
            }
            download(0, urlList, playlistPath, onEnd, downloadVideo, playlistTitle);
        }, function (err) {
            console.error(err.message);
        }).catch(err => {
            console.error(err);
            throw err;
        });
    }

    this.start = function (url_, onEnd, downloadVideo) {
        try {
            console.log("Starting");

            var path_ = config.downloadDir || config.rootDir;

            if (!Fs.existsSync(path_)) {
                throw "Invalid download path: " + path_;
            }
            if (!url_) {
                throw "No url provided";
            }

            if (!path_.endsWith("/")) {
                path_ += "/";
            }

            if (isPlaylist(url_)) {
                downloadPlaylist(url_, path_, onEnd, downloadVideo);
            } else {
                var urlList;
                if (Array.isArray(url_)) {
                    urlList = url_;
                    console.log("Downloading array of files+ on " + path_);
                } else {
                    urlList = [url_];
                    console.log("Downloading " + url_ + " on " + path_);
                }

                //recursive download
                download(0, urlList, path_, onEnd, downloadVideo);
            }

        } catch (e) {
            handleError(url_, e, path_);
        }
    }

}
