function stepElement(url, currentNames, nextName, extraData){

  const list = Array.isArray(currentNames)? currentNames : [currentNames]

  list.forEach(name => {
    const current = downloaderStatus[name]?.find(item => item.url === url)
    if(current !== undefined){
      downloaderStatus[name] =  downloaderStatus[name]?.filter(item => item.url !== url) ?? []
      downloaderStatus[nextName]?.push({
        ...current,
        ...(extraData ?? {})
      })
    }
  });
}


const downloaderStatus = {
  queue: [],
  downloading: [],
  converting: [],
  done: [],
  errors: [],
  setQueue: (queue)=>{
    downloaderStatus.queue = queue
  },
  addToDownloading: (url)=>{
    stepElement(url, 'queue', 'downloading')
    
  },
  progress: (url, type, progress)=>{
    console.log(`progress: ${url} ${progress}`);
    const current = downloaderStatus[type]?.find(item => item.url === url)
    if(current){
      current.progress = progress
    }
  },
  addToConverting: (url)=>{
    console.log(`Converting mp3 for ${url}`);

    stepElement(url, ['converting', 'downloading'], 'converting')
  },
  addToDone: (url)=>{
    stepElement(url, ['converting', 'downloading'], 'done')
    const current = downloaderStatus.downloading.find(item => item.url === url)
    if(current !== undefined){
      downloaderStatus.downloading =  downloaderStatus.downloading.filter(item => item.url !== url)
      downloaderStatus.done.push(current)
    }
  },
  addToErrors: (url, err)=>{
    const error = `Download error for ${url}: ${JSON.stringify(err)}`
    console.log(error);

    stepElement(url, ['converting', 'downloading'], 'errors', { error })
  }
}

module.exports = downloaderStatus