# juke-restainer
a simple api to access your ID3 tagged music library. Useful to search specific song, author or album and submit the generated url to a music renderer (Home Assistant media_player entities, Google Cast via node-red-contrib-cast, mdp, etc)

## configuration

install dependencies

```
npm install
```

edit config.js to change port, web root and directory to scan or launch with arguments:
 
```
node server -w http://192.168.1.12/MyWebServerHostingFiles -d '/data/MyWebServerDirectory' -p 3001  -t mycustomtoken
```

# run docker image

```
docker run --name juke-restainer -p 3000:3000 -v /host/Music:/music -v /hostConfigFilePath:/config maxill1/juke-restainer:latest 
```