// #region Imports

// Custom
import { Channel } from "./src/datatype/channel.js";
import { Constants } from "./src/utils/constants.js";
import { Logger } from "./src/utils/logger.js";

// Path
import path from "path";
const __dirname = import.meta.dirname;

// Express
import express from "express";
const expressPort = 3000;
const expressStaticPath = path.join(__dirname, "public");
const app = express();

// Cors
import cors from "cors";
app.use(cors());

// Puppeteer-core
//import puppeteer from "puppeteer-core";
import puppeteer from "puppeteer";

// File System
import fs from "fs";

// #endregion Imports

// #region Globals

// Channel list
let channels = [];

// Config
let config = null;

// #endregion Globals

// #region Express Routes

app.get("/play/:channel", (req, res) => {
  const channel = channels.find(c => c.name == req.params.channel);
  Logger.log(`Channel ${req.params.channel}: ${JSON.stringify(channel)}`);
  Logger.log(`Channels: ${JSON.stringify(channels)}`);
  if (channel === undefined || channel === null) {
    res.status(404).send(Constants.errorChannelNotFound);
    Logger.error(`Route /play/:${req.params.channel}: 404 - ${Constants.errorChannelNotFound}`);
  } else if (channel.tokenizedUrl === undefined || channel.tokenizedUrl === null) {
    res.status(500).send(Constants.errorChannelTokenNotDefined);
    Logger.error(`Route /play/:${req.params.channel}: 500 - ${Constants.errorChannelTokenNotDefined}`);
  } else {
    res.redirect(302, channel.tokenizedUrl);
    Logger.log(`Route /play/:${req.params.channel}: 302 - Redirected to: ${channel.tokenizedUrl}`)
  }
});

// #endregion Express Routes

// #region public functions

function getConfig() {
  const rawData = fs.readFileSync(Constants.configFile, "utf-8");
  config = JSON.parse(rawData);
}
getConfig();

async function updateFreeshotTokens() {
  // Path to your local Chrome/Chromium
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

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
        // Logger.warn(`Current Channel: ${JSON.stringify(currentChannel)}`);
        // Logger.warn(`Cannels: ${JSON.stringify(channels)}`);
      } else {
        // Logger.warn(`Cannels: ${JSON.stringify(channels)}`);
        // Logger.error(`No channel found for playlist ${url}`);
      }
    }

    request.continue();
  });

  for (let channel of channels) {
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

  await browser.close();
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

    setInterval(
      () => {
        if (channels.length > 0) {
          updateFreeshotTokens();
        }
      },
      Constants.tokenUpdateIntervalInMilliseconds
    );

    if (channels.length > 0) {
      resolve(channels);
    } else {
      reject(Constants.errorNoChannelsFound);
    }

  });
}
getFreeshotChannels()
  .then(
    (result) => {
      channels = result;

      // Even though this is being called on an interval, it's intended to make an explicit call at boot time
      updateFreeshotTokens();
    }
  )
  .catch(
    (err) => {
      Logger.error("[ERROR] getFreeshotChannels(): " + err);
    });

// #endregion public functions

// #region Express App

app.listen(expressPort, () => {
  Logger.log(`Express listen on http://localhost:${expressPort}`);
});

app.use(express.static(expressStaticPath));

// #endregion Express App
