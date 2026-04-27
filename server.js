// #region Imports

// OS
import { networkInterfaces } from "os";

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
import fs, { readFile } from "fs";
import readline from "readline";

// #endregion Imports

// #region Globals

// Constants
const ipFamilyV4 = "IPV4";

// TODO: store this data on a file
// Current Channel 
let currentChannel = "";

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

app.get("/directplay/setchannel", (req, res) => {
  currentChannel = req.query.channel;
  Logger.log(`Set channel request received: ${currentChannel}`);
  res.status(200).send(currentChannel);
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

// #region public functions

function getIpAddress() {
  const nets = networkInterfaces();
  const results = Object.create(null);

  // Just in case if for any reason, the ip is not calculated,
  // return the default hostname
  let ipaddress = "server001.local";

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (net.family === 'IPv4' && !net.internal) {
        ipaddress = net.address;
      }
    }
  }
  return ipaddress;
}

function getConfig() {
  const rawData = fs.readFileSync(Constants.configFile, "utf-8");
  config = JSON.parse(rawData);
}


async function updateFreeshotTokens() {
  // Path to your local Chrome/Chromium
  const chromePath = config.chromePath;

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

// #endregion public functions

// <summary>
//  This function fetches the m3u playlist under the 'public' menu.
//  For each item, the server name is replaced with the IP address, to workaround local DNS issues 
// TODO: Use a stream like a normal person
// </summary>
async function transformPlaylistHostUrlToIpAddress(defaultPlaylist, ipaddress) {
  const fileStream = fs.createReadStream(defaultPlaylist.input);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity // Handles both \n and \r\n
  });

  const outputStream = fs.createWriteStream(defaultPlaylist.output);

  for await (const line of rl) {
    let transformedLine = line;
    if (line.startsWith("http://")) {
      const url = new URL(line);

      // this will enforce the DNS name to local ip
      url.hostname = ipaddress;

      transformedLine = url.href;
    }

    outputStream.write(transformedLine + '\n');
  }

}

async function main() {
  await getConfig();

  const ipaddress = getIpAddress();
  await transformPlaylistHostUrlToIpAddress(config.defaultPlaylist, ipaddress);

  getFreeshotChannels()
    .then(
      (result) => {
        channels = result;

        if (!config.isToUseAsPlayer) {
          // Even though this is being called on an interval, it's intended to make an explicit call at boot time
          updateFreeshotTokens();
        }

      }
    )
    .catch(
      (err) => {
        Logger.error("[ERROR] getFreeshotChannels(): " + err);
      });



  // #region Express App

  app.listen(expressPort, () => {
    const currentIp = getIpAddress();
    Logger.log(`Express listen on http://localhost:${expressPort}`);
    Logger.log(`IPADDRESS: ${currentIp}`);
  });

  app.use(express.static(expressStaticPath));

  // #endregion Express App
}

main();
