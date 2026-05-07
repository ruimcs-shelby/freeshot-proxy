// #region Imports

// OS
import { networkInterfaces } from "os";
import { exec } from "child_process";

// Custom
import { Channel } from "./src/datatype/channel.js";
import { Constants } from "./src/utils/constants.js";
import { Logger } from "./src/utils/logger.js";

// Path
import path from "path";
const __dirname = import.meta.dirname;

// Cors
import cors from "cors";

// Puppeteer-core
//import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer";

// Express
import express from "express";

// File System
import fs, { readFile } from "fs";
import readline from "readline";

// #endregion Imports

// Channel list
let channels = [];

// Current channel
let currentChannel = "";

// Config
let config = null;

// Puppeteer Browser Object
let browser = null;
let page = null;

// #region Express Routes
const expressPort = 3000;
const expressStaticPath = path.join(__dirname, "public");
const app = express();

app.get("/directplay/setchannel", (req, res) => {
    // Ensure first the channel is not already pre-selected
    if (currentChannel === req.query.channel) {
        Logger.warn(`Channel ${req.query.channel} is already selected!`);
        res.status(200).send(currentChannel);
        return false;
    }

    currentChannel = req.query.channel;
    const channel = channels.find(c => c.name == req.params.channel);
    Logger.log(`Set channel request received: ${currentChannel}`);

    // Kill VLC Process if exists
    exec("pkill -f cvlc", (err) => {
        if (err) {
            Logger.warn(`Not possible to kill existing cvlc process: ${err.message}.`);
        } else {
            Logger.log(`Process cvlc killed.`);
        }
    });

    updateFreeshotTokens(req, currentChannel).then((result) => {
        // Spawn a new VLC PRocess
        const cvlcCommand = `DISPLAY=:0 cvlc ${channel.tokenizedUrl}`;
        exec(cvlcCommand, (err) => {
            if (err) {
                Logger.warn(`Not possible to kill existing cvlc process: ${err.message}.`);
            } else {
                Logger.log(`Process cvlc killed.`);
            }
        });

        res.status(200).send(currentChannel);
    });
});

app.get("/directplay/getcurrentchannel", (req, res) => {
  Logger.log(`Get current channel request received: ${currentChannel}`);
  const channel = channels.find(c => c.name === currentChannel);
  const channelAsString = JSON.stringify(channel);
  res.status(200).send(channelAsString);
});

app.get("/directplay/getallchannels", (req, res) => {
  res.status(200).send(JSON.stringify(channels));
});

// #endregion Express Routes

// #region functions

async function updateFreeshotTokens(req, currentChannel = "") {

    // Initiate Browser only if not instantiated yet
    if (browser == null) {
        // Path to your local Chrome/Chromium
        const chromePath = config.chromePath;
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        page = await browser.newPage();
    }

    page.on('request', request => {
        const url = request.url();

        // Look for the master playlist or specific chunks
        if (url.includes('.m3u8')) {
            Logger.log(`Found Playlist:\n${url}`);
            const currentChannel = channels.find(
                c => url.includes(c.tokenizedUrlKey)
            );

            if (currentChannel !== undefined && currentChannel !== null) {
                currentChannel.tokenizedUrl = url;
                page.goto("about:blank");
                // Logger.warn(`Current Channel: ${JSON.stringify(currentChannel)}`);
                // Logger.warn(`Cannels: ${JSON.stringify(channels)}`);
            } else {
                // Logger.warn(`Cannels: ${JSON.stringify(channels)}`);
                // Logger.error(`No channel found for playlist ${url}`);
            }
        }

        request.continue();
    });

    if (currentChannel === undefined || currentChannel === null || currentChannel === "") {
        for (let channel of channels) {
            if (channel.isToFetchToken) {
                try {
                    // The Magic: Intercept all network traffic
                    await page.setRequestInterception(true);

                    // Navigate and wait for the player to actually load the stream
                    await page.goto(
                        channel.url,
                        {
                            waitUntil: Constants.pageNetworkIdle2,
                            timeout: Constants.networkIdleTimeOutInMilliseconds
                        }
                    );

                    // Sometimes you need to wait a few extra seconds for the JS player to kick in
                    await new Promise(
                        resolve => setTimeout(
                            resolve,
                            Constants.extraTimeoutForJsProcessingInMilliseconds
                        )
                    );
                } catch (e) {
                    console.error("Sniffing failed:", e.message);
                } finally {

                }
            }
        }
    } else {
        const channel = channels.find(c => c.name == currentChannel);
        Logger.warn(`Channels: ${JSON.stringify(channels)}`);
        Logger.warn(`Current Channel: ${currentChannel}`);

        // The Magic: Intercept all network traffic
        await page.setRequestInterception(true);

        // Navigate and wait for the player to actually load the stream
        await page.goto(
            channel.url,
            {
                waitUntil: Constants.pageNetworkIdle2,
                timeout: Constants.networkIdleTimeOutInMilliseconds
            }
        );

        // Sometimes you need to wait a few extra seconds for the JS player to kick in
        await new Promise(
            resolve => setTimeout(
                resolve,
                Constants.extraTimeoutForJsProcessingInMilliseconds
            )
        );
    }

    return true;
}

function getConfig() {
    const rawData = fs.readFileSync(Constants.configFile, "utf-8");
    config = JSON.parse(rawData);
}

async function getFreeshotChannels() {
  return new Promise((resolve, reject) => {
    // Allways clear channel list, before update
    channels = [];

    const rawData = fs.readFileSync(Constants.freeshotDatabaseFile, "utf8");
    const freeshotData = JSON.parse(rawData);

    if (freeshotData === undefined || freeshotData === null) {
      throw new Error(`File ${Constants.freeshotDatabaseFile} does not contain any data!`);
    }

    channels = freeshotData.channels;

    if (!config.isToUseAsPlayer) {
      setInterval(
        () => {
          if (channels.length > 0) {
            updateFreeshotTokens();
          }
        },
        Constants.tokenUpdateIntervalInMilliseconds
      );
    }

    if (channels.length > 0) {
      resolve(channels);
    } else {
      reject(Constants.errorNoChannelsFound);
    }

  });
}


// #endregion functions

// #region Main

async function bootApp() {
    getConfig();
    await getFreeshotChannels();

    app.use(cors());
    app.listen(expressPort, () => {
        Logger.log(`Express listen on http://localhost:${expressPort}`);
    });

    app.use(express.static(expressStaticPath));
}

bootApp();

// #endregion Main