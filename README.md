# juke-restainer
a simple api to access your ID3 tagged music library. Useful to search specific song, author or album and submit the generated url to a music renderer (Home Assistant media_player entities, Google Cast via node-red-contrib-cast, mdp, etc)

<a href="https://www.buymeacoffee.com/maxill1" target="_blank">
<img src="https://www.buymeacoffee.com/assets/img/guidelines/download-assets-sm-2.svg" alt="Buy Me A Coffee"></a>

## running with nodejs
go to the folder containing the project, install the dependencies, edit your config.json and launch the server.

### dependencies
go to the folder containing the project and run:
```
npm install
```

### configuration: folder, web and security
edit the config.json file to change port, web root and directory to scan
```
{
    "rootDir" : "/music", //the music folder to scan
    "webPath" : "http://192.168.1.100/music", //the web path to translate (you must share the resource with a web server)
    "port" : 3000, //the server port you are exposing
    "token" : "" //a security token you may want to add
}
```

### running with args
you can use a custom config.json:
 
```
node server -c /path/to/my/configfoldercontainingconfigjson/
```
or launch with arguments:
 
```
node server -w http://192.168.1.12/MyWebServerHostingFiles -d '/data/MyWebServerDirectory' -p 3001  -t mycustomtoken
```

# running with docker image
in docker you have to provide a music folder and a config folder:
```
docker run --name juke-restainer -p 3000:3000 -v /host/Music:/music -v /hostConfigFilePath:/config maxill1/juke-restainer:latest 
```

# api

## http://<ip>:3000/search/:keyword
search "keyword" in title album or artist properties

## http://<ip>:3000/file/:fileName
search "fileName" in file path

## http://<ip>:3000/artist/:artist
search "artist" in artist property

## http://<ip>:3000/title/:song or http://<ip>:3000/song/:song
search "song" in song property

## http://<ip>:3000/album/:album
search "album" in album property

## http://<ip>:3000/library
returns the complete json library

## http://<ip>:3000/library/update
force the update of the library

