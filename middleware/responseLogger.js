const fs = require("fs");
const path = require("path");

const logFilePath = path.join(__dirname, "..", "data", "apiResponses.log");

const responseLogger = (req, res, next) => {
  const originalSend = res.send.bind(res);
  let hasLoggedResponse = false;

  const writeLog = (payload) => {
    if (hasLoggedResponse) {
      return;
    }

    hasLoggedResponse = true;

    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      response: payload,
    };

    fs.appendFile(logFilePath, `${JSON.stringify(logEntry)}\n`, (error) => {
      if (error) {
        console.error("Failed to write API response log", error);
      }
    });
  };

  res.send = (body) => {
    let normalizedBody = body;

    if (typeof body === "string") {
      try {
        normalizedBody = JSON.parse(body);
      } catch (error) {
        normalizedBody = body;
      }
    }

    writeLog(normalizedBody);
    return originalSend(body);
  };

  next();
};

module.exports = responseLogger;
