// #region Imports

import { exec } from "child_process";
import path from "path";
import fs from "fs";
import puppeteer from "puppeteer";
import express from "express";
import cors from "cors";
import net from "net";

const VLC_HOST = "rpi001";
const VLC_PORT = 4212;

import { Channel } from "./src/datatype/channel.js";
import { Constants } from "./src/utils/constants.js";
import { Logger } from "./src/utils/logger.js";

const __dirname = import.meta.dirname;

// #endregion Imports

// Global State
let channels = [];
let currentChannel = "";
let config = null;

let browser = null;
let page = null;
let requestHandlerAttached = false;

// Express
const expressPort = 3000;
const expressStaticPath = path.join(__dirname, "public");
const app = express();

// #region Express Routes

app.get("/directplay/setchannel", async (req, res) => {
    const newChannel = req.query.channel;

    if (!newChannel) {
        return res.status(400).send("Missing channel");
    }

    if (currentChannel === newChannel) {
        Logger.warn(`Channel ${newChannel} is already selected`);
        return res.status(200).send(currentChannel);
    }

    currentChannel = newChannel;
    Logger.log(`Set channel request received: ${currentChannel}`);

    await updateFreeshotTokens(currentChannel);
    res.status(200).send(currentChannel);
});

app.get("/directplay/getcurrentchannel", (req, res) => {
    const channel = channels.find(c => c.name === currentChannel);
    res.status(200).send(JSON.stringify(channel));
});

app.get("/directplay/getallchannels", (req, res) => {
    res.status(200).send(JSON.stringify(channels));
});

// #endregion Express Routes

// #region Puppeteer Request Handler

async function attachRequestHandler() {
    if (requestHandlerAttached) return;
    requestHandlerAttached = true;

    page.on("request", async (request) => {
        const url = request.url();

        if (url.includes(".m3u8")) {
            Logger.log(`Found Playlist:\n${url}`);

            const channel = channels.find(c => url.includes(c.tokenizedUrlKey));

            if (channel) {
                if (channel.tokenizedUrl !== url) {
                    channel.tokenizedUrl = url;
                    Logger.error(`--- / ---\nurl: ${url}\nchannel.tokenizedUrl = ${channel.tokenizedUrl}\n--- / ---`);

                    sendToVLC(`add ${url}`);
                }

            } else {
                Logger.error(`No channel found for playlist ${url}`);
            }
        }

        try {
            request.continue();
        } catch (e) {
            Logger.error("request.continue(): " + e.message);
        }
    });
}

// #endregion Puppeteer Request Handler

// #region Core Logic

async function updateFreeshotTokens(channelName, attempt = 0) {
    if (!browser) {
        const chromePath = config.chromePath;

        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        page = await browser.newPage();
        await page.setRequestInterception(true);
        attachRequestHandler();
    }

    const channel = channels.find(c => c.name === channelName);

    if (!channel) {
        Logger.error(`Channel ${channelName} not found`);
        return;
    }

    try {
        await page.goto(channel.url, {
            waitUntil: Constants.pageNetworkIdle2,
            timeout: Constants.networkIdleTimeOutInMilliseconds
        });

        await new Promise(resolve =>
            setTimeout(resolve, Constants.extraTimeoutForJsProcessingInMilliseconds)
        );

    } catch (e) {
        Logger.warn(`Navigation error: ${e.message}`);

        if (attempt < 3) {
            Logger.warn(`Retrying (${attempt + 1}/3)...`);
            return updateFreeshotTokens(channelName, attempt + 1);
        }

        Logger.error("Failed after 3 attempts");
    }
}

function getConfig() {
    const raw = fs.readFileSync(Constants.configFile, "utf-8");
    config = JSON.parse(raw);
}

async function getFreeshotChannels() {
    const raw = fs.readFileSync(Constants.freeshotDatabaseFile, "utf8");
    const data = JSON.parse(raw);

    if (!data || !data.channels) {
        throw new Error("Invalid channel database");
    }

    // channels = data.channels.filter(c => c.isToFetchToken === true);
    channels = data.channels;

    if (!config.isToUseAsPlayer) {
        setInterval(() => {
            if (currentChannel) {
                updateFreeshotTokens(currentChannel);
            }
        }, Constants.tokenUpdateIntervalInMilliseconds);
    }
}


function sendToVLC(command) {
    return new Promise((resolve, reject) => {
        try {
            const client = new net.Socket();

            client.connect(VLC_PORT, VLC_HOST, () => {
                client.write(command + "\n");
            });

            client.on("data", (data) => {
                // VLC responds with something like "> "
                client.destroy();
                resolve(data.toString());
            });

            client.on("error", reject);
        } catch (e) {
            Logger.error(`Send to VLC (command: ${command}) returned the following error: ${e.message}`);
        }

    });
}

// #endregion Core Logic

// #region Main

async function bootApp() {
    getConfig();
    await getFreeshotChannels();

    app.use(cors());
    app.use(express.static(expressStaticPath));

    app.listen(expressPort, () => {
        Logger.log(`Express listening on http://localhost:${expressPort}`);
    });
}

bootApp();

// #endregion Main
