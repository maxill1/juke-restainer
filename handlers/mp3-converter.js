const { spawn } = require('child_process');
const ffmpeg = require("ffmpeg-static")
const Fs = require('fs')


module.exports = function () {

    const execute = function (processName, processArgs, onClose) {

        if (!onClose) {
            onClose = (code) => {
                if (code === 0) {
                    console.log(processName + " done.");
                } else {
                    console.error(`Process ${processName} exited with status code: ${code}`);
                }
            };
        }

        const ls = spawn(processName, processArgs);

        ls.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        ls.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        ls.on('close', onClose);
    }


    //for debug purpose
    console.log("FFMPEG location: " + ffmpeg);
    execute(ffmpeg, ['-version']);

    this.convert = function (input) {
        var mp3 = input.replace(".opus", ".mp3");

        var ffmpegArgs = [
            '-y',
            '-i',
            input,
            '-acodec',
            'libmp3lame',
            mp3];

        execute(ffmpeg, ffmpegArgs, (code) => {
            if (code !== 0) {
                console.log("Error converting " + input + ": exited with code " + code);
            } else {
                console.log("Mp3 converted: " + mp3);
                try {
                    Fs.unlinkSync(input)
                    console.log("Successfully deleted the opus file.")
                } catch (err) {
                    throw err
                }
            }
        });

    }
}