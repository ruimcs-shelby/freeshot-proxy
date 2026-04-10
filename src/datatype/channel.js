export class Channel {
    constructor(name, url, isFreeshot = false, tokenizedUrl = "") {
        this.name = name;
        this.url = url;
        this.isFreeshot = isFreeshot;
        this.tokenizedUrl = tokenizedUrl;
    }
}