var Client = require('castv2-client').Client;
var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
var mdns = require('mdns');
const googleTTS = require('google-tts-api'); // CommonJS

module.exports = function () {

    const devices = {};

    /**
     * Search googlecast devices with mdns
     */
    this.scan = function (onDevicesFound) {
        const browser = mdns.createBrowser(mdns.tcp('googlecast'), {
            resolverSequence: [
                //fix ipv6
                mdns.rst.DNSServiceResolve()
                , 'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({ families: [4] })
                , mdns.rst.makeAddressesUnique()
            ]
        });

        browser.on('serviceUp', service => {
            //devices found
            if (service.name) {
                console.log(`Found device ${service.name} on ip: ${service.addresses}`);
                devices[service.name] = service;
            }
            //save devices names (for alias)
            if(onDevicesFound){
                onDevicesFound(Object.keys(devices || {}))
            }
        });

        browser.on('serviceDown', service => {
            console.log("service down: ", service);
            if (service.name) {
                delete devices[service.name];
            }
        });
        browser.start();
    }

    /**
     * get current device list
     */
    this.getDevices = function () {
        return Object.keys(devices).map(key => {
            return {
                name: devices[key].name,
                address: devices[key].addresses[0]
            }
        });
    }

    /**
     * Play the list on selected device name or address
     */
    this.play = function (deviceNameOrAddress, urlList, imageUrl) {
        //ip or device name
        const ipRegex = new RegExp('^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$');
        if (ipRegex.test(deviceNameOrAddress)) {
            launchMedia(deviceNameOrAddress, urlList, imageUrl);
        } else if (devices[deviceNameOrAddress]) {
            launchMedia(devices[deviceNameOrAddress].addresses[0], urlList, imageUrl, devices[deviceNameOrAddress].name);
        } else {
            console.log(`No matching device with name "${deviceName}"`);
        }
    }

    /**
     * generate a TTS url and cast it
     */
    this.say = function (deviceNameOrAddress, text, lang) {
        if (!text) {
            return;
        }
        // get audio URL
        const url = googleTTS.getAudioUrl(text, {
            lang: lang || 'en',
            slow: false,
            host: 'https://translate.google.com',
        });
        if (url) {
            //cast TTS url
            this.play(deviceNameOrAddress, [url]);
        }
    }
}

function getContentType(ext) {
    var contentTypeMap = {
        'mp3': 'audio/mp3',
        'mp4': 'audio/mp4',
        'mid': 'audio/mid',
        'rmi': 'audio/mid',
        'aif': 'audio/x-aiff',
        'm3u': 'audio/x-mpegurl',
        'ogg': 'audio/ogg',
        'wav': 'audio/vnd.wav',
        'ra': 'audio/vnd.rn-realaudio'
    };

    return contentTypeMap[ext] || 'audio/basic';
}

//media node with all the info about url
const createMedia = function (urlList, imageUrl) {


    //single url
    if (urlList.length === 1) {
        const url = urlList[0];
        const ext = url.split('.')[url.split('.').length - 1];
        const contentType = getContentType(ext);
        const media = {
            contentId: url,
            contentType: contentType
        }

        //metadata (title, image, etc)
        addGenericMetadata(media, imageUrl);

        return media;
    } else {
        const mediaList = [];

        urlList.forEach(item => {
            const ext = item.split('.')[item.split('.').length - 1];
            var contentType = getContentType(ext);
            var mediaItem = {
                autoplay: true,
                //This parameter is a hint for the receiver to preload this media item before it is played. 
                //It allows for a smooth transition between items played from the queue.
                preloadTime: 3, //listSize
                //Seconds since beginning of content. 
                //If the content is live content, and startTime is not specified, the stream will start at the live position.
                startTime: 1,
                activeTrackIds: [],
                //Playback duration of the item in seconds. 
                //If it is larger than the actual duration - startTime it will be limited to the actual duration - startTime. 
                //It can be negative, in such case the duration will be the actual item duration minus the duration provided. 
                //A duration of value zero effectively means that the item will not be played.
                playbackDuration: 2,
                //https://developers.google.com/cast/docs/reference/chrome/chrome.cast.media.MediaInfo
                media: {
                    contentId: item,
                    contentType: contentType,
                    streamType: 'BUFFERED',
                }
            };

            //metadata (title, image, etc)
            addGenericMetadata(mediaItem.media, imageUrl);

            mediaList.push(mediaItem);
        });
        return mediaList;
    }

}


const addGenericMetadata = function (media, imageUrl, contentTitle) {
    if (!contentTitle) {
        try {
            //default from url
            contentTitle = media.contentId;
            if (contentTitle.indexOf('/') > -1) {

                var paths = contentTitle.split('/');
                if (paths.length > 2) {
                    paths = paths.slice(paths.length - 2, paths.length);
                }
                contentTitle = paths.join(' - ');

            }
        } catch (e) {
        }
    }
    if (!imageUrl) {
        imageUrl = media.imageUrl || 'https://avatars.githubusercontent.com/u/4933765?s=200&v=4';
    }

    media.metadata = {
        type: 0,
        metadataType: 0,
        title: contentTitle,
        images: [
            { url: imageUrl }
        ]
    };
};

function launchMedia(host, urlList, imageUrl, name) {

    console.log(`Playing stuff on ${name ? name : 'device'}=${host}`, urlList);

    var client = new Client();

    client.connect(host, function () {
        console.log('connected, launching app ...');

        const media = createMedia(urlList, imageUrl);

        client.launch(DefaultMediaReceiver, function (err, player) {

            console.log('app "%s" launched, loading medias...', player.session.displayName);

            player.on('status', gotStatus);

            //Done re-ordering?
            var isDone = false;

            function gotStatus(status) {
                console.log('status broadcast = %s', status, " ");
                if (
                    isDone,
                    status.idleReason == "FINISHED" &&
                    status.loadingItemId === undefined) {
                    console.log("Done!");
                }
            }

            //single item
            if (!media.length) {
                player.load(media, {
                    autoplay: true
                },
                    function (err, status) {
                        console.log("Loaded QUEUE");
                        if (err) {
                            console.log(err);
                            return;
                        };
                        console.log(status);
                    }
                );
            } else {
                // loads multiple items 
                player.queueLoad(
                    media,
                    {
                        startIndex: 1,
                        repeatMode: "REPEAT_OFF"
                    },
                    function (err, status) {
                        console.log("Loaded QUEUE");
                        if (err) {
                            console.log(err);
                            return;
                        };
                        console.log(status);
                    }
                );
            }

        });
    });

    client.on('error', function (err) {
        console.log('Error: %s', err.message);
        client.close();
    });

}