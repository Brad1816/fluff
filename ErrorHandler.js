class ErrorHandler {
  constructor() {
    this.errors = [];
    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener("error", (e) => {
      let msg = e.message || "Unknown Error";
      let file = e.filename ? e.filename.split("/").pop() : "unknown";
      let line = e.lineno || "?";
      let col = e.colno || "?";
      let trace =
        e.error && e.error.stack ? e.error.stack : `${file}:${line}:${col}`;
      this.addError(`Error: ${msg}\n${trace}`);
    });

    window.addEventListener("unhandledrejection", (e) => {
      let msg = e.reason ? e.reason.toString() : "Unknown Promise Rejection";
      let trace =
        e.reason && e.reason.stack ? e.reason.stack : "No stack trace";
      this.addError(`Unhandled Rejection: ${msg}\n${trace}`);
    });
  }

  addError(formattedMsg) {
    let existing = this.errors.find((err) => err.message === formattedMsg);
    if (existing) {
      existing.count++;
    } else {
      this.errors.push({ message: formattedMsg, count: 1 });
    }
  }
}

const errorHandler = new ErrorHandler();
