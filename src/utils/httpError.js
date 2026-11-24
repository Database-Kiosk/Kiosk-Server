// Error with an HTTP status. The common error handler in app.js responds with { message }.
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
