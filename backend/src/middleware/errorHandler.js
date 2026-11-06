export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Send a valid JSON request body.'
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The JSON request body is too large.'
    });
  }

  if (error.status === 400 || error.status === 415) {
    return res.status(error.status).json({
      code: error.status === 400 ? 'VALIDATION_ERROR' : 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The request could not be read. Check the request format.'
    });
  }

  console.error('Request failed:', error.code ?? error.name);
  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'The request could not be completed.'
  });
}
