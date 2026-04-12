export class Constants{
    // Errors
    static errorNoChannelsFound = "No channels were found";
    static errorChannelNotFound = "Channel not found";
    static errorChannelTokenNotDefined = "Channel token not defined";
    
    // TODO: Evaluate and implement a retry system for each one of these timeouts in the future
    // Intervals
    static tokenUpdateIntervalInMilliseconds = 300_000;         // = 5 minutes
    static networkIdleTimeOutInMilliseconds = 30_000;           // = 10 seconds
    static extraTimeoutForJsProcessingInMilliseconds = 10_000;   // = 2 seconds

    // Static files
    static freeshotDatabaseFile = "database/freeshot.json";
    static configFile = "config.json";

    // Page flags
    static pageNetworkIdle2 = "networkidle2";
} 