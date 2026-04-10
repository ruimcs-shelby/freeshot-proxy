export class Logger {

    static log = (message) => {
        const logDate = new Date().toISOString().replace(/z/gi,'').replace(/t/, ' ');
        console.log(`${logDate} [INFO] ${message}`);
    }

    static warn = (message) => {
        const logDate = new Date().toISOString().replace(/z/gi,'');
        console.warn(`${logDate} [WARN] ${message}`);
    }

    static error = (message) => {
        const logDate = new Date().toISOString().replace(/z/gi,'');
        console.error(`${logDate} [ERROR] ${message}`);
    }

    // TODO: Implement disk write
}
