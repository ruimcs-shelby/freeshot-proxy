export class Constants{
    // Errors
    static errorNoChannelsFound = "No channels were found";
    static errorChannelNotFound = "Channel not found";
    static errorChannelTokenNotDefined = "Channel token not defined";
    
    // TODO: Evaluate and implement a retry system for each one of these timeouts in the future
    // TODO: Config?
    // Intervals
    static tokenUpdateIntervalInMilliseconds = 600_000;         // = 10 minutes
    static networkIdleTimeOutInMilliseconds = 25_000;           // = 25 seconds
    static extraTimeoutForJsProcessingInMilliseconds = 10_000;  // = 10 seconds

    // Static files
    static freeshotDatabaseFile = "database/freeshot.json";
    static configFile = "config.json";

    // Page flags
    static pageNetworkIdle2 = "networkidle2";
} 