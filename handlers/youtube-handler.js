const config = require('../config-loader.js')
const ytdl = require('@distube/ytdl-core');
const Fs = require('fs');
const ytpl = require('@distube/ytpl');
const NodeID3 = require('node-id3')
const downloaderStatus = require('./downloaderStatus.js');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const sharp = require('sharp');

const cleanupTitle = function (title) {
  if (!title) {
    return "";
  }
  title = title.replace('/', '-');
  title = title.replace('\\', '-');
  title = title.replace('&', 'and');
  title = title.replace(' HQ', '');
  title = title.replace(/"/g, '');

  if(title.length > 60){
    const found = String(title).match(/(.+) - ([A-Za-z ]+)/)
    title = found?.[0] ?? title
  }

  return title?.trim();
}

/**
 * 
 * @param {*} file 
 * @param {*} tags // e.g. APIC or the alias
 */
const writeId3Tag = function (file, tags) {

  if(!tags){
    throw `NO Tag to write on ${file}: ${JSON.stringify(tags)}`;
  }

  let success = NodeID3.write(tags, file)
  if (!success) {
    throw 'NO Tag written ' + JSON.stringify(tags);
  }

  let tagsOut = NodeID3.read(file);
  console.log(tagsOut);
}

const downloadFile = (async (url, fileName) => {
  const res = await fetch(url);
  const destination = path.resolve(fileName);
  const fileStream = Fs.createWriteStream(destination, { flags: 'w' });
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
});

const YoutubeHandler = {
  /**
   * Check if is a playlist
   * @param {*} url 
   * @returns 
   */
  isPlaylist: function (url) {
    if (url.indexOf('list=') > -1) {
      return true;
    }
    return false;
  },
  /**
   * Extract basic info from url and generates a list
   * @param {*} url 
   * @returns 
   */
  getFileList: (url, downloadVideo) => {

    return new Promise((resolve, reject) => {

      downloadVideo = downloadVideo ?? false

      if (!url) {
        reject("No url provided")
      }

      var downloadDir = config.downloadDir ?? config.rootDir;

      if (!Fs.existsSync(downloadDir)) {
        reject("Invalid download path: " + downloadDir)
      }

      if (!downloadDir.endsWith("/")) {
        downloadDir += "/";
      }

      if (YoutubeHandler.isPlaylist(url)) {
        ytpl(url).then(playlist => {
          const list = []
          console.log("Downloading playlist " + playlist.title + " " + playlist.items.length + " videos");
          //playlist folder
          var title = cleanupTitle(playlist.title);
          var playlistPath = downloadDir + title + "/";
          if (!Fs.existsSync(playlistPath)) {
            Fs.mkdirSync(playlistPath);
          }
          var playlistTitle = title;
          //extracting video's id
          for (var i = 0; i < playlist.items.length; i++) {
            var item = playlist.items[i];
            list.push({
              url: item.id,
              downloadDir: playlistPath,
              downloadVideo,
              playlistTitle,
              origin: url
            })
          }
          resolve(list)
        }, function (err) {
          console.error(err.message);
          reject(err.message)
        }).catch(err => {
          console.error(err);
          reject(err.message)
        });
      } else {
        const list = []
        var urlList = Array.isArray(url) ? url : [url]
        console.log(`Downloading array of files ${JSON.stringify(urlList)} ${downloadDir}`)
        urlList.forEach(item => {
          list.push({
            url: item,
            downloadDir,
            downloadVideo,
            playlistTitle: '',
            origin: item
          })
        });
        resolve(list)
      }
    })
  },
  downloadImage: (thumbnails, fileRoot, title)=>{
    return new Promise((resolve)=>{
      try {
        if(thumbnails?.length > 0){
          const bigger = thumbnails?.reduce((prev, curr)=>{
            if(prev === null || curr.width > prev?.width){
              return curr
            }
            return prev
          }, null)
          if(bigger?.url){
            const webpPath = `${fileRoot}${title}.webp`;
            downloadFile(bigger?.url, webpPath).then(()=>{
              console.log(`Cover downloaded for ${title}`);
              sharp(webpPath).jpeg().toBuffer().then(bufferJpeg =>{
                Fs.rmSync(webpPath)
                console.log(`Cover removed from for ${webpPath}`);
                resolve({
                  mime: "image/jpeg",
                  type: {
                    id: 3,
                    name: "front cover"
                  },
                  description: "cover",
                  imageBuffer: bufferJpeg
                })
              })
            })
          }else{
            resolve(null)
          }
        }else{
          resolve(null)
        }
      } catch (error) {
        resolve(null)
      }
    })
  },

  /**
   * Download single file
   * @param {*} url 
   * @param {*} fileRoot 
   * @param {*} downloadVideo 
   * @param {*} playlistTitle 
   */
  download: (url, fileRoot, downloadVideo, playlistTitle, trackNumber, source) => {

    return new Promise((resolve, reject) => {

      if (!Fs.existsSync(fileRoot)) {
        Fs.mkdirSync(fileRoot);
      }

      //audio only (default)
      var options = { filter: 'audioonly' }; // quality: 'highestaudio',filter: 'audioonly'
      var ext = "opus";
      if (downloadVideo) {
        options = { filter: function (format) { return format.container === 'mp4'; } };
        ext = "mp4";
      }

      console.log(`Fetching info ${url}`);

      //get info
      ytdl.getInfo(url).then(function (info) {
        //video title as file name
        var title = cleanupTitle(info.videoDetails.title);
        var output = `${fileRoot}${title}.${ext}`;

        console.log(`Received info for ${url}`);

        downloaderStatus.addToDownloading(url)

        YoutubeHandler.downloadImage(info.videoDetails.thumbnails, fileRoot, title).then((imageTag)=>{

          const fileInfo = {
            url,
            downloadDir: output,
            downloadVideo,
            playlistTitle,
            source,
            tags: {
              title: title,
              album: playlistTitle || "Youtube",
              TRCK: trackNumber || 1,
              artist: playlistTitle ?? "Youtube",
              performerInfo:  playlistTitle ?? "Youtube",
              fileUrl: info.videoDetails.video_url,
              image: imageTag
            }
          }
  
          const video = ytdl.downloadFromInfo(info, options)
          const outputPath = path.resolve(output);
          video.pipe(Fs.createWriteStream(outputPath))
  
          let starttime;
          video.once('response', () => {
            starttime = Date.now();
            console.log(`Download started for ${url} on output at ${starttime}`);
            //status change
            downloaderStatus.addToDownloading(url)
          });
          video.on('error', (err) => {
            downloaderStatus.addToErrors(url, err)
            if (video && video.destroy) {
              video.destroy();
            }
            reject(fileInfo)
          });
          video.on('progress', (chunkLength, downloaded, total) => {
            //const floatDownloaded = downloaded / total;
            //const downloadedMinutes = (Date.now() - starttime) / 1000 / 60;
            var diagn = `${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB`;
            downloaderStatus.progress(url, 'downloading', diagn)
          });
          video.on('end', () => {
            const endtime = Date.now();
  
            downloaderStatus.addToConverting(url)
  
            console.log(`Done ${url} in ${endtime-starttime/60} seconds`);
            if (video && video.destroy) {
              video.destroy();
            }
  
            //to mp3 using ffmpeg
            const mp3Converter = new (require('./mp3-converter'))();
            mp3Converter.convert(output, function (filePath) {
              try {
                var artist = title;
                var song = title;
                var test = /^(.*)[:-](.*)/gm.exec(title);
                if (test?.length === 3) {
                  artist = test[1].trim();
                  song = test[2].trim();
                }
                fileInfo.tags.title = song
                fileInfo.tags.artist = artist
                //id3 tag
                writeId3Tag(filePath, fileInfo.tags);
  
                downloaderStatus.addToDone(url)
  
                resolve({
                  ...fileInfo,
                  downloadDir: filePath, //mp3
                })
  
              } catch (e) {
                const error = `Error writing tags to ${filePath}`
                console.log(`Error writing tags to ${filePath}`, e);
  
                downloaderStatus.addToErrors(url)
                reject({
                  ...fileInfo,
                  error: `${error}: ${e?.message ?? e}`
                })
              }
            });
          });
        })
      }).catch(err => {
        console.error(err);
        downloaderStatus.addToErrors(url)

        const fileInfo = {
          url,
          downloadDir: fileRoot,
          downloadVideo,
          playlistTitle
        }

        reject({
          ...fileInfo,
          error: err?.message ?? err
        })
        throw err;
      });;


    })
  },
  start:(url, onDone)=>{
    YoutubeHandler.getFileList(url).then((list)=>{
      console.log(list)
      downloaderStatus.setQueue(list)
      YoutubeHandler.process(list, 0, onDone, url)
    }).catch((err)=>{
      console.error(err)
    })
  },
  process:(list, index, onDone, origin)=>{

    const current = list[index]
    if(current){
      console.log(`Queue processing ${index+1}/${list?.length} (${current.url}${(' ' +(current.playlistTitle??queueName)).trim()})`)
      const trackNumber = index +1
      YoutubeHandler.download(
        current.url, 
        current.downloadDir, 
        current.downloadVideo, 
        current.playlistTitle, 
        trackNumber
        ).then((fileInfo)=>{
  
            YoutubeHandler.process(list, index +1, onDone, origin)
  
            if(onDone){
              onDone(fileInfo)
            }
        }).catch((err)=>{
          console.error(err)
  
          YoutubeHandler.process(list, index +1, onDone, origin)
        })
    }else{
      console.log(`Queue done ${index}/${list?.length} (${origin})`)
    }
  }

}

module.exports = YoutubeHandler