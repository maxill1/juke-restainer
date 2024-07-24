const noisePhrases = [
  'Official Music Video',
]

const noiseWords = [
  'hq',
  'amv', 
  '!!',
  '"',
  '()'
]

const stringutils = {

    cleanupTitle: function (originalTitle = '', onlyIso = true) {
    if (!originalTitle) {
      return "";
    }
    
    let title =  originalTitle.replace(/\[.+]/gm, ' ').replace(/\(.+\)/gm,' ')
    const words = (
      ( onlyIso ? 
        title.match(/[\\u0020-~\\u00A0¤§¨­°´¸ÁÂÄÇÉËÍÎÓÔÖ×ÚÜÝßáâäçéëíîóôö÷úüýĂ-ćČ-đĘ-ěĹĺĽľŁ-ńŇňŐőŔŕŘ-śŞ-ťŮ-űŹ-žˇ˘˙˛˝!?\-()]+/gm, '')
      : 
      title.split(' ') 
    ) ?? [])
    .filter( w => {
      return !noiseWords.includes(w.toLocaleLowerCase())
    })
    title = words.join(' ')
    title = title.replace(/"/g, '');
    title = title.replace('[\\\/]', '-');
    title = title.replace('&', 'and');
    
    noisePhrases.forEach(n => {
      title = title.replace(n, ' ');
    });
    //cleanup spaces
    while(title.includes('  ')){
        title = title.replace('  ', ' ');
    }
    //long titles
    if(title.length > 60){
      const found = String(title).match(/(.+) - ([A-Za-z ]+)/)
      title = found?.[0] ?? title
    }
  
    return title?.trim();
  }
}
module.export = stringutils